import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getEventMetrics, resetEventMetricsForTests, broadcastEvent } from "../src/modules/events/events";
import { percentile, summarizeSamples } from "../src/performance/stats";

describe("performance utilities", () => {
  it("calculates percentiles and target summaries", () => {
    expect(percentile([10, 20, 30, 40], 95)).toBe(40);

    const summary = summarizeSamples([
      { target: "scan", ok: true, durationMs: 10, bytes: 100 },
      { target: "scan", ok: true, durationMs: 20, bytes: 100 },
      { target: "scan", ok: false, durationMs: 100, bytes: 50 }
    ], 10);

    expect(summary[0]).toMatchObject({
      target: "scan",
      samples: 3,
      ok: 2,
      errors: 1,
      errorRate: 0.33,
      p95Ms: 100,
      requestsPerSecond: 0.3,
      bytes: 250
    });
  });

  it("coalesces repeated table events for measurable websocket pressure", () => {
    resetEventMetricsForTests();

    broadcastEvent("access.table", {});
    broadcastEvent("access.table", {});
    broadcastEvent("attendance.table", {});

    const metrics = getEventMetrics();
    expect(metrics.messagesQueued).toBe(2);
    expect(metrics.messagesCoalesced).toBe(1);
    expect(metrics.pendingTopics).toBe(2);

    resetEventMetricsForTests();
  });

  it("keeps worker cycles guarded against overlap", () => {
    const workerSource = readFileSync(join(import.meta.dir, "../src/worker.ts"), "utf8");

    expect(workerSource).toContain("WORKER_CYCLE_ALREADY_RUNNING");
    expect(workerSource).toContain("skippedOverlaps");
    expect(workerSource).toContain("workerMetrics.running = true");
    expect(workerSource).toContain("workerMetrics.running = false");
  });
});
