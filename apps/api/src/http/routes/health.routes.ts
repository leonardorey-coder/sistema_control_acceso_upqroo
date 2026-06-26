import type { ApiHealth } from "@control-acceso/shared";
import { Hono } from "hono";
import { env } from "../../config/env";
import { getEventMetrics } from "../../modules/events/events";
import { getWorkerMetrics } from "../../worker";

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

healthRoutes.get("/metrics", (c) => c.json({
  ok: true,
  checkedAt: new Date().toISOString(),
  config: {
    postgresPoolMax: env.POSTGRES_POOL_MAX,
    eventCoalesceMs: env.EVENT_COALESCE_MS,
    workerIntervalMs: env.WORKER_INTERVAL_MS,
    operatingTimezone: env.OPERATING_TIMEZONE
  },
  events: getEventMetrics(),
  worker: getWorkerMetrics()
}));
