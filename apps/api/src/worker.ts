import { sql } from "drizzle-orm";
import { db, closeDb } from "./db/client";
import { runAutoExits } from "./modules/access/access.repository";

const intervalMs = 60_000;

export async function runWorkerCycle() {
  const autoExits = await runAutoExits();

  const [expired] = await db.execute<{
    hotQr: number;
    temporaryDailyQr: number;
    vehiclePermitQr: number;
    personQr: number;
    sessions: number;
  }>(sql`
    with hot_qr as (
      update hot_qr_tokens
      set status = 'expired'
      where status = 'active' and valid_until <= now()
      returning id
    ),
    temporary_daily_qr as (
      update temporary_daily_qr_tokens
      set status = 'expired'
      where status = 'active' and valid_until <= now()
      returning id
    ),
    vehicle_permit_qr as (
      update vehicle_permit_qr_tokens
      set status = 'expired'
      where status = 'active' and expires_at <= now()
      returning id
    ),
    person_qr as (
      update qr_tokens
      set status = 'expired'
      where status = 'active' and expires_at <= now()
      returning id
    ),
    sessions as (
      update admin_sessions
      set revoked_at = now()
      where revoked_at is null and expires_at <= now()
      returning id
    )
    select
      (select count(*)::int from hot_qr) as "hotQr",
      (select count(*)::int from temporary_daily_qr) as "temporaryDailyQr",
      (select count(*)::int from vehicle_permit_qr) as "vehiclePermitQr",
      (select count(*)::int from person_qr) as "personQr",
      (select count(*)::int from sessions) as "sessions"
  `);

  return {
    autoExits,
    expired
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
  }, intervalMs);
}

if (import.meta.main) {
  main().catch(async (error) => {
    console.error(error);
    await closeDb();
    process.exit(1);
  });
}
