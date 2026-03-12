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

    // Seed known latency data for precise assertions
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
    it("returns JSON metrics with correct structure and non-zero values", async () => {
      const res = await app.inject({ method: "GET", url: "/metrics" });
      expect(res.statusCode).toBe(200);
      const body = res.json();

      // Verify structure
      expect(body.latency).toBeDefined();
      expect(body.latency.network).toHaveProperty("avg");
      expect(body.latency.network).toHaveProperty("p95");
      expect(body.latency.network).toHaveProperty("p99");
      expect(body.latency.network).toHaveProperty("count");

      // Verify network count matches the 2 recordings we seeded
      expect(body.latency.network.count).toBe(2);

      // Verify avg is the average of 1.5 and 2.0
      expect(body.latency.network.avg).toBeCloseTo(1.75, 1);
    });

    it("returns null udp stats when no UDP server provided", async () => {
      const res = await app.inject({ method: "GET", url: "/metrics" });
      const body = res.json();
      expect(body.udp).toBeNull();
    });
  });

  describe("GET /metrics/prometheus", () => {
    it("returns Prometheus text format with correct structure", async () => {
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

    it("active fixtures gauge shows 0 when no fixtures seeded", async () => {
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

    it("converts ms to seconds correctly (p95 of 1.5ms and 2.0ms ≈ 0.002s)", async () => {
      const res = await app.inject({ method: "GET", url: "/metrics/prometheus" });
      const body = res.body;

      // With 2 samples [1.5, 2.0], p95 index = floor(2 * 0.95) = 1, so p95 = 2.0ms = 0.002000s
      const p95Match = body.match(/dmxr_network_latency_seconds\{quantile="0\.95"\} ([\d.]+)/);
      expect(p95Match).toBeTruthy();
      const p95Value = parseFloat(p95Match![1]);
      expect(p95Value).toBeCloseTo(0.002, 4);

      // p99 index = floor(2 * 0.99) = 1, so p99 = 2.0ms = 0.002000s
      const p99Match = body.match(/dmxr_network_latency_seconds\{quantile="0\.99"\} ([\d.]+)/);
      expect(p99Match).toBeTruthy();
      const p99Value = parseFloat(p99Match![1]);
      expect(p99Value).toBeCloseTo(0.002, 4);
    });

    it("network latency count line matches seeded count", async () => {
      const res = await app.inject({ method: "GET", url: "/metrics/prometheus" });
      const body = res.body;

      const countMatch = body.match(/dmxr_network_latency_seconds_count (\d+)/);
      expect(countMatch).toBeTruthy();
      expect(parseInt(countMatch![1], 10)).toBe(2);
    });

    it("ends with a newline", async () => {
      const res = await app.inject({ method: "GET", url: "/metrics/prometheus" });
      expect(res.body.endsWith("\n")).toBe(true);
    });
  });

  describe("GET /metrics/prometheus (with fixtures seeded)", () => {
    it("active fixtures gauge reflects actual fixture count", async () => {
      // Add 3 fixtures via API
      for (let i = 0; i < 3; i++) {
        await app.inject({
          method: "POST",
          url: "/fixtures",
          payload: {
            name: `Fixture ${i}`,
            oflKey: "test/test",
            oflFixtureName: "Test",
            mode: "3ch",
            dmxStartAddress: 1 + i * 10,
            channelCount: 3,
            channels: [
              { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
              { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
              { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
            ],
          },
        });
      }

      const res = await app.inject({ method: "GET", url: "/metrics/prometheus" });
      const body = res.body;
      expect(body).toContain("dmxr_active_fixtures 3");
    });
  });
});
