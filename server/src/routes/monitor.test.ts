import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildServer } from "../server.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import { createMultiUniverseCoordinator } from "../dmx/multi-universe-coordinator.js";
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

    ({ app } = await buildServer({
      config: createTestConfig(),
      manager,
      driver: "null",
      startTime: Date.now(),
      fixtureStore: createTestFixtureStore(),
      oflClient: createMockOflClient(),
      registry: createMockRegistry(),
      dmxMonitor: monitor,
    }));
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

      const { app: appWithFixtures } = await buildServer({
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

  describe("universe-aware endpoints", () => {
    it("snapshot returns data for specified universeId", async () => {
      const mockA = createMockUniverse();
      const mockB = createMockUniverse();
      const managerA = createUniverseManager(mockA);
      const managerB = createUniverseManager(mockB);

      const managers = new Map<string, UniverseManager>([
        ["uni-a", managerA],
        ["uni-b", managerB],
      ]);
      const coordinator = createMultiUniverseCoordinator(() => managers);
      const monitor = createDmxMonitor({ coordinator });

      managerA.applyFixtureUpdate({ fixture: "par", channels: { "1": 111 } });
      managerB.applyFixtureUpdate({ fixture: "mover", channels: { "40": 222 } });

      const { app: uniApp } = await buildServer({
        config: createTestConfig(),
        manager,
        driver: "null",
        startTime: Date.now(),
        fixtureStore: createTestFixtureStore(),
        oflClient: createMockOflClient(),
        registry: createMockRegistry(),
        dmxMonitor: monitor,
      });

      const resA = await uniApp.inject({
        method: "GET",
        url: "/api/dmx/snapshot?universeId=uni-a",
      });
      expect(resA.json().universeId).toBe("uni-a");
      expect(resA.json().channels["1"]).toBe(111);
      expect(resA.json().channels["40"]).toBeUndefined();

      const resB = await uniApp.inject({
        method: "GET",
        url: "/api/dmx/snapshot?universeId=uni-b",
      });
      expect(resB.json().universeId).toBe("uni-b");
      expect(resB.json().channels["40"]).toBe(222);

      await uniApp.close();
    });

    it("SSE stream returns frames for specified universeId", async () => {
      const mockA = createMockUniverse();
      const managerA = createUniverseManager(mockA);

      const managers = new Map<string, UniverseManager>([
        ["uni-a", managerA],
      ]);
      const coordinator = createMultiUniverseCoordinator(() => managers);
      const monitor = createDmxMonitor({ coordinator });

      managerA.applyFixtureUpdate({ fixture: "par", channels: { "5": 55 } });

      const { app: uniApp } = await buildServer({
        config: createTestConfig(),
        manager,
        driver: "null",
        startTime: Date.now(),
        fixtureStore: createTestFixtureStore(),
        oflClient: createMockOflClient(),
        registry: createMockRegistry(),
        dmxMonitor: monitor,
      });

      const res = await uniApp.inject({
        method: "GET",
        url: "/api/dmx/monitor?universeId=uni-a",
      });

      const lines = res.payload.split("\n");
      const dataLine = lines.find((l: string) => l.startsWith("data:"));
      const frame = JSON.parse(dataLine!.replace("data:", "").trim());
      expect(frame.universeId).toBe("uni-a");
      expect(frame.channels["5"]).toBe(55);

      await uniApp.close();
    });

    it("grouped snapshot filters fixtures by universeId", async () => {
      const mockA = createMockUniverse();
      const managerA = createUniverseManager(mockA);

      const managers = new Map<string, UniverseManager>([
        ["uni-a", managerA],
      ]);
      const coordinator = createMultiUniverseCoordinator(() => managers);
      const monitor = createDmxMonitor({ coordinator });
      const store = createTestFixtureStore();

      const { app: uniApp } = await buildServer({
        config: createTestConfig(),
        manager,
        driver: "null",
        startTime: Date.now(),
        fixtureStore: store,
        oflClient: createMockOflClient(),
        registry: createMockRegistry(),
        dmxMonitor: monitor,
      });

      // Add two fixtures: one on uni-a, one on default
      await uniApp.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "PAR on A",
          universeId: "uni-a",
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

      await uniApp.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "PAR on Default",
          mode: "3ch",
          dmxStartAddress: 10,
          channelCount: 3,
          channels: [
            { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
            { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
            { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
          ],
        },
      });

      const res = await uniApp.inject({
        method: "GET",
        url: "/api/dmx/snapshot?grouped=true&universeId=uni-a",
      });

      const body = res.json();
      expect(body.universeId).toBe("uni-a");
      expect(body.fixtures).toHaveLength(1);
      expect(body.fixtures[0].name).toBe("PAR on A");

      await uniApp.close();
    });
  });

  describe("route not registered without monitor", () => {
    it("returns 404 when dmxMonitor is not provided", async () => {
      const { app: appNoMonitor } = await buildServer({
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
