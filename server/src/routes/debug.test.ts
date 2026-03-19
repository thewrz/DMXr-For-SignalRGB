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

describe("Debug routes", () => {
  let app: FastifyInstance;
  let store: FixtureStore;
  let universe: ReturnType<typeof createMockUniverse>;
  let manager: UniverseManager;

  beforeEach(async () => {
    universe = createMockUniverse();
    manager = createUniverseManager(universe);
    manager.resumeNormal();
    store = createTestFixtureStore();
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
  });

  describe("GET /debug/fixture/:id", () => {
    it("returns 404 for missing fixture", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/debug/fixture/nonexistent",
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("Fixture not found");
    });

    it("returns channel snapshot for existing fixture", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const res = await app.inject({
        method: "GET",
        url: `/debug/fixture/${id}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.fixture).toBe("Test PAR");
      expect(body.id).toBe(id);
      expect(body.dmxStartAddress).toBe(1);
      expect(body.channelCount).toBe(3);
      expect(body.channels).toHaveLength(3);
      expect(body.channels[0].name).toBe("Red");
      expect(body.channels[0].dmxAddress).toBe(1);
      expect(body.channels[0].type).toBe("ColorIntensity");
      expect(typeof body.blackoutActive).toBe("boolean");
      expect(typeof body.activeChannels).toBe("number");
    });
  });

  describe("POST /debug/raw", () => {
    it("writes raw channels and returns success", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/debug/raw",
        payload: {
          channels: { "1": 255, "2": 128, "3": 64 },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.channelsSet).toBe(3);
      expect(body.updates).toEqual({ "1": 255, "2": 128, "3": 64 });
    });

    it("validates schema — rejects missing channels", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/debug/raw",
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it("filters out-of-range DMX addresses", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/debug/raw",
        payload: {
          channels: { "0": 100, "1": 200, "513": 50 },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      // Only DMX address 1 (1-512) should be included
      expect(body.channelsSet).toBe(1);
      expect(body.updates).toEqual({ "1": 200 });
    });

    it("accepts optional universeId", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/debug/raw",
        payload: {
          channels: { "10": 255 },
          universeId: "universe-1",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.universeId).toBe("universe-1");
    });
  });
});
