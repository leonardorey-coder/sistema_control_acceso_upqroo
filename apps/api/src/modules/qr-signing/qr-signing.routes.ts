import { Hono } from "hono";
import { clearKeyCache, getJwks } from "./qr-signing.service";
import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import { requireAdminRole } from "../../http/middleware/session";

export const qrKeysRoutes = new Hono();

qrKeysRoutes.get("/jwks", async (c) => {
  const jwks = await getJwks();
  return c.json(jwks);
});

qrKeysRoutes.get("/current", async (c) => {
  const jwks = await getJwks();
  const current = jwks.keys[0] ?? null;
  return c.json({ data: { key: current } });
});

/** Rotate: mark all active keys as rotated and clear cache so next signing generates a new key. */
qrKeysRoutes.post("/rotate", requireAdminRole("super_admin"), async (c) => {
  await db.execute(sql`
    UPDATE qr_signing_keys SET status = 'rotated', rotated_at = now()
    WHERE status = 'active'
  `);
  clearKeyCache();
  return c.json({ data: { ok: true } });
});
