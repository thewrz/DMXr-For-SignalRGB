import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildServer } from "../server.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import type { UniverseManager } from "../dmx/universe-manager.js";
import {
  createMockUniverse,
  createTestConfig,
  createTestFixtureStore,
  createMockOflClient,
  createMockRegistry,
} from "../test-helpers.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { FastifyInstance } from "fastify";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const validFixtureBody = {
  name: "Test PAR",
  mode: "3-channel",
  dmxStartAddress: 1,
  channelCount: 3,
  channels: [
    { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
    { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
  ],
};

describe("SignalRGB routes", () => {
  let app: FastifyInstance;
  let store: FixtureStore;
  let universe: ReturnType<typeof createMockUniverse>;
  let manager: UniverseManager;
  let componentsDir: string;
  let savedEnv: string | undefined;

  beforeEach(async () => {
    universe = createMockUniverse();
    manager = createUniverseManager(universe);
    manager.resumeNormal();
    store = createTestFixtureStore();
    componentsDir = await mkdtemp(join(tmpdir(), "dmxr-signalrgb-test-"));
    savedEnv = process.env["SIGNALRGB_COMPONENTS_DIR"];
    process.env["SIGNALRGB_COMPONENTS_DIR"] = componentsDir;
    ({ app } = await buildServer({
      config: createTestConfig(),
      manager,
      driver: "null",
      startTime: Date.now(),
      fixtureStore: store,
      oflClient: createMockOflClient(),
      registry: createMockRegistry(),
    }));
  });

  afterEach(async () => {
    store.dispose();
    await app.close();
    if (savedEnv === undefined) {
      delete process.env["SIGNALRGB_COMPONENTS_DIR"];
    } else {
      process.env["SIGNALRGB_COMPONENTS_DIR"] = savedEnv;
    }
    await rm(componentsDir, { recursive: true, force: true });
  });

  describe("POST /signalrgb/components/sync", () => {
    it("returns success with zero synced when no fixtures", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/signalrgb/components/sync",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.synced).toBe(0);
      expect(body.fixtures).toEqual([]);
      expect(body.componentsDir).toBe(componentsDir);
    });

    it("syncs fixtures and returns count", async () => {
      await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });

      const res = await app.inject({
        method: "POST",
        url: "/signalrgb/components/sync",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.synced).toBe(1);
      expect(body.fixtures).toHaveLength(1);
      expect(body.fixtures[0].name).toBe("Test PAR");
      expect(body.fixtures[0].componentFile).toContain("DMXr_Test PAR.json");
    });
  });

  describe("GET /signalrgb/components/:id/preview", () => {
    it("returns 404 for missing fixture", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/signalrgb/components/nonexistent/preview",
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("Fixture not found");
    });

    it("returns component JSON for existing fixture", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const res = await app.inject({
        method: "GET",
        url: `/signalrgb/components/${id}/preview`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.ProductName).toBe("DMXr Test PAR");
      expect(body.DisplayName).toContain("Test PAR");
      expect(body.Brand).toBe("DMXr");
      expect(body.Type).toBe("DMX Fixture");
      expect(body.LedCount).toBeGreaterThan(0);
      expect(body.Width).toBeGreaterThan(0);
      expect(body.Height).toBeGreaterThan(0);
      expect(Array.isArray(body.LedMapping)).toBe(true);
      expect(Array.isArray(body.LedCoordinates)).toBe(true);
      expect(Array.isArray(body.LedNames)).toBe(true);
    });
  });
});
