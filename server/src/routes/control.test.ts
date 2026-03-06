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
import type { FixtureConfig } from "../types/protocol.js";
import { buildFlashValues } from "./fixture-test.js";

describe("buildFlashValues", () => {
  const rgbFixture: FixtureConfig = {
    id: "test-rgb",
    name: "RGB PAR",
    mode: "3ch",
    dmxStartAddress: 1,
    channelCount: 3,
    channels: [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ],
  };

  const moverFixture: FixtureConfig = {
    id: "test-mover",
    name: "Moving Head",
    mode: "5ch",
    dmxStartAddress: 10,
    channelCount: 5,
    channels: [
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
      { offset: 1, name: "Tilt", type: "Tilt", defaultValue: 128 },
      { offset: 2, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 3, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 4, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ],
  };

  it("channelOffset=0 on 3ch RGB: only Red gets 255, others retain snapshot", () => {
    const snapshot: Record<number, number> = { 1: 100, 2: 150, 3: 200 };
    const result = buildFlashValues(rgbFixture, snapshot, 0);

    expect(result[1]).toBe(255); // Red (offset 0) → flash
    expect(result[2]).toBe(150); // Green (offset 1) → snapshot
    expect(result[3]).toBe(200); // Blue (offset 2) → snapshot
  });

  it("channelOffset on a non-color channel (Pan on mover): that channel gets 255", () => {
    const snapshot: Record<number, number> = { 10: 64, 11: 64, 12: 0, 13: 0, 14: 0 };
    const result = buildFlashValues(moverFixture, snapshot, 0); // Pan at offset 0

    expect(result[10]).toBe(255); // Pan → flash
    expect(result[11]).toBe(64);  // Tilt → snapshot
    expect(result[12]).toBe(0);   // Red → snapshot
    expect(result[13]).toBe(0);   // Green → snapshot
    expect(result[14]).toBe(0);   // Blue → snapshot
  });

  it("out-of-range channelOffset returns all-snapshot values (no flash)", () => {
    const snapshot: Record<number, number> = { 1: 100, 2: 150, 3: 200 };
    const result = buildFlashValues(rgbFixture, snapshot, 99);

    expect(result[1]).toBe(100);
    expect(result[2]).toBe(150);
    expect(result[3]).toBe(200);
  });

  it("no channelOffset (undefined): existing behavior — all color/intensity channels get 255", () => {
    const snapshot: Record<number, number> = { 1: 100, 2: 150, 3: 200 };
    const result = buildFlashValues(rgbFixture, snapshot);

    expect(result[1]).toBe(255);
    expect(result[2]).toBe(255);
    expect(result[3]).toBe(255);
  });
});

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
    it("sets all channels to 255 then overlays fixture values via mapColor", async () => {
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

      // Whiteout sets all channels to 255 via updateAll(255)
      expect(mockUniverse.updateAllCalls).toContain(255);

      // Then mapColor(fixture, 255, 255, 255, 1.0) applied via update()
      const whiteUpdate = mockUniverse.updateCalls.find(
        (call) => call[1] === 255 && call[2] === 255 && call[3] === 255,
      );
      expect(whiteUpdate).toBeDefined();
    });

    it("returns success with no fixtures configured", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/control/whiteout",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().fixturesUpdated).toBe(0);

      // Whiteout sets all to 255 even with no fixtures
      expect(mockUniverse.updateAllCalls).toContain(255);
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

    it("returns 404 for reset on unknown fixture", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/nonexistent/reset",
      });
      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when fixture has no reset channel", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "No Reset PAR",
          oflKey: "test/test",
          oflFixtureName: "Test",
          mode: "3-channel",
          dmxStartAddress: 60,
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
        url: `/fixtures/${id}/reset`,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("No reset channel detected");
    });

    it("sends reset value to auto-detected reset channel", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "Moving Head",
          oflKey: "test/mover",
          oflFixtureName: "Mover",
          mode: "5ch",
          dmxStartAddress: 70,
          channelCount: 5,
          channels: [
            { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
            { offset: 1, name: "Tilt", type: "Tilt", defaultValue: 128 },
            { offset: 2, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
            { offset: 3, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
            { offset: 4, name: "Auto Mode", type: "Generic", defaultValue: 0 },
          ],
        },
      });
      const { id } = addRes.json();

      mockUniverse.updateCalls.length = 0;

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/reset`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().channel).toBe("Auto Mode");
      expect(res.json().dmxAddress).toBe(74); // base 70 + offset 4
      expect(res.json().value).toBe(200);

      // DMX addr 74 should have been sent value 200
      expect(mockUniverse.updateCalls.length).toBeGreaterThanOrEqual(1);
      expect(mockUniverse.updateCalls[0][74]).toBe(200);
    });

    it("flash-click applies max brightness and returns 2s duration", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "Click PAR",
          oflKey: "test/test",
          oflFixtureName: "Test",
          mode: "3-channel",
          dmxStartAddress: 80,
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
        payload: { action: "flash-click" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().action).toBe("flash-click");
      expect(res.json().durationMs).toBe(2000);

      const lastUpdate = mockUniverse.updateCalls[mockUniverse.updateCalls.length - 1];
      expect(lastUpdate[80]).toBe(255);
      expect(lastUpdate[81]).toBe(255);
      expect(lastUpdate[82]).toBe(255);
    });

    it("flash-click overrides active blackout via channel locking", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "Override PAR",
          oflKey: "test/test",
          oflFixtureName: "Test",
          mode: "3-channel",
          dmxStartAddress: 90,
          channelCount: 3,
          channels: [
            { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
            { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
            { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
          ],
        },
      });
      const { id } = addRes.json();

      // Activate blackout first
      await app.inject({ method: "POST", url: "/control/blackout" });

      // Flash-click should still work
      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash-click" },
      });

      expect(res.statusCode).toBe(200);

      const lastUpdate = mockUniverse.updateCalls[mockUniverse.updateCalls.length - 1];
      expect(lastUpdate[90]).toBe(255);
      expect(lastUpdate[91]).toBe(255);
      expect(lastUpdate[92]).toBe(255);
    });

    it("flash-click cancels existing flash-hold safety timer", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "Cancel PAR",
          oflKey: "test/test",
          oflFixtureName: "Test",
          mode: "3-channel",
          dmxStartAddress: 100,
          channelCount: 3,
          channels: [
            { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
            { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
            { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
          ],
        },
      });
      const { id } = addRes.json();

      // Start a hold
      await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash-hold" },
      });

      // Immediately send flash-click (should cancel hold timer)
      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/test`,
        payload: { action: "flash-click" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().action).toBe("flash-click");
    });

    it("flash with channelOffset flashes only that channel", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "Offset PAR",
          oflKey: "test/test",
          oflFixtureName: "Test",
          mode: "3-channel",
          dmxStartAddress: 110,
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
        payload: { action: "flash", channelOffset: 0, durationMs: 100 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      const lastUpdate = mockUniverse.updateCalls[mockUniverse.updateCalls.length - 1];
      expect(lastUpdate[110]).toBe(255); // Red (offset 0) → flash
      expect(lastUpdate[111]).toBe(0);   // Green → snapshot (default 0)
      expect(lastUpdate[112]).toBe(0);   // Blue → snapshot (default 0)
    });

    it("rejects negative channelOffset with 400", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "Neg PAR",
          oflKey: "test/test",
          oflFixtureName: "Test",
          mode: "3-channel",
          dmxStartAddress: 120,
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
        payload: { action: "flash", channelOffset: -1 },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects channelOffset >= channelCount with 400", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "OOB PAR",
          oflKey: "test/test",
          oflFixtureName: "Test",
          mode: "3-channel",
          dmxStartAddress: 130,
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
        payload: { action: "flash", channelOffset: 3 },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("channelOffset");
    });

    it("flash without channelOffset is backward-compatible full flash", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: {
          name: "Compat PAR",
          oflKey: "test/test",
          oflFixtureName: "Test",
          mode: "3-channel",
          dmxStartAddress: 140,
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

      const lastUpdate = mockUniverse.updateCalls[mockUniverse.updateCalls.length - 1];
      expect(lastUpdate[140]).toBe(255);
      expect(lastUpdate[141]).toBe(255);
      expect(lastUpdate[142]).toBe(255);
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
