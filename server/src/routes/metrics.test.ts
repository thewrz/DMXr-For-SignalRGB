import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildServer } from "../server.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import {
  createMockUniverse,
  createTestConfig,
  createTestFixtureStore,
  createMockOflClient,
  createMockRegistry,
} from "../test-helpers.js";
import { createLatencyTracker } from "../metrics/latency-tracker.js";
import type { FastifyInstance } from "fastify";
import type { FixtureStore } from "../fixtures/fixture-store.js";

describe("Metrics routes", () => {
  let app: FastifyInstance;
  let store: FixtureStore;

  beforeEach(async () => {
    const mockUniverse = createMockUniverse();
    const manager = createUniverseManager(mockUniverse);
    store = createTestFixtureStore();
    const latencyTracker = createLatencyTracker(100);

    // Seed some latency data
    latencyTracker.recordNetwork(1.5);
    latencyTracker.recordNetwork(2.0);
    latencyTracker.recordColorMap(0.5);
    latencyTracker.recordDmxSend(3.0);
    latencyTracker.recordProcessed(performance.now() - 5);

    ({ app } = await buildServer({
      config: createTestConfig(),
      manager,
      driver: "null",
      startTime: Date.now(),
      fixtureStore: store,
      oflClient: createMockOflClient(),
      registry: createMockRegistry(),
      latencyTracker,
    }));
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /metrics", () => {
    it("returns JSON metrics", async () => {
      const res = await app.inject({ method: "GET", url: "/metrics" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.latency).toBeDefined();
      expect(body.latency.network).toHaveProperty("avg");
      expect(body.latency.network).toHaveProperty("p95");
      expect(body.latency.network).toHaveProperty("p99");
      expect(body.latency.network).toHaveProperty("count");
    });

    it("returns null udp stats when no UDP server provided", async () => {
      const res = await app.inject({ method: "GET", url: "/metrics" });
      const body = res.json();
      expect(body.udp).toBeNull();
    });
  });

  describe("GET /metrics/prometheus", () => {
    it("returns Prometheus text format", async () => {
      const res = await app.inject({ method: "GET", url: "/metrics/prometheus" });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
      const body = res.body;
      expect(body).toContain("# HELP dmxr_network_latency_seconds");
      expect(body).toContain("# TYPE dmxr_network_latency_seconds summary");
      expect(body).toContain('dmxr_network_latency_seconds{quantile="0.95"}');
      expect(body).toContain('dmxr_network_latency_seconds{quantile="0.99"}');
    });

    it("includes all latency segments", async () => {
      const res = await app.inject({ method: "GET", url: "/metrics/prometheus" });
      const body = res.body;
      expect(body).toContain("dmxr_network_latency_seconds");
      expect(body).toContain("dmxr_color_map_latency_seconds");
      expect(body).toContain("dmxr_dmx_send_latency_seconds");
      expect(body).toContain("dmxr_total_processing_latency_seconds");
    });

    it("includes packets per second gauge", async () => {
      const res = await app.inject({ method: "GET", url: "/metrics/prometheus" });
      const body = res.body;
      expect(body).toContain("# TYPE dmxr_packets_per_second gauge");
      expect(body).toContain("dmxr_packets_per_second ");
    });

    it("includes active fixtures gauge", async () => {
      const res = await app.inject({ method: "GET", url: "/metrics/prometheus" });
      const body = res.body;
      expect(body).toContain("# TYPE dmxr_active_fixtures gauge");
      expect(body).toContain("dmxr_active_fixtures 0");
    });

    it("omits UDP stats when no UDP server provided", async () => {
      const res = await app.inject({ method: "GET", url: "/metrics/prometheus" });
      const body = res.body;
      expect(body).not.toContain("dmxr_udp_packets_received_total");
    });

    it("converts milliseconds to seconds in latency values", async () => {
      const res = await app.inject({ method: "GET", url: "/metrics/prometheus" });
      const body = res.body;
      // Network latency was recorded as 1.5ms and 2.0ms
      // p95 should be ~2.0ms = 0.002000 seconds
      const p95Match = body.match(/dmxr_network_latency_seconds\{quantile="0\.95"\} ([\d.]+)/);
      expect(p95Match).toBeTruthy();
      const p95Value = parseFloat(p95Match![1]);
      expect(p95Value).toBeLessThan(0.01); // less than 10ms in seconds
      expect(p95Value).toBeGreaterThan(0); // non-zero
    });

    it("ends with a newline", async () => {
      const res = await app.inject({ method: "GET", url: "/metrics/prometheus" });
      expect(res.body.endsWith("\n")).toBe(true);
    });
  });
});
