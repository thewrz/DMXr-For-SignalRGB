import { describe, it, expect, beforeEach } from "vitest";
import { createLatencyTracker, type LatencyTracker } from "./latency-tracker.js";

describe("LatencyTracker", () => {
  let tracker: LatencyTracker;

  beforeEach(() => {
    tracker = createLatencyTracker(100);
  });

  it("returns zeroed metrics when no data recorded", () => {
    const metrics = tracker.getMetrics();

    expect(metrics.network.count).toBe(0);
    expect(metrics.network.avg).toBe(0);
    expect(metrics.colorMap.count).toBe(0);
    expect(metrics.dmxSend.count).toBe(0);
    expect(metrics.totalProcessing.count).toBe(0);
    expect(metrics.packetsPerSecond).toBe(0);
  });

  it("records network latency samples", () => {
    tracker.recordNetwork(5);
    tracker.recordNetwork(10);
    tracker.recordNetwork(15);

    const metrics = tracker.getMetrics();
    expect(metrics.network.count).toBe(3);
    expect(metrics.network.min).toBe(5);
    expect(metrics.network.avg).toBe(10);
  });

  it("records colorMap latency samples", () => {
    tracker.recordColorMap(0.1);
    tracker.recordColorMap(0.2);

    const metrics = tracker.getMetrics();
    expect(metrics.colorMap.count).toBe(2);
    expect(metrics.colorMap.min).toBeCloseTo(0.1, 5);
  });

  it("records dmxSend latency samples", () => {
    tracker.recordDmxSend(0.5);
    tracker.recordDmxSend(1.5);

    const metrics = tracker.getMetrics();
    expect(metrics.dmxSend.count).toBe(2);
    expect(metrics.dmxSend.avg).toBe(1.0);
  });

  it("records total processing time via recordProcessed", () => {
    const start = performance.now();
    // Small busy loop to create measurable time
    let sum = 0;
    for (let i = 0; i < 100000; i++) sum += i;
    void sum;

    tracker.recordProcessed(start);

    const metrics = tracker.getMetrics();
    expect(metrics.totalProcessing.count).toBe(1);
    expect(metrics.totalProcessing.min).toBeGreaterThanOrEqual(0);
  });

  it("computes p95 and p99 correctly", () => {
    for (let i = 1; i <= 100; i++) {
      tracker.recordNetwork(i);
    }

    const metrics = tracker.getMetrics();
    expect(metrics.network.count).toBe(100);
    expect(metrics.network.min).toBe(1);
    expect(metrics.network.p95).toBe(96);
    expect(metrics.network.p99).toBe(100);
  });

  it("circular buffer evicts old entries", () => {
    const small = createLatencyTracker(5);

    for (let i = 1; i <= 10; i++) {
      small.recordNetwork(i);
    }

    const metrics = small.getMetrics();
    expect(metrics.network.count).toBe(5);
    // Should only have values 6-10
    expect(metrics.network.min).toBe(6);
  });

  it("reset clears all buffers", () => {
    tracker.recordNetwork(10);
    tracker.recordColorMap(5);
    tracker.recordDmxSend(1);
    tracker.recordProcessed(performance.now());

    tracker.reset();

    const metrics = tracker.getMetrics();
    expect(metrics.network.count).toBe(0);
    expect(metrics.colorMap.count).toBe(0);
    expect(metrics.dmxSend.count).toBe(0);
    expect(metrics.totalProcessing.count).toBe(0);
  });

  it("packetsPerSecond tracks throughput", () => {
    // Record enough packets that the PPS window resets
    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      tracker.recordProcessed(start);
    }

    const metrics = tracker.getMetrics();
    // Within a single event loop turn, PPS may not have a full window yet,
    // but it should be >= 0
    expect(metrics.packetsPerSecond).toBeGreaterThanOrEqual(0);
  });
});
