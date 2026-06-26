import { performanceOutputPath, summarizeSamples, type LatencySample, writeJson } from "./stats";

if (process.env.PERF_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.PERF_DATABASE_URL;
}

async function main() {
  const { runWorkerCycle, getWorkerMetrics } = await import("../worker");
  const { closeDb } = await import("../db/client");
  const runs = Number(process.env.PERF_WORKER_RUNS ?? 5);
  const samples: LatencySample[] = [];
  const cycles = [];

  for (let index = 0; index < runs; index += 1) {
    const started = performance.now();
    try {
      const result = await runWorkerCycle();
      const durationMs = performance.now() - started;
      samples.push({ target: "worker-cycle", ok: !result.skipped, durationMs });
      cycles.push(result);
    } catch (error) {
      samples.push({
        target: "worker-cycle",
        ok: false,
        durationMs: performance.now() - started,
        error: error instanceof Error ? error.message : "Unknown worker error"
      });
    }
  }

  const payload = {
    kind: "worker",
    runs,
    generatedAt: new Date().toISOString(),
    summary: summarizeSamples(samples, samples.reduce((total, sample) => total + sample.durationMs, 0) / 1000),
    metrics: getWorkerMetrics(),
    cycles
  };

  await writeJson(process.env.PERF_OUTPUT ?? performanceOutputPath("worker-results.json"), payload);
  console.info(JSON.stringify(payload.summary, null, 2));
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  const { closeDb } = await import("../db/client");
  await closeDb();
  process.exit(1);
});
