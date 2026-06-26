import { sql } from "drizzle-orm";
import { writeJson, performanceOutputPath } from "./stats";

if (process.env.PERF_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.PERF_DATABASE_URL;
}

const profiles = {
  small: { people: 1_000, accessRecords: 10_000 },
  medium: { people: 10_000, accessRecords: 250_000 },
  large: { people: 100_000, accessRecords: 2_000_000 }
} as const;

type ProfileName = keyof typeof profiles;

function numberFromEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${name} must be a positive number.`);
  return Math.floor(parsed);
}

async function rechainRemainingAccessHashes(db: Awaited<typeof import("../db/client")>["db"]) {
  await db.execute(sql`ALTER TABLE registros_acceso DISABLE TRIGGER registros_acceso_hash_chain_assign`);
  try {
    await db.execute(sql`
      DO $$
      DECLARE
        v_row record;
        v_previous text := NULL;
      BEGIN
        FOR v_row IN
          SELECT id, person_id, vehicle_id, entrada_at
          FROM registros_acceso
          WHERE hash_registro IS NOT NULL
          ORDER BY entrada_at ASC, id ASC
        LOOP
          UPDATE registros_acceso
          SET
            hash_anterior = v_previous,
            hash_registro = encode(digest(concat_ws(
              '|',
              v_row.id::text,
              coalesce(v_row.person_id::text, ''),
              coalesce(v_row.vehicle_id::text, ''),
              v_row.entrada_at::text,
              coalesce(v_previous, '')
            ), 'sha256'), 'hex')
          WHERE id = v_row.id;

          SELECT hash_registro
          INTO v_previous
          FROM registros_acceso
          WHERE id = v_row.id;
        END LOOP;
      END;
      $$
    `);
  } finally {
    await db.execute(sql`ALTER TABLE registros_acceso ENABLE TRIGGER registros_acceso_hash_chain_assign`);
  }
}

async function main() {
  const { db, closeDb } = await import("../db/client");
  const profileName = (process.env.PERF_DATASET ?? "small") as ProfileName;
  const selected = profiles[profileName] ?? profiles.small;
  const people = numberFromEnv("PERF_PEOPLE", selected.people);
  const accessRecords = numberFromEnv("PERF_ACCESS_RECORDS", selected.accessRecords);
  const adminUsername = process.env.PERF_ADMIN_USERNAME ?? "perf_admin";
  const adminPassword = process.env.PERF_ADMIN_PASSWORD ?? "Perf123!";
  const reset = process.env.PERF_RESET === "true";

  const startedAt = new Date().toISOString();
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await db.execute(sql`
    INSERT INTO person_types (
      code, label, requires_career, generates_attendance, can_have_user_portal,
      can_have_vehicle_permit, active
    )
    VALUES ('estudiante', 'Estudiante', true, true, true, true, true)
    ON CONFLICT (code) DO NOTHING
  `);
  await db.execute(sql`
    INSERT INTO carreras (clave, nombre, active)
    VALUES ('PERF', 'Dataset de performance', true)
    ON CONFLICT (clave) DO UPDATE SET nombre = excluded.nombre, active = true
  `);

  if (reset) {
    await db.execute(sql`DELETE FROM access_scan_events WHERE metadata->>'perf' = 'true'`);
    await db.execute(sql`
      DELETE FROM access_scan_events
      WHERE person_id IN (SELECT id FROM personas WHERE matricula LIKE 'PERF-%')
         OR registro_acceso_id IN (SELECT id FROM registros_acceso WHERE metadata->>'perf' = 'true')
    `);
    await db.execute(sql`
      DELETE FROM asistencias_potenciales
      WHERE person_id IN (SELECT id FROM personas WHERE matricula LIKE 'PERF-%')
         OR registro_acceso_id IN (SELECT id FROM registros_acceso WHERE metadata->>'perf' = 'true')
    `);
    await db.execute(sql`
      DELETE FROM registros_acceso
      WHERE metadata->>'perf' = 'true'
         OR person_id IN (SELECT id FROM personas WHERE matricula LIKE 'PERF-%')
    `);
    await db.execute(sql`DELETE FROM qr_tokens WHERE person_id IN (SELECT id FROM personas WHERE matricula LIKE 'PERF-%')`);
    await db.execute(sql`DELETE FROM personas WHERE matricula LIKE 'PERF-%'`);
    await rechainRemainingAccessHashes(db);
  }

  const passwordHash = await Bun.password.hash(adminPassword, { algorithm: "bcrypt", cost: 10 });
  await db.execute(sql`
    INSERT INTO administradores (username, display_name, password_hash, role, status, must_change_password)
    VALUES (${adminUsername}, 'Performance Admin', ${passwordHash}, 'super_admin', 'active', false)
    ON CONFLICT (username) DO UPDATE SET
      password_hash = excluded.password_hash,
      status = 'active',
      must_change_password = false,
      updated_at = now()
  `);

  await db.execute(sql`
    WITH career AS (
      SELECT id FROM carreras WHERE clave = 'PERF' LIMIT 1
    )
    INSERT INTO personas (matricula, nombres, apellidos, tipo_persona, estado, carrera_id, notas)
    SELECT
      'PERF-' || lpad(n::text, 6, '0'),
      'Perf',
      'Persona ' || n::text,
      'estudiante',
      'activo',
      career.id,
      'Registro sintetico para pruebas de performance'
    FROM generate_series(1, ${people}) AS series(n)
    CROSS JOIN career
    ON CONFLICT (matricula) DO NOTHING
  `);

  await db.execute(sql`
    WITH perf_people AS (
      SELECT id, matricula, row_number() OVER (ORDER BY matricula) AS rn
      FROM personas
      WHERE matricula LIKE 'PERF-%'
      ORDER BY matricula
      LIMIT ${people}
    ),
    existing AS (
      SELECT count(*)::int AS total
      FROM registros_acceso
      WHERE metadata->>'perf' = 'true'
    ),
    wanted AS (
      SELECT greatest(0, ${accessRecords} - existing.total)::int AS missing
      FROM existing
    ),
    selected AS (
      SELECT
        perf_people.id,
        perf_people.matricula,
        generated.n + (SELECT total FROM existing) AS n
      FROM wanted
      CROSS JOIN generate_series(1, wanted.missing) AS generated(n)
      INNER JOIN perf_people
        ON perf_people.rn = (((generated.n - 1) % greatest(1, ${people})) + 1)
    )
    INSERT INTO registros_acceso (
      person_id, matricula_legacy, entrada_at, salida_at, status, access_mode,
      subject_type, credential_type, credential_origin, metadata
    )
    SELECT
      id,
      matricula,
      now() - ((n % 90)::text || ' days')::interval - ((n % 86400)::text || ' seconds')::interval,
      now() - ((n % 90)::text || ' days')::interval - ((n % 86400)::text || ' seconds')::interval + interval '35 minutes',
      'completed',
      'pedestrian',
      'person',
      'manual_override',
      'perf_seed',
      jsonb_build_object('perf', true, 'n', n)
    FROM selected
  `);

  await db.execute(sql`
    WITH perf_people AS (
      SELECT id, row_number() OVER (ORDER BY matricula) AS rn
      FROM personas
      WHERE matricula LIKE 'PERF-%'
      ORDER BY matricula
      LIMIT least(${people}, 1000)
    )
    INSERT INTO qr_tokens (person_id, token_hash, status, expires_at)
    SELECT
      id,
      encode(digest('perf-token-' || rn::text, 'sha256'), 'hex'),
      'active',
      now() + interval '30 days'
    FROM perf_people
    ON CONFLICT (token_hash) DO NOTHING
  `);

  const [counts] = await db.execute<{
    people: number;
    accessRecords: number;
    qrTokens: number;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM personas WHERE matricula LIKE 'PERF-%') AS "people",
      (SELECT count(*)::int FROM registros_acceso WHERE metadata->>'perf' = 'true') AS "accessRecords",
      (SELECT count(*)::int FROM qr_tokens WHERE person_id IN (SELECT id FROM personas WHERE matricula LIKE 'PERF-%')) AS "qrTokens"
  `);

  const summary = {
    profile: profileName,
    requested: { people, accessRecords },
    actual: counts,
    admin: { username: adminUsername, passwordSource: process.env.PERF_ADMIN_PASSWORD ? "PERF_ADMIN_PASSWORD" : "default" },
    sample: { manualMatricula: "PERF-000001" },
    reset,
    startedAt,
    finishedAt: new Date().toISOString()
  };

  await writeJson(performanceOutputPath("perf-seed-summary.json"), summary);
  console.info(JSON.stringify(summary, null, 2));
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  const { closeDb } = await import("../db/client");
  await closeDb();
  process.exit(1);
});
