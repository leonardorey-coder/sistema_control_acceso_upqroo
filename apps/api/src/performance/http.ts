import { performanceOutputPath, summarizeSamples, type LatencySample, writeJson } from "./stats";

type Target = {
  name: string;
  method: "GET" | "POST";
  path: string;
  body?: () => unknown;
};

const baseUrl = (process.env.PERF_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
const durationSeconds = Number(process.env.PERF_DURATION_SECONDS ?? 30);
const concurrency = Number(process.env.PERF_CONCURRENCY ?? 10);
const output = process.env.PERF_OUTPUT ?? performanceOutputPath("baseline.json");
const adminUsername = process.env.PERF_ADMIN_USERNAME ?? "perf_admin";
const adminPassword = process.env.PERF_ADMIN_PASSWORD ?? "Perf123!";
const manualMatricula = process.env.PERF_MANUAL_MATRICULA ?? "PERF-000001";
const manualPool = Math.max(1, Number(process.env.PERF_MANUAL_POOL ?? 100));
const includeSamples = process.env.PERF_INCLUDE_SAMPLES === "true";
let manualCursor = 0;

function nextManualMatricula() {
  if (manualPool === 1) return manualMatricula;
  manualCursor += 1;
  const sequence = ((manualCursor - 1) % manualPool) + 1;
  return `PERF-${sequence.toString().padStart(6, "0")}`;
}

const targets: Target[] = [
  { name: "access-scan-manual", method: "POST", path: "/api/v1/access/scan", body: () => ({ manualMatricula: nextManualMatricula(), scannerId: "perf-http" }) },
  { name: "access-today", method: "GET", path: "/api/v1/access/today?page=1&pageSize=25" },
  { name: "attendance-today", method: "GET", path: "/api/v1/attendance/today?page=1&pageSize=25" },
  { name: "people-search", method: "GET", path: "/api/v1/people?q=PERF&page=1&pageSize=25" },
  { name: "vehicles", method: "GET", path: "/api/v1/vehicles?page=1&pageSize=25" },
  { name: "health-metrics", method: "GET", path: "/health/metrics" }
];

function selectedTargets() {
  const raw = process.env.PERF_TARGETS;
  if (!raw) return targets;
  const selected = new Set(raw.split(",").map((name) => name.trim()).filter(Boolean));
  return targets.filter((target) => selected.has(target.name));
}

async function login() {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identity: adminUsername, password: adminPassword })
  });

  if (!response.ok) {
    throw new Error(`Perf login failed with ${response.status}. Run perf:seed or set PERF_ADMIN_USERNAME/PERF_ADMIN_PASSWORD.`);
  }

  return response.headers.get("set-cookie") ?? "";
}

async function measure(target: Target, cookie: string): Promise<LatencySample> {
  const started = performance.now();
  try {
    const init: RequestInit = {
      method: target.method,
      headers: {
        cookie,
        "content-type": "application/json"
      }
    };
    if (target.body) init.body = JSON.stringify(target.body());

    const response = await fetch(`${baseUrl}${target.path}`, {
      ...init
    });
    const body = await response.text();
    const durationMs = performance.now() - started;
    const serverDurationMs = Number(response.headers.get("x-response-time-ms") ?? "NaN");
    const sample: LatencySample = {
      target: target.name,
      ok: response.ok,
      status: response.status,
      durationMs,
      bytes: body.length
    };

    if (Number.isFinite(serverDurationMs)) sample.serverDurationMs = serverDurationMs;
    return sample;
  } catch (error) {
    return {
      target: target.name,
      ok: false,
      durationMs: performance.now() - started,
      error: error instanceof Error ? error.message : "Unknown fetch error"
    };
  }
}

async function main() {
  const cookie = await login();
  const activeTargets = selectedTargets();
  if (!activeTargets.length) throw new Error("No PERF_TARGETS matched known targets.");

  const samples: LatencySample[] = [];
  const started = performance.now();
  const endAt = started + durationSeconds * 1000;
  let cursor = 0;

  async function worker() {
    while (performance.now() < endAt) {
      const target = activeTargets[cursor % activeTargets.length]!;
      cursor += 1;
      samples.push(await measure(target, cookie));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const actualDurationSeconds = (performance.now() - started) / 1000;
  const payload = {
    kind: "http",
    baseUrl,
    concurrency,
    manualPool,
    requestedDurationSeconds: durationSeconds,
    actualDurationSeconds: Number(actualDurationSeconds.toFixed(2)),
    targetCount: activeTargets.length,
    rawSamplesIncluded: includeSamples,
    rawSampleCount: samples.length,
    generatedAt: new Date().toISOString(),
    summary: summarizeSamples(samples, actualDurationSeconds),
    ...(includeSamples ? { samples } : {})
  };

  await writeJson(output, payload);
  console.info(JSON.stringify(payload.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
