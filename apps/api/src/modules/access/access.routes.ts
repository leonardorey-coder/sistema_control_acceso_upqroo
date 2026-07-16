import { Hono } from "hono";
import { z } from "zod";
import { errors as JoseErrors } from "jose";
import { getActorMetadata, getAdminSession } from "../../http/middleware/session";
import { recordAudit } from "../../shared/audit";
import { toOperationalDateRange } from "../../shared/date-range";
import { withoutUndefined } from "../../shared/object";
import { paginated, parsePagination } from "../../shared/pagination";
import { broadcastEvent } from "../events/events";
import { verifyDynamicQr } from "../qr-signing/qr-signing.service";
import { getPersonProfileFileUrl, listAccessToday, runAccessScan, runAutoExits } from "./access.repository";
import { getOperationalConfig } from "../config/config.repository";
import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import { HttpError } from "../../shared/http-error";
import { scannerDevicesRequired, verifyScannerDeviceProof } from "../scanner-devices/scanner-devices.service";
import { findGateByScannerId, summarizeGates } from "../gates/gates.repository";

export const accessRoutes = new Hono();

async function recordRejectedSignedQr(reasonCode: string, scannerId?: string, gateId?: string) {
  await db.execute(sql`
    INSERT INTO access_scan_events (
      credential_type,
      access_mode,
      accepted,
      reason_code,
      signature_verified,
      gate_id,
      metadata
    )
    VALUES (
      'person_qr',
      'pedestrian',
      false,
      ${reasonCode},
      false,
      ${gateId ?? null}::uuid,
      ${JSON.stringify(withoutUndefined({ scannerId, gateId }))}::jsonb
    )
  `);
}

async function recordRejectedScannerDevice(reasonCode: string, metadata: Record<string, unknown>) {
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
      'manual_override',
      'manual',
      false,
      ${reasonCode},
      false,
      ${JSON.stringify(metadata)}::jsonb
    )
  `);
}

accessRoutes.post("/scan", async (c) => {
  const body = z.object({
    token: z.string().trim().min(1).optional(),
    signedQr: z.string().trim().min(1).optional(),
    manualMatricula: z.string().trim().min(1).optional(),
    scannerId: z.string().trim().optional(),
    scannerDeviceId: z.string().uuid().optional(),
    scannerCode: z.string().trim().min(3).max(120).optional(),
    scannerChallengeId: z.string().uuid().optional(),
    scannerSignature: z.string().trim().min(1).optional()
  }).strict().refine((input) => input.token || input.signedQr || input.manualMatricula, {
    message: "token, signedQr or manualMatricula is required"
  }).parse(await c.req.json().catch(() => ({})));

  const session = getAdminSession(c);
  const proofSupplied = Boolean(body.scannerDeviceId || body.scannerCode || body.scannerChallengeId || body.scannerSignature);
  const requireScannerDevice = await scannerDevicesRequired();
  const adminCanBypassScannerDevice = session.role === "super_admin";
  let verifiedScanner: { scannerDeviceId: string; scannerCode: string } | null = null;

  if ((requireScannerDevice && !adminCanBypassScannerDevice) || proofSupplied) {
    try {
      verifiedScanner = await verifyScannerDeviceProof(withoutUndefined({
        adminId: session.adminId,
        scannerDeviceId: body.scannerDeviceId,
        scannerCode: body.scannerCode,
        scannerChallengeId: body.scannerChallengeId,
        scannerSignature: body.scannerSignature,
        payload: withoutUndefined({
          token: body.token,
          signedQr: body.signedQr,
          manualMatricula: body.manualMatricula,
          scannerCode: body.scannerCode
        })
      }));
    } catch (err) {
      const reasonCode = err instanceof HttpError ? err.code : "SCANNER_SIGNATURE_INVALID";
      await recordRejectedScannerDevice(reasonCode, withoutUndefined({
        scannerId: body.scannerId,
        scannerDeviceId: body.scannerDeviceId,
        scannerCode: body.scannerCode,
        adminId: session.adminId
      }));
      return c.json({ data: { accepted: false, reasonCode, scannedAt: new Date().toISOString() } });
    }
  }

  const effectiveScannerId = verifiedScanner?.scannerCode ?? body.scannerId;
  const gateContext = effectiveScannerId ? await findGateByScannerId(effectiveScannerId) : null;
  let scanPayload: Record<string, unknown> = {
    ...withoutUndefined({
      token: body.token,
      signedQr: body.signedQr,
      manualMatricula: body.manualMatricula,
      scannerId: effectiveScannerId,
      scannerDeviceId: verifiedScanner?.scannerDeviceId,
      scannerCode: verifiedScanner?.scannerCode,
      gateId: gateContext?.gateId
    }),
    adminId: session.adminId
  } as Record<string, unknown>;

  // Signed QR path: verify JWT here in Bun, then inject pre-verified fields for SQL
  if (body.signedQr) {
    if (!gateContext) {
      const gateResult = await runAccessScan(withoutUndefined({
        scannerId: effectiveScannerId,
        scannerCode: verifiedScanner?.scannerCode,
        adminId: session.adminId
      }));
      return c.json({ data: gateResult });
    }
    const [configRow] = await getOperationalConfig("signed_qr");
    const signedQrConfig = (configRow?.value as Record<string, unknown> | undefined) ?? {};
    if (signedQrConfig.enabled !== true) {
      await recordRejectedSignedQr("SIGNED_QR_DISABLED", effectiveScannerId, gateContext.gateId);
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
      await recordRejectedSignedQr(reasonCode, effectiveScannerId, gateContext.gateId);
      return c.json({ data: { accepted: false, reasonCode } });
    }

    // Build enriched payload for access_scan_v1
    scanPayload = {
      preVerifiedPersonId: verified.sub,
      preVerifiedJti: verified.jti,
      preVerifiedCredentialType: verified.typ,
      preVerifiedTemporaryDailyQrId: verified.temporaryDailyQrId,
      preVerifiedVehiclePermitId: verified.vehiclePermitId,
      signatureVerified: true,
      kid: verified.kid,
      sigAlg: verified.alg,
      iat: verified.iat,
      exp: verified.exp,
      scannerId: effectiveScannerId,
      scannerDeviceId: verifiedScanner?.scannerDeviceId,
      scannerCode: verifiedScanner?.scannerCode,
      gateId: gateContext.gateId,
      adminId: session.adminId
    };
  }

  const result = await runAccessScan(withoutUndefined(scanPayload));
  const responseResult = typeof result === "object" && result
    ? ({ ...(result as Record<string, unknown>) } as Record<string, unknown>)
    : result;
  const responseObject = typeof responseResult === "object" && responseResult
    ? responseResult as Record<string, unknown>
    : null;

  if (responseObject && typeof responseObject["personId"] === "string") {
    const profilePhotoUrl = await getPersonProfileFileUrl(responseObject["personId"]);
    if (profilePhotoUrl) {
      responseObject["profilePhotoUrl"] = profilePhotoUrl;
    }
  }

  const reasonCode = responseObject && typeof responseObject["reasonCode"] === "string"
    ? responseObject["reasonCode"]
    : "";
  const vehicleRejected = responseObject?.["accepted"] === false
    && (
      responseObject["accessMode"] === "vehicle"
      || typeof responseObject["vehicleId"] === "string"
      || reasonCode.startsWith("VEHICLE_")
    );

  if (vehicleRejected) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "vehicle_access.rejected",
      entityType: "access",
      metadata: { result: responseResult }
    });
  }

  await recordAudit({
    ...getActorMetadata(c),
    action: "access.scan",
    entityType: "access",
    entityId: responseObject && "registroId" in responseObject ? String(responseObject["registroId"]) : undefined,
    metadata: { result: responseResult }
  });
  broadcastEvent("access.scan", withoutUndefined({
    scannerId: effectiveScannerId,
    scannerDeviceId: verifiedScanner?.scannerDeviceId,
    result: responseResult as Record<string, unknown>
  }));
  broadcastEvent("access.table", {});
  broadcastEvent("attendance.table", {});

  return c.json({ data: responseResult });
});

const accessTodayQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  personType: z.string().trim().min(1).optional(),
  accessMode: z.enum(["pedestrian", "vehicle", "visitor", "manual"]).optional(),
  status: z.enum(["in_progress", "completed", "auto_closed", "rejected"]).optional(),
  gateId: z.string().uuid().optional(),
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
      filtered: Boolean(query.q || query.personType || query.accessMode || query.status || query.gateId)
    })
  });
});

accessRoutes.get("/gates/summary", async (c) => {
  const query = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  }).parse(c.req.query());
  const range = toOperationalDateRange(query.date);
  return c.json({ data: { date: range.date, rows: await summarizeGates(range.from, range.to) } });
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
