import { Hono } from "hono";
import { z } from "zod";
import { errors as JoseErrors } from "jose";
import { getActorMetadata } from "../../http/middleware/session";
import { recordAudit } from "../../shared/audit";
import { toOperationalDateRange } from "../../shared/date-range";
import { withoutUndefined } from "../../shared/object";
import { paginated, parsePagination } from "../../shared/pagination";
import { broadcastEvent } from "../events/events";
import { verifyDynamicQr } from "../qr-signing/qr-signing.service";
import { listAccessToday, runAccessScan, runAutoExits } from "./access.repository";
import { getOperationalConfig } from "../config/config.repository";
import { db } from "../../db/client";
import { sql } from "drizzle-orm";

export const accessRoutes = new Hono();

async function recordRejectedSignedQr(reasonCode: string, scannerId?: string) {
  await db.execute(sql`
    INSERT INTO access_scan_events (
      credential_type,
      access_mode,
      accepted,
      reason_code,
      signature_verified,
      metadata
    )
    VALUES (
      'person_qr',
      'pedestrian',
      false,
      ${reasonCode},
      false,
      ${JSON.stringify(withoutUndefined({ scannerId }))}::jsonb
    )
  `);
}

accessRoutes.post("/scan", async (c) => {
  const body = z.object({
    token: z.string().trim().min(1).optional(),
    signedQr: z.string().trim().min(1).optional(),
    manualMatricula: z.string().trim().min(1).optional(),
    adminId: z.string().uuid().optional(),
    scannerId: z.string().trim().optional()
  }).refine((input) => input.token || input.signedQr || input.manualMatricula, {
    message: "token, signedQr or manualMatricula is required"
  }).parse(await c.req.json().catch(() => ({})));

  let scanPayload: Record<string, unknown> = withoutUndefined(body) as Record<string, unknown>;

  // Signed QR path: verify JWT here in Bun, then inject pre-verified fields for SQL
  if (body.signedQr) {
    const [configRow] = await getOperationalConfig("signed_qr");
    const signedQrConfig = (configRow?.value as Record<string, unknown> | undefined) ?? {};
    if (signedQrConfig.enabled !== true) {
      await recordRejectedSignedQr("SIGNED_QR_DISABLED", body.scannerId);
      return c.json({ data: { accepted: false, reasonCode: "SIGNED_QR_DISABLED" } });
    }
    const clockTolerance = typeof signedQrConfig.clockToleranceSeconds === "number"
      ? signedQrConfig.clockToleranceSeconds : 5;

    let verified;
    try {
      verified = await verifyDynamicQr(body.signedQr, clockTolerance);
    } catch (err) {
      let reasonCode = "INVALID_SIGNED_QR";
      if (err instanceof JoseErrors.JWTExpired) reasonCode = "SIGNED_QR_EXPIRED";
      else if (err instanceof JoseErrors.JWTClaimValidationFailed) reasonCode = "SIGNED_QR_CLAIM_INVALID";
      else if (err instanceof Error && err.message === "SIGNED_QR_CLAIM_INVALID") reasonCode = "SIGNED_QR_CLAIM_INVALID";
      else if (err instanceof Error && err.message === "SIGNED_QR_KEY_NOT_FOUND") reasonCode = "SIGNED_QR_KEY_NOT_FOUND";
      else if (err instanceof Error && err.message === "SIGNED_QR_ALG_INVALID") reasonCode = "SIGNED_QR_ALG_INVALID";
      await recordRejectedSignedQr(reasonCode, body.scannerId);
      return c.json({ data: { accepted: false, reasonCode } });
    }

    // Build enriched payload for access_scan_v1
    scanPayload = {
      preVerifiedPersonId: verified.sub,
      preVerifiedJti: verified.jti,
      signatureVerified: true,
      kid: verified.kid,
      sigAlg: verified.alg,
      iat: verified.iat,
      exp: verified.exp,
      scannerId: body.scannerId,
      adminId: body.adminId
    };
  }

  const result = await runAccessScan(withoutUndefined(scanPayload));
  await recordAudit({
    ...getActorMetadata(c),
    action: "access.scan",
    entityType: "access",
    entityId: typeof result === "object" && result && "registroId" in result ? String(result.registroId) : undefined,
    metadata: { result }
  });
  broadcastEvent("access.scan", { result: result as Record<string, unknown> });
  broadcastEvent("access.table", {});
  broadcastEvent("attendance.table", {});

  return c.json({ data: result });
});

const accessTodayQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  personType: z.string().trim().min(1).optional(),
  accessMode: z.enum(["pedestrian", "vehicle", "visitor", "manual"]).optional(),
  status: z.enum(["in_progress", "completed", "auto_closed", "rejected"]).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

accessRoutes.get("/today", async (c) => {
  const pagination = parsePagination(c.req.query());
  const query = withoutUndefined(accessTodayQuerySchema.parse(c.req.query()));
  const range = toOperationalDateRange(query.date);
  const result = await listAccessToday({ ...query, from: range.from, to: range.to }, pagination);

  return c.json({
    data: paginated(result.rows, result.total, pagination, {
      date: range.date,
      filtered: Boolean(query.q || query.personType || query.accessMode || query.status)
    })
  });
});

accessRoutes.post("/auto-exits", async (c) => {
  const body = z.object({
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  }).parse(await c.req.json().catch(() => ({})));
  const result = await runAutoExits(body.targetDate);
  await recordAudit({
    ...getActorMetadata(c),
    action: "access.auto_exits",
    entityType: "access",
    metadata: { targetDate: body.targetDate, result }
  });
  broadcastEvent("access.table", { autoExits: result as Record<string, unknown> });
  broadcastEvent("attendance.table", {});

  return c.json({ data: result });
});
