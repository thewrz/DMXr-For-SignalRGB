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
import type { FixtureStore } from "../fixtures/fixture-store.js";

describe("Fixture color routes", () => {
  let app: FastifyInstance;
  let manager: UniverseManager;
  let fixtureStore: FixtureStore;

  beforeEach(async () => {
    const mockUniverse = createMockUniverse();
    manager = createUniverseManager(mockUniverse);
    fixtureStore = createTestFixtureStore();

    const monitor = createDmxMonitor({ manager });

    app = await buildServer({
      config: createTestConfig(),
      manager,
      driver: "null",
      startTime: Date.now(),
      fixtureStore,
      oflClient: createMockOflClient(),
      registry: createMockRegistry(),
      dmxMonitor: monitor,
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/fixtures/colors", () => {
    it("returns empty array when no fixtures exist", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/fixtures/colors",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.fixtures).toEqual([]);
    });

    it("returns color state for RGB fixture with active DMX", async () => {
      fixtureStore.add({
        name: "Test PAR",
        mode: "3ch",
        dmxStartAddress: 1,
        channelCount: 3,
        channels: [
          { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
          { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
          { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
        ],
      });

      manager.applyFixtureUpdate({ fixture: "par", channels: { "1": 255, "2": 128, "3": 64 } });

      const res = await app.inject({
        method: "GET",
        url: "/api/fixtures/colors",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.fixtures).toHaveLength(1);
      expect(body.fixtures[0].color.active).toBe(true);
      expect(body.fixtures[0].color.groups[0].r).toBe(255);
      expect(body.fixtures[0].color.groups[0].g).toBe(128);
      expect(body.fixtures[0].color.groups[0].b).toBe(64);
    });

    it("returns active:false when no DMX data flowing", async () => {
      fixtureStore.add({
        name: "Test PAR",
        mode: "3ch",
        dmxStartAddress: 1,
        channelCount: 3,
        channels: [
          { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
          { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
          { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
        ],
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/fixtures/colors",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.fixtures[0].color.active).toBe(false);
    });

    it("returns all-zero colors during blackout", async () => {
      fixtureStore.add({
        name: "Test PAR",
        mode: "3ch",
        dmxStartAddress: 1,
        channelCount: 3,
        channels: [
          { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
          { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
          { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
        ],
      });

      manager.applyFixtureUpdate({ fixture: "par", channels: { "1": 255, "2": 128, "3": 64 } });
      manager.blackout();

      const res = await app.inject({ method: "GET", url: "/api/fixtures/colors" });
      const body = res.json();
      expect(body.fixtures[0].color.groups[0]).toEqual({ r: 0, g: 0, b: 0, w: 0 });
      expect(body.fixtures[0].color.active).toBe(false);
    });

    it("returns all-255 colors during whiteout", async () => {
      fixtureStore.add({
        name: "Test PAR",
        mode: "3ch",
        dmxStartAddress: 1,
        channelCount: 3,
        channels: [
          { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
          { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
          { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
        ],
      });

      manager.applyFixtureUpdate({ fixture: "par", channels: { "1": 100, "2": 50, "3": 25 } });
      manager.whiteout();

      const res = await app.inject({ method: "GET", url: "/api/fixtures/colors" });
      const body = res.json();
      expect(body.fixtures[0].color.groups[0]).toEqual({ r: 255, g: 255, b: 255, w: 0 });
      expect(body.fixtures[0].color.active).toBe(true);
    });

    it("SSE stream returns initial frame with correct content type", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/fixtures/colors/stream",
      });

      expect(res.headers["content-type"]).toBe("text/event-stream");
      expect(res.body).toContain("data:");
    });
  });
});
