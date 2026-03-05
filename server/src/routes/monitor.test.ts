import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildServer } from "../server.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import { createDmxMonitor } from "../dmx/dmx-monitor.js";
import {
  createMockUniverse,
  createTestConfig,
  createTestFixtureStore,
  createMockOflClient,
  createMockRegistry,
} from "../test-helpers.js";
import type { FastifyInstance } from "fastify";
import type { UniverseManager } from "../dmx/universe-manager.js";

describe("Monitor routes", () => {
  let app: FastifyInstance;
  let mockUniverse: ReturnType<typeof createMockUniverse>;
  let manager: UniverseManager;

  beforeEach(async () => {
    mockUniverse = createMockUniverse();
    manager = createUniverseManager(mockUniverse);
    const monitor = createDmxMonitor({ manager });

    app = await buildServer({
      config: createTestConfig(),
      manager,
      driver: "null",
      startTime: Date.now(),
      fixtureStore: createTestFixtureStore(),
      oflClient: createMockOflClient(),
      registry: createMockRegistry(),
      dmxMonitor: monitor,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/dmx/snapshot", () => {
    it("returns current DMX channel state as JSON", async () => {
      manager.applyFixtureUpdate({ fixture: "par", channels: { "1": 128, "2": 64, "3": 200 } });

      const res = await app.inject({
        method: "GET",
        url: "/api/dmx/snapshot",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.universeId).toBe("default");
      expect(body.channels["1"]).toBe(128);
      expect(body.channels["2"]).toBe(64);
      expect(body.channels["3"]).toBe(200);
      expect(body.blackoutActive).toBe(false);
      expect(body.activeChannelCount).toBe(3);
      expect(body.timestamp).toBeTypeOf("number");
    });

    it("returns empty channels when nothing is active", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/dmx/snapshot",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.activeChannelCount).toBe(0);
      expect(Object.keys(body.channels)).toHaveLength(0);
    });

    it("reflects blackout state", async () => {
      manager.applyFixtureUpdate({ fixture: "par", channels: { "1": 255 } });
      manager.blackout();

      const res = await app.inject({
        method: "GET",
        url: "/api/dmx/snapshot",
      });

      expect(res.json().blackoutActive).toBe(true);
    });
  });

  describe("GET /api/dmx/snapshot?grouped=true", () => {
    it("includes fixture groupings alongside channel data", async () => {
      // Add a fixture to the store first
      const store = createTestFixtureStore();
      const monitor = createDmxMonitor({ manager });

      const appWithFixtures = await buildServer({
        config: createTestConfig(),
        manager,
        driver: "null",
        startTime: Date.now(),
        fixtureStore: store,
        oflClient: createMockOflClient(),
        registry: createMockRegistry(),
        dmxMonitor: monitor,
      });

      // Add a fixture via the API
      await appWithFixtures.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "Test PAR",
          mode: "3ch",
          dmxStartAddress: 1,
          channelCount: 3,
          channels: [
            { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
            { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
            { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
          ],
        },
      });

      manager.applyFixtureUpdate({ fixture: "par", channels: { "1": 255, "2": 128, "3": 64 } });

      const res = await appWithFixtures.inject({
        method: "GET",
        url: "/api/dmx/snapshot?grouped=true",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.fixtures).toBeDefined();
      expect(body.fixtures).toHaveLength(1);
      expect(body.fixtures[0].name).toBe("Test PAR");
      expect(body.fixtures[0].dmxStartAddress).toBe(1);
      expect(body.fixtures[0].channels).toHaveLength(3);
      expect(body.fixtures[0].channels[0]).toMatchObject({
        offset: 0,
        name: "Red",
        dmxAddress: 1,
        value: 255,
      });

      await appWithFixtures.close();
    });
  });

  describe("GET /api/dmx/monitor (SSE)", () => {
    it("returns correct SSE headers", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/dmx/monitor",
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("text/event-stream");
      expect(res.headers["cache-control"]).toBe("no-cache");
      expect(res.headers["connection"]).toBe("keep-alive");
    });

    it("sends initial snapshot as first SSE frame", async () => {
      manager.applyFixtureUpdate({ fixture: "par", channels: { "10": 42 } });

      const res = await app.inject({
        method: "GET",
        url: "/api/dmx/monitor",
      });

      const lines = res.payload.split("\n");
      const dataLine = lines.find((l: string) => l.startsWith("data:"));
      expect(dataLine).toBeDefined();

      const frame = JSON.parse(dataLine!.replace("data:", "").trim());
      expect(frame.channels["10"]).toBe(42);
      expect(frame.universeId).toBe("default");
    });
  });

  describe("route not registered without monitor", () => {
    it("returns 404 when dmxMonitor is not provided", async () => {
      const appNoMonitor = await buildServer({
        config: createTestConfig(),
        manager,
        driver: "null",
        startTime: Date.now(),
        fixtureStore: createTestFixtureStore(),
        oflClient: createMockOflClient(),
        registry: createMockRegistry(),
      });

      const res = await appNoMonitor.inject({
        method: "GET",
        url: "/api/dmx/snapshot",
      });

      expect(res.statusCode).toBe(404);

      await appNoMonitor.close();
    });
  });
});
