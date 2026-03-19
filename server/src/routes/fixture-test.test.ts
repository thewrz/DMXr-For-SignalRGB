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

describe("Fixture test routes", () => {
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

  describe("POST /fixtures/:id/test", () => {
    it("returns 404 for missing fixture", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/nonexistent/test",
        payload: { action: "flash" },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("Fixture not found");
    });

    it("flash action returns success with dmxStatus", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash", durationMs: 200 },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.action).toBe("flash");
      expect(body.fixtureId).toBe(id);
      expect(body.durationMs).toBe(200);
      expect(body.dmxStatus).toBeDefined();
    });

    it("flash-hold and flash-release cycle", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const holdRes = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash-hold" },
      });

      expect(holdRes.statusCode).toBe(200);
      const holdBody = holdRes.json();
      expect(holdBody.success).toBe(true);
      expect(holdBody.action).toBe("flash-hold");
      expect(holdBody.fixtureId).toBe(id);
      expect(holdBody.dmxStatus).toBeDefined();

      const releaseRes = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash-release" },
      });

      expect(releaseRes.statusCode).toBe(200);
      const releaseBody = releaseRes.json();
      expect(releaseBody.success).toBe(true);
      expect(releaseBody.action).toBe("flash-release");
      expect(releaseBody.fixtureId).toBe(id);
    });

    it("invalid channelOffset returns 400", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash", channelOffset: 10 },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("channelOffset");
    });

    it("flash-click action returns success with durationMs", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash-click" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.action).toBe("flash-click");
      expect(body.fixtureId).toBe(id);
      expect(body.durationMs).toBe(2000);
      expect(body.dmxStatus).toBeDefined();
    });

    it("flash with valid channelOffset targets single channel", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash", channelOffset: 1 },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.action).toBe("flash");
    });
  });
});
