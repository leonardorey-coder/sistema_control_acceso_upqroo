import type { ApiHealth } from "@control-acceso/shared";
import { Hono } from "hono";

export const healthRoutes = new Hono();

healthRoutes.get("/", (c) => {
  const payload: ApiHealth = {
    ok: true,
    service: "control-acceso-api",
    version: "0.1.0",
    checkedAt: new Date().toISOString()
  };

  return c.json(payload);
});
