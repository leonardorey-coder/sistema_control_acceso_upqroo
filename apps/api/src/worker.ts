import { sql, type SQL } from "drizzle-orm";
import { env } from "./config/env";
import { db, closeDb } from "./db/client";
import { runAutoExits } from "./modules/access/access.repository";

type WorkerStep = {
  name: string;
  durationMs: number;
  rows?: number;
  error?: string;
};

type WorkerMetrics = {
  running: boolean;
  skippedOverlaps: number;
  cycles: number;
  failures: number;
  lastStartedAt?: string;
  lastFinishedAt?: string;
  lastDurationMs?: number;
  lastSteps: WorkerStep[];
};

const workerMetrics: WorkerMetrics = {
  running: false,
  skippedOverlaps: 0,
  cycles: 0,
  failures: 0,
  lastSteps: []
};

async function measureStep<T>(name: string, action: () => Promise<T>, steps: WorkerStep[]) {
  const start = performance.now();
  try {
    const result = await action();
    const durationMs = Number((performance.now() - start).toFixed(2));
    const rows = typeof result === "number" ? result : undefined;
    steps.push(rows === undefined ? { name, durationMs } : { name, durationMs, rows });
    return result;
  } catch (error) {
    const durationMs = Number((performance.now() - start).toFixed(2));
    steps.push({
      name,
      durationMs,
      error: error instanceof Error ? error.message : "Unknown worker step error"
    });
    throw error;
  }
}

async function countMutation(query: SQL) {
  const [row] = await db.execute<{ total: number }>(query);
  return Number(row?.total ?? 0);
}

export async function runWorkerCycle() {
  if (workerMetrics.running) {
    workerMetrics.skippedOverlaps += 1;
    return {
      skipped: true,
      reason: "WORKER_CYCLE_ALREADY_RUNNING",
      metrics: getWorkerMetrics()
    };
  }

  const cycleStart = performance.now();
  const steps: WorkerStep[] = [];
  workerMetrics.running = true;
  workerMetrics.lastStartedAt = new Date().toISOString();

  try {
    const autoExits = await measureStep("autoExits", () => runAutoExits(), steps);
    const expired = {
      hotQr: await measureStep("expireHotQr", () => countMutation(sql`
        with changed as (
          update hot_qr_tokens
          set status = 'expired'
          where status = 'active' and valid_until <= now()
          returning id
        )
        select count(*)::int as total from changed
      `), steps),
      temporaryDailyQr: await measureStep("expireTemporaryDailyQr", () => countMutation(sql`
        with changed as (
          update temporary_daily_qr_tokens
          set status = 'expired'
          where status = 'active' and valid_until <= now()
          returning id
        )
        select count(*)::int as total from changed
      `), steps),
      vehiclePermitQr: await measureStep("expireVehiclePermitQr", () => countMutation(sql`
        with changed as (
          update vehicle_permit_qr_tokens
          set status = 'expired'
          where status = 'active' and expires_at <= now()
          returning id
        )
        select count(*)::int as total from changed
      `), steps),
      personQr: await measureStep("expirePersonQr", () => countMutation(sql`
        with changed as (
          update qr_tokens
          set status = 'expired'
          where status = 'active' and expires_at <= now()
          returning id
        )
        select count(*)::int as total from changed
      `), steps),
      sessions: await measureStep("expireAdminSessions", () => countMutation(sql`
        with changed as (
          update admin_sessions
          set revoked_at = now()
          where revoked_at is null and expires_at <= now()
          returning id
        )
        select count(*)::int as total from changed
      `), steps),
      userSessions: await measureStep("expireUserSessions", () => countMutation(sql`
        with changed as (
          update user_sessions
          set revoked_at = now()
          where revoked_at is null and expires_at <= now()
          returning id
        )
        select count(*)::int as total from changed
      `), steps),
      qrJtiConsumptions: await measureStep("deleteExpiredQrJtiConsumptions", () => countMutation(sql`
        with changed as (
          delete from qr_jti_consumptions
          where expires_at < now() - interval '7 days'
          returning jti
        )
        select count(*)::int as total from changed
      `), steps),
      qrSigningKeys: await measureStep("expireQrSigningKeys", () => countMutation(sql`
        with changed as (
          update qr_signing_keys
          set status = 'expired'
          where status = 'rotated'
            and coalesce(expires_at, rotated_at + interval '7 days') <= now()
          returning kid
        )
        select count(*)::int as total from changed
      `), steps),
      userDeviceChallenges: await measureStep("deleteExpiredUserDeviceChallenges", () => countMutation(sql`
        with changed as (
          delete from user_device_challenges
          where used_at is not null
             or expires_at < now() - interval '1 day'
          returning id
        )
        select count(*)::int as total from changed
      `), steps)
    };

    workerMetrics.cycles += 1;
    return {
      skipped: false,
      autoExits,
      expired,
      durationMs: Number((performance.now() - cycleStart).toFixed(2)),
      steps
    };
  } catch (error) {
    workerMetrics.failures += 1;
    throw error;
  } finally {
    workerMetrics.running = false;
    workerMetrics.lastFinishedAt = new Date().toISOString();
    workerMetrics.lastDurationMs = Number((performance.now() - cycleStart).toFixed(2));
    workerMetrics.lastSteps = steps;
  }
}

export function getWorkerMetrics() {
  return {
    ...workerMetrics,
    lastSteps: workerMetrics.lastSteps.map((step) => ({ ...step }))
  };
}

async function main() {
  console.info("Control Acceso worker started");

  if (process.env.WORKER_RUN_ONCE === "true") {
    console.info(await runWorkerCycle());
    await closeDb();
    return;
  }

  await runWorkerCycle();
  setInterval(() => {
    runWorkerCycle().catch((error) => console.error("Worker cycle failed", error));
  }, env.WORKER_INTERVAL_MS);
}

if (import.meta.main) {
  main().catch(async (error) => {
    console.error(error);
    await closeDb();
    process.exit(1);
  });
}
