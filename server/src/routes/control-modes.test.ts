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

describe("Control mode routes", () => {
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

  describe("POST /control/blackout", () => {
    it("returns action blackout with dmxStatus", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/control/blackout",
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.action).toBe("blackout");
      expect(body.controlMode).toBe("blackout");
      expect(body.dmxStatus).toBeDefined();
    });

    it("accepts optional universeId", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/control/blackout",
        payload: { universeId: "universe-1" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.action).toBe("blackout");
      expect(body.universeId).toBe("universe-1");
    });
  });

  describe("POST /control/whiteout", () => {
    it("returns action whiteout with dmxStatus", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/control/whiteout",
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.action).toBe("whiteout");
      expect(body.controlMode).toBe("whiteout");
      expect(body.dmxStatus).toBeDefined();
    });

    it("returns fixturesUpdated count", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/control/whiteout",
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(typeof body.fixturesUpdated).toBe("number");
    });
  });

  describe("POST /control/resume", () => {
    it("returns action resume with normal controlMode", async () => {
      // First blackout, then resume
      await app.inject({
        method: "POST",
        url: "/control/blackout",
        payload: {},
      });

      const res = await app.inject({
        method: "POST",
        url: "/control/resume",
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.action).toBe("resume");
      expect(body.controlMode).toBe("normal");
      expect(body.dmxStatus).toBeDefined();
    });

    it("accepts optional universeId", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/control/resume",
        payload: { universeId: "universe-1" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.action).toBe("resume");
      expect(body.universeId).toBe("universe-1");
    });
  });

  describe("blackout-resume cycle", () => {
    it("blackout sets all to zero, resume restores normal", async () => {
      const blackoutRes = await app.inject({
        method: "POST",
        url: "/control/blackout",
        payload: {},
      });
      expect(blackoutRes.json().controlMode).toBe("blackout");

      // Universe should have received updateAll(0) call
      expect(universe.updateAllCalls).toContain(0);

      const resumeRes = await app.inject({
        method: "POST",
        url: "/control/resume",
        payload: {},
      });
      expect(resumeRes.json().controlMode).toBe("normal");
    });
  });
});
