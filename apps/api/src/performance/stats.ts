import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

export type LatencySample = {
  target: string;
  ok: boolean;
  status?: number;
  durationMs: number;
  serverDurationMs?: number;
  bytes?: number;
  error?: string;
};

export type TargetSummary = {
  target: string;
  samples: number;
  ok: number;
  errors: number;
  errorRate: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  avgMs: number;
  requestsPerSecond: number;
  bytes: number;
};

function round(value: number) {
  return Number(value.toFixed(2));
}

export function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

export function summarizeSamples(samples: LatencySample[], durationSeconds: number) {
  const byTarget = new Map<string, LatencySample[]>();

  for (const sample of samples) {
    const group = byTarget.get(sample.target) ?? [];
    group.push(sample);
    byTarget.set(sample.target, group);
  }

  return [...byTarget.entries()].map<TargetSummary>(([target, group]) => {
    const durations = group.map((sample) => sample.durationMs);
    const ok = group.filter((sample) => sample.ok).length;
    const bytes = group.reduce((total, sample) => total + (sample.bytes ?? 0), 0);
    const totalDuration = durations.reduce((total, value) => total + value, 0);

    return {
      target,
      samples: group.length,
      ok,
      errors: group.length - ok,
      errorRate: round(group.length ? (group.length - ok) / group.length : 0),
      minMs: round(Math.min(...durations)),
      p50Ms: round(percentile(durations, 50)),
      p95Ms: round(percentile(durations, 95)),
      p99Ms: round(percentile(durations, 99)),
      maxMs: round(Math.max(...durations)),
      avgMs: round(group.length ? totalDuration / group.length : 0),
      requestsPerSecond: round(durationSeconds > 0 ? group.length / durationSeconds : 0),
      bytes
    };
  }).sort((a, b) => b.p95Ms - a.p95Ms);
}

export async function writeJson(path: string, payload: unknown) {
  const outputPath = resolvePerformancePath(path);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
}

export async function readJsonIfExists<T>(path: string) {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function listJsonFiles(directory: string) {
  try {
    const files = await readdir(directory);
    return files.filter((file) => file.endsWith(".json")).map((file) => join(directory, file));
  } catch {
    return [];
  }
}

export function performanceOutputPath(filename: string) {
  return join(workspaceRoot(), "docs", "performance", filename);
}

export function resolvePerformancePath(path: string) {
  return isAbsolute(path) ? path : resolve(workspaceRoot(), path);
}

function workspaceRoot() {
  const cwd = process.cwd();
  if (basename(cwd) === "api" && basename(dirname(cwd)) === "apps") {
    return dirname(dirname(cwd));
  }

  return cwd;
}
