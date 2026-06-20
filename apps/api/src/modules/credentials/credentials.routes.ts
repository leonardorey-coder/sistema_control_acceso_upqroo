import { Hono } from "hono";
import { z } from "zod";
import { getActorMetadata } from "../../http/middleware/session";
import { recordAudit } from "../../shared/audit";
import { HttpError } from "../../shared/http-error";
import { stripSecretFields } from "../../shared/sanitize";
import { issueOpaqueToken } from "../../shared/security";
import { getOperationalConfig } from "../config/config.repository";
import { signDynamicQr } from "../qr-signing/qr-signing.service";
import {
  createPersonQrToken,
  createTemporaryDailyQr,
  getTemporaryDailyQrSigningContext,
  listPersonQrTokens,
  listTemporaryDailyQr,
  revokeActivePersonQrTokens,
  revokeTemporaryDailyQr
} from "./credentials.repository";

const personQrSchema = z.object({
  personId: z.string().uuid(),
  expiresAt: z.coerce.date()
});

const temporaryDailyQrSchema = z.object({
  personId: z.string().uuid(),
  operationalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  missingCredentialType: z.string().trim().min(1).max(80),
  reasonCode: z.string().trim().min(1).max(80),
  reasonText: z.string().trim().optional(),
  scope: z.record(z.unknown()).default({}),
  maxUses: z.number().int().min(1).max(10).default(10),
  validUntil: z.coerce.date(),
  createdByAdminId: z.string().uuid().optional()
});

export const credentialsRoutes = new Hono();

credentialsRoutes.get("/person/:personId", async (c) => {
  const personId = z.string().uuid().parse(c.req.param("personId"));
  const rows = await listPersonQrTokens(personId);
  return c.json({ data: { rows } });
});

credentialsRoutes.post("/person", async (c) => {
  const input = personQrSchema.parse(await c.req.json());
  const issued = issueOpaqueToken("person_qr");
  const row = await createPersonQrToken({
    ...input,
    tokenHash: issued.tokenHash
  });

  if (!row) {
    throw new Error("Failed to create person QR token");
  }

  await recordAudit({
    ...getActorMetadata(c),
    action: "credential.person_qr_issued",
    entityType: "qr_token",
    entityId: row.id,
    metadata: { personId: input.personId }
  });

  return c.json({ data: { credential: stripSecretFields(row), token: issued.token } }, 201);
});

credentialsRoutes.post("/person/:personId/rotate", async (c) => {
  const personId = z.string().uuid().parse(c.req.param("personId"));
  const body = personQrSchema.omit({ personId: true }).parse(await c.req.json());
  await revokeActivePersonQrTokens(personId);
  const issued = issueOpaqueToken("person_qr");
  const row = await createPersonQrToken({
    personId,
    expiresAt: body.expiresAt,
    tokenHash: issued.tokenHash
  });

  await recordAudit({
    ...getActorMetadata(c),
    action: "credential.person_qr_rotated",
    entityType: "qr_token",
    entityId: row.id,
    metadata: { personId }
  });

  return c.json({ data: { credential: stripSecretFields(row), token: issued.token } }, 201);
});

credentialsRoutes.post("/person/:personId/revoke", async (c) => {
  const personId = z.string().uuid().parse(c.req.param("personId"));
  const rows = await revokeActivePersonQrTokens(personId);
  await recordAudit({
    ...getActorMetadata(c),
    action: "credential.person_qr_revoked",
    entityType: "person",
    entityId: personId,
    metadata: { revoked: rows.length }
  });

  return c.json({ data: { rows } });
});

credentialsRoutes.get("/temporary-daily", async (c) => {
  const rows = await listTemporaryDailyQr();
  return c.json({ data: { rows } });
});

credentialsRoutes.post("/temporary-daily", async (c) => {
  const input = temporaryDailyQrSchema.parse(await c.req.json());
  const issued = issueOpaqueToken("temporary_daily_qr");
  const row = await createTemporaryDailyQr({
    ...input,
    tokenHash: issued.tokenHash
  });

  if (!row) {
    throw new Error("Failed to create temporary daily QR");
  }

  await recordAudit({
    ...getActorMetadata(c),
    action: "credential.temporary_daily_qr_issued",
    entityType: "temporary_daily_qr",
    entityId: row.id,
    metadata: { personId: input.personId, operationalDate: input.operationalDate }
  });

  return c.json({ data: { credential: stripSecretFields(row), token: issued.token } }, 201);
});

credentialsRoutes.post("/temporary-daily/:id/revoke", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await revokeTemporaryDailyQr(id);
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "credential.temporary_daily_qr_revoked",
      entityType: "temporary_daily_qr",
      entityId: id
    });
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "TEMPORARY_DAILY_QR_NOT_FOUND" } }, 404);
});

credentialsRoutes.post("/temporary-daily/:id/dynamic", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const [configRow] = await getOperationalConfig("signed_qr");
  const config = (configRow?.value as Record<string, unknown> | undefined) ?? {};
  if (config.enabled !== true) {
    throw new HttpError(409, "SIGNED_QR_DISABLED", "Signed dynamic QR is disabled.");
  }

  const credential = await getTemporaryDailyQrSigningContext(id);
  if (!credential) {
    throw new HttpError(404, "TEMPORARY_DAILY_QR_NOT_SIGNABLE", "Temporary daily QR is not active or signable.");
  }

  const configuredTtl = typeof config.ttlSeconds === "number" ? config.ttlSeconds : 30;
  const ttlSeconds = Math.min(30, Math.max(15, Math.floor(configuredTtl)));
  const { token, expiresAt, jti } = await signDynamicQr({
    sub: credential.personId,
    uid: credential.matricula,
    typ: "temporary_daily_qr",
    temporaryDailyQrId: credential.id
  }, ttlSeconds);

  await recordAudit({
    ...getActorMetadata(c),
    action: "credential.temporary_daily_qr_dynamic_issued",
    entityType: "temporary_daily_qr",
    entityId: credential.id,
    metadata: { personId: credential.personId, operationalDate: credential.operationalDate, jti }
  });

  return c.json({
    data: {
      credential: stripSecretFields(credential),
      token,
      expiresAt,
      refreshAfterMs: Math.max(5000, (ttlSeconds - 5) * 1000),
      jti
    }
  }, 201);
});
