import { Hono } from "hono";
import { z } from "zod";
import { createPersonQrToken, createTemporaryDailyQr, listPersonQrTokens } from "./credentials.repository";

const personQrSchema = z.object({
  personId: z.string().uuid(),
  tokenHash: z.string().min(32),
  expiresAt: z.coerce.date()
});

const temporaryDailyQrSchema = z.object({
  personId: z.string().uuid(),
  tokenHash: z.string().min(32),
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
  const row = await createPersonQrToken(personQrSchema.parse(await c.req.json()));
  return c.json({ data: row }, 201);
});

credentialsRoutes.post("/temporary-daily", async (c) => {
  const row = await createTemporaryDailyQr(temporaryDailyQrSchema.parse(await c.req.json()));
  return c.json({ data: row }, 201);
});
