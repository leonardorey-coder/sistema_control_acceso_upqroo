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
    userSessions: number;
    qrJtiConsumptions: number;
    qrSigningKeys: number;
    userDeviceChallenges: number;
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
    ),
    user_sessions_expired as (
      update user_sessions
      set revoked_at = now()
      where revoked_at is null and expires_at <= now()
      returning id
    ),
    qr_jti_consumptions_expired as (
      delete from qr_jti_consumptions
      where expires_at < now() - interval '7 days'
      returning jti
    ),
    qr_signing_keys_expired as (
      update qr_signing_keys
      set status = 'expired'
      where status = 'rotated'
        and coalesce(expires_at, rotated_at + interval '7 days') <= now()
      returning kid
    ),
    user_device_challenges_expired as (
      delete from user_device_challenges
      where used_at is not null
         or expires_at < now() - interval '1 day'
      returning id
    )
    select
      (select count(*)::int from hot_qr) as "hotQr",
      (select count(*)::int from temporary_daily_qr) as "temporaryDailyQr",
      (select count(*)::int from vehicle_permit_qr) as "vehiclePermitQr",
      (select count(*)::int from person_qr) as "personQr",
      (select count(*)::int from sessions) as "sessions",
      (select count(*)::int from user_sessions_expired) as "userSessions",
      (select count(*)::int from qr_jti_consumptions_expired) as "qrJtiConsumptions",
      (select count(*)::int from qr_signing_keys_expired) as "qrSigningKeys",
      (select count(*)::int from user_device_challenges_expired) as "userDeviceChallenges"
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
