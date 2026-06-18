import { Hono } from "hono";
import { z } from "zod";
import { stripSecretFields } from "../../shared/sanitize";
import { issueOpaqueToken } from "../../shared/security";
import {
  createPersonQrToken,
  createTemporaryDailyQr,
  listPersonQrTokens,
  listTemporaryDailyQr,
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
  maxUses: z.number().int().min(1).max(10).default(1),
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

  return c.json({ data: { credential: stripSecretFields(row), token: issued.token } }, 201);
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

  return c.json({ data: { credential: stripSecretFields(row), token: issued.token } }, 201);
});

credentialsRoutes.post("/temporary-daily/:id/revoke", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await revokeTemporaryDailyQr(id);
  return row ? c.json({ data: row }) : c.json({ error: { code: "TEMPORARY_DAILY_QR_NOT_FOUND" } }, 404);
});
