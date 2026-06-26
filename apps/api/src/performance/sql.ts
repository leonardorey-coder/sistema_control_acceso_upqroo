import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { performanceOutputPath, writeJson } from "./stats";

if (process.env.PERF_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.PERF_DATABASE_URL;
}

type SqlPlanTarget = {
  name: string;
  statement: string;
  mutates?: boolean;
};

const operationalDate = process.env.PERF_OPERATIONAL_DATE ?? new Date().toISOString().slice(0, 10);
const allowMutatingAnalyze = process.env.PERF_ALLOW_MUTATING_SQL_ANALYZE === "true";

const targets: SqlPlanTarget[] = [
  {
    name: "access-today",
    statement: `
      SELECT r.id, r.entrada_at, r.salida_at, r.status, r.access_mode, p.matricula
      FROM registros_acceso r
      LEFT JOIN personas p ON p.id = r.person_id
      WHERE r.entrada_at >= '${operationalDate} 00:00:00-05'::timestamptz
        AND r.entrada_at <= '${operationalDate} 23:59:59.999-05'::timestamptz
      ORDER BY r.entrada_at DESC
      LIMIT 25
    `
  },
  {
    name: "access-search",
    statement: `
      SELECT r.id, r.entrada_at, p.matricula, p.nombres, p.apellidos
      FROM registros_acceso r
      LEFT JOIN personas p ON p.id = r.person_id
      LEFT JOIN vehicles v ON v.id = r.vehicle_id
      WHERE r.entrada_at >= '${operationalDate} 00:00:00-05'::timestamptz
        AND r.entrada_at <= '${operationalDate} 23:59:59.999-05'::timestamptz
        AND (p.matricula ILIKE '%PERF%' OR p.nombres ILIKE '%PERF%' OR p.apellidos ILIKE '%PERF%' OR v.plate ILIKE '%PERF%')
      ORDER BY r.entrada_at DESC
      LIMIT 25
    `
  },
  {
    name: "attendance-today",
    statement: `
      SELECT ap.id, ap.fecha_clase, ap.estado, p.matricula, s.clave
      FROM asistencias_potenciales ap
      INNER JOIN personas p ON p.id = ap.person_id
      LEFT JOIN subjects s ON s.id = ap.subject_id
      WHERE ap.fecha_clase = '${operationalDate}'::date
      ORDER BY ap.hora_inicio ASC, p.apellidos ASC, p.nombres ASC
      LIMIT 25
    `
  },
  {
    name: "people-search",
    statement: `
      SELECT id, matricula, nombres, apellidos
      FROM personas
      WHERE matricula ILIKE '%PERF%' OR nombres ILIKE '%PERF%' OR apellidos ILIKE '%PERF%' OR curp ILIKE '%PERF%'
      ORDER BY apellidos ASC, nombres ASC, matricula ASC
      LIMIT 25
    `
  },
  {
    name: "vehicle-search",
    statement: `
      SELECT id, plate, make, model, color
      FROM vehicles
      WHERE plate ILIKE '%PERF%' OR make ILIKE '%PERF%' OR model ILIKE '%PERF%' OR color ILIKE '%PERF%'
      ORDER BY plate ASC
      LIMIT 25
    `
  },
  {
    name: "access-scan-manual-plan-only",
    mutates: true,
    statement: `
      SELECT access_scan_v1('{"manualMatricula":"PERF-000001","scannerId":"perf-sql"}'::jsonb)
    `
  }
];

function explainPrefix(target: SqlPlanTarget) {
  if (target.mutates && !allowMutatingAnalyze) {
    return "EXPLAIN (FORMAT JSON)";
  }

  return "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)";
}

async function main() {
  const { db, closeDb } = await import("../db/client");
  const outputDir = performanceOutputPath("sql-plans");
  await mkdir(outputDir, { recursive: true });
  const summaries = [];

  for (const target of targets) {
    const explain = `${explainPrefix(target)} ${target.statement}`;
    const started = performance.now();
    const result = await db.execute(sql.raw(explain));
    const durationMs = Number((performance.now() - started).toFixed(2));
    const plan = result[0] ?? {};
    const payload = {
      name: target.name,
      mutates: Boolean(target.mutates),
      analyzeExecuted: !(target.mutates && !allowMutatingAnalyze),
      durationMs,
      generatedAt: new Date().toISOString(),
      statement: target.statement.trim(),
      plan
    };
    const path = join(outputDir, `${target.name}.json`);
    await writeJson(path, payload);
    summaries.push({ name: target.name, durationMs, path });
  }

  await writeJson(performanceOutputPath("sql-summary.json"), {
    kind: "sql",
    allowMutatingAnalyze,
    operationalDate,
    generatedAt: new Date().toISOString(),
    summaries
  });
  console.info(JSON.stringify(summaries, null, 2));
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  const { closeDb } = await import("../db/client");
  await closeDb();
  process.exit(1);
});
