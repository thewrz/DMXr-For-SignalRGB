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
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { FastifyInstance } from "fastify";

describe("Control routes", () => {
  let app: FastifyInstance;
  let store: FixtureStore;
  let mockUniverse: ReturnType<typeof createMockUniverse>;

  beforeEach(async () => {
    mockUniverse = createMockUniverse();
    const manager = createUniverseManager(mockUniverse);
    store = createTestFixtureStore();
    app = await buildServer({
      config: createTestConfig(),
      manager,
      driver: "null",
      startTime: Date.now(),
      fixtureStore: store,
      oflClient: createMockOflClient(),
      registry: createMockRegistry(),
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /control/blackout", () => {
    it("sends blackout and returns success", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/control/blackout",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().action).toBe("blackout");
      expect(mockUniverse.updateAllCalls).toContain(0);
    });
  });

  describe("POST /control/whiteout", () => {
    it.skip("blackouts first then sets fixture channels via mapColor", async () => {
      // Add a fixture so whiteout has something to light up
      await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "Test PAR",
          oflKey: "test/test",
          oflFixtureName: "Test",
          mode: "3-channel",
          dmxStartAddress: 1,
          channelCount: 3,
          channels: [
            { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
            { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
            { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
          ],
        },
      });

      const res = await app.inject({
        method: "POST",
        url: "/control/whiteout",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().action).toBe("whiteout");
      expect(res.json().fixturesUpdated).toBe(1);

      // Blackout (updateAll(0)) should have been called first
      expect(mockUniverse.updateAllCalls).toContain(0);

      // Then mapColor(fixture, 255, 255, 255, 1.0) applied via update()
      const whiteUpdate = mockUniverse.updateCalls.find(
        (call) => call[1] === 255 && call[2] === 255 && call[3] === 255,
      );
      expect(whiteUpdate).toBeDefined();
    });

    it.skip("returns success with no fixtures configured", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/control/whiteout",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().fixturesUpdated).toBe(0);

      // Still blackouts even with no fixtures
      expect(mockUniverse.updateAllCalls).toContain(0);
    });
  });

  describe("POST /fixtures/:id/test", () => {
    it("flashes a fixture and returns success", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "Test PAR",
          oflKey: "test/test",
          oflFixtureName: "Test",
          mode: "3-channel",
          dmxStartAddress: 1,
          channelCount: 3,
          channels: [
            { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
            { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
            { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
          ],
        },
      });
      const { id } = addRes.json();

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash", durationMs: 100 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().fixtureId).toBe(id);

      const flashUpdate = mockUniverse.updateCalls.find(
        (call) => call[1] === 255 && call[2] === 255 && call[3] === 255,
      );
      expect(flashUpdate).toBeDefined();
    });

    it("returns 404 for unknown fixture", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/nonexistent/test",
        payload: { action: "flash" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 for invalid action", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/some-id/test",
        payload: { action: "invalid" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("flash-hold applies max brightness values", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "Hold PAR",
          oflKey: "test/test",
          oflFixtureName: "Test",
          mode: "3-channel",
          dmxStartAddress: 10,
          channelCount: 3,
          channels: [
            { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
            { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
            { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
          ],
        },
      });
      const { id } = addRes.json();

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash-hold" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().action).toBe("flash-hold");

      const lastUpdate = mockUniverse.updateCalls[mockUniverse.updateCalls.length - 1];
      expect(lastUpdate[10]).toBe(255);
      expect(lastUpdate[11]).toBe(255);
      expect(lastUpdate[12]).toBe(255);
    });

    it("flash-release restores channels after hold", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "Release PAR",
          oflKey: "test/test",
          oflFixtureName: "Test",
          mode: "3-channel",
          dmxStartAddress: 20,
          channelCount: 3,
          channels: [
            { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
            { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
            { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
          ],
        },
      });
      const { id } = addRes.json();

      await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash-hold" },
      });

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash-release" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().action).toBe("flash-release");

      // Restore should set channels back to 0 (their pre-flash state)
      const lastUpdate = mockUniverse.updateCalls[mockUniverse.updateCalls.length - 1];
      expect(lastUpdate[20]).toBe(0);
      expect(lastUpdate[21]).toBe(0);
      expect(lastUpdate[22]).toBe(0);
    });

    it("flash-hold works during blackout", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "Blackout PAR",
          oflKey: "test/test",
          oflFixtureName: "Test",
          mode: "3-channel",
          dmxStartAddress: 30,
          channelCount: 3,
          channels: [
            { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
            { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
            { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
          ],
        },
      });
      const { id } = addRes.json();

      // Activate blackout
      await app.inject({ method: "POST", url: "/control/blackout" });

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash-hold" },
      });

      // Should succeed (not 409)
      expect(res.statusCode).toBe(200);
      expect(res.json().action).toBe("flash-hold");

      const lastUpdate = mockUniverse.updateCalls[mockUniverse.updateCalls.length - 1];
      expect(lastUpdate[30]).toBe(255);
      expect(lastUpdate[31]).toBe(255);
      expect(lastUpdate[32]).toBe(255);
    });

    it("flash-release during blackout zeros channels", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "Blackout Release PAR",
          oflKey: "test/test",
          oflFixtureName: "Test",
          mode: "3-channel",
          dmxStartAddress: 40,
          channelCount: 3,
          channels: [
            { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
            { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
            { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
          ],
        },
      });
      const { id } = addRes.json();

      // Activate blackout, then flash-hold, then flash-release
      await app.inject({ method: "POST", url: "/control/blackout" });
      await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash-hold" },
      });

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash-release" },
      });

      expect(res.statusCode).toBe(200);

      // During blackout, release should zero channels (not restore snapshot)
      const lastUpdate = mockUniverse.updateCalls[mockUniverse.updateCalls.length - 1];
      expect(lastUpdate[40]).toBe(0);
      expect(lastUpdate[41]).toBe(0);
      expect(lastUpdate[42]).toBe(0);
    });

    it("flash-release with no active hold is a no-op", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "Noop PAR",
          oflKey: "test/test",
          oflFixtureName: "Test",
          mode: "3-channel",
          dmxStartAddress: 50,
          channelCount: 3,
          channels: [
            { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
            { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
            { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
          ],
        },
      });
      const { id } = addRes.json();

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash-release" },
      });

      // Should succeed without error
      expect(res.statusCode).toBe(200);
      expect(res.json().action).toBe("flash-release");
    });
  });
});
