import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildServer } from "../server.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import {
  createMockUniverse,
  createTestConfig,
  createTestFixtureStore,
  createMockOflClient,
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
    it("calls updateAll(255) then overlays fixture mapColor", async () => {
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

      // updateAll(255) should have been called for whiteout
      expect(mockUniverse.updateAllCalls).toContain(255);

      // Then mapColor(fixture, 255, 255, 255, 1.0) applied via update()
      const whiteUpdate = mockUniverse.updateCalls.find(
        (call) => call[1] === 255 && call[2] === 255 && call[3] === 255,
      );
      expect(whiteUpdate).toBeDefined();
    });

    it("lights all channels even with no fixtures configured", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/control/whiteout",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().fixturesUpdated).toBe(0);

      // updateAll(255) lights up all 512 channels regardless of fixture store
      expect(mockUniverse.updateAllCalls).toContain(255);
    });
  });

  describe("POST /control/resume", () => {
    it("clears blackout override and returns success", async () => {
      // Activate blackout first
      await app.inject({ method: "POST", url: "/control/blackout" });

      const res = await app.inject({
        method: "POST",
        url: "/control/resume",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().action).toBe("resume");
    });

    it("allows color updates to flow through after resume", async () => {
      // Add a fixture
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

      // Blackout suppresses color updates
      await app.inject({ method: "POST", url: "/control/blackout" });

      const suppressed = await app.inject({
        method: "POST",
        url: "/update/colors",
        payload: { fixtures: [{ id, r: 255, g: 0, b: 0, brightness: 1 }] },
      });
      expect(suppressed.json().channelsUpdated).toBe(0);

      // Resume allows them again
      await app.inject({ method: "POST", url: "/control/resume" });

      const allowed = await app.inject({
        method: "POST",
        url: "/update/colors",
        payload: { fixtures: [{ id, r: 255, g: 0, b: 0, brightness: 1 }] },
      });
      expect(allowed.json().channelsUpdated).toBe(3);
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

    it("returns 409 when blackout is active", async () => {
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

      await app.inject({ method: "POST", url: "/control/blackout" });

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash", durationMs: 100 },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toContain("blackout");
    });
  });
});
