import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildServer } from "../server.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import {
  createMockUniverse,
  createTestConfig,
  createTestFixtureStore,
  createMockOflClient,
  createMockRegistry,
} from "../test-helpers.js";
import type { FastifyInstance } from "fastify";
import { detectResetChannel } from "./fixture-reset.js";
import type { FixtureChannel } from "../types/protocol.js";

describe("detectResetChannel", () => {
  it("finds a channel named 'Reset' with type Generic", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Reset", type: "Generic", defaultValue: 0 },
    ];
    expect(detectResetChannel(channels)).toEqual(channels[1]);
  });

  it("finds a channel named 'Maintenance' with type Generic", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Maintenance", type: "Generic", defaultValue: 0 },
    ];
    expect(detectResetChannel(channels)).toEqual(channels[0]);
  });

  it("finds 'Lamp Control' pattern", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Lamp Control", type: "Generic", defaultValue: 0 },
    ];
    expect(detectResetChannel(channels)).toEqual(channels[0]);
  });

  it("finds 'Special' pattern", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Special Function", type: "Generic", defaultValue: 0 },
    ];
    expect(detectResetChannel(channels)).toEqual(channels[0]);
  });

  it("finds 'Auto Mode' pattern", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Auto Mode", type: "Generic", defaultValue: 0 },
    ];
    expect(detectResetChannel(channels)).toEqual(channels[0]);
  });

  it("finds 'Control Ch' pattern", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Control Ch1", type: "Generic", defaultValue: 0 },
    ];
    expect(detectResetChannel(channels)).toEqual(channels[0]);
  });

  it("ignores non-Generic type even if name matches", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Reset", type: "ColorIntensity", defaultValue: 0 },
    ];
    expect(detectResetChannel(channels)).toBeUndefined();
  });

  it("returns undefined when no channel matches", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
    ];
    expect(detectResetChannel(channels)).toBeUndefined();
  });

  it("prioritizes earlier pattern matches (reset before maintenance)", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Maintenance", type: "Generic", defaultValue: 0 },
      { offset: 1, name: "Reset", type: "Generic", defaultValue: 0 },
    ];
    // "reset" pattern comes first in RESET_CHANNEL_PATTERNS
    expect(detectResetChannel(channels)).toEqual(channels[1]);
  });
});

const resetChannels = [
  { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
  { offset: 1, name: "Tilt", type: "Tilt", defaultValue: 128 },
  { offset: 2, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
  { offset: 3, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
  { offset: 4, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
  { offset: 5, name: "Reset", type: "Generic", defaultValue: 0 },
];

const noResetChannels = [
  { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
  { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
  { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
];

/** Create a fixture via the HTTP API and return its id + dmxStartAddress. */
async function addFixture(
  app: FastifyInstance,
  overrides: Record<string, unknown> = {},
) {
  const payload = {
    name: "Test Fixture",
    oflKey: "test/test",
    oflFixtureName: "Test",
    mode: "6ch",
    dmxStartAddress: 1,
    channelCount: 6,
    channels: resetChannels,
    ...overrides,
  };
  const res = await app.inject({ method: "POST", url: "/fixtures", payload });
  return res.json() as { id: string; dmxStartAddress: number };
}

describe("Fixture reset routes", () => {
  let app: FastifyInstance;
  let mockUniverse: ReturnType<typeof createMockUniverse>;

  beforeEach(async () => {
    mockUniverse = createMockUniverse();
    const manager = createUniverseManager(mockUniverse);

    ({ app } = await buildServer({
      config: createTestConfig(),
      manager,
      driver: "null",
      startTime: Date.now(),
      fixtureStore: createTestFixtureStore(),
      oflClient: createMockOflClient(),
      registry: createMockRegistry(),
    }));
  });

  afterEach(async () => {
    vi.useRealTimers();
    await app.close();
  });

  describe("POST /fixtures/:id/reset", () => {
    it("returns 404 for non-existent fixture", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/nonexistent/reset",
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when fixture has no reset channel", async () => {
      const { id } = await addFixture(app, {
        name: "No Reset PAR",
        mode: "3ch",
        dmxStartAddress: 20,
        channelCount: 3,
        channels: noResetChannels,
      });

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/reset`,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("No reset channel detected");
    });

    it("triggers reset with auto-detected channel and default values", async () => {
      const { id, dmxStartAddress } = await addFixture(app, {
        name: "Moving Head",
        dmxStartAddress: 1,
      });

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/reset`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.channel).toBe("Reset");
      expect(body.value).toBe(200);
      expect(body.holdMs).toBe(5000);
      expect(body.dmxAddress).toBe(dmxStartAddress + 5);
    });

    it("triggers reset with explicit resetConfig values", async () => {
      const { id } = await addFixture(app, {
        name: "Configured Mover",
        dmxStartAddress: 50,
        channels: [
          { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
          { offset: 1, name: "Maintenance", type: "Generic", defaultValue: 0 },
        ],
        channelCount: 2,
        mode: "2ch",
      });

      // Set resetConfig via PATCH
      await app.inject({
        method: "PATCH",
        url: `/fixtures/${id}`,
        payload: {
          resetConfig: { channelOffset: 1, value: 220, holdMs: 3000 },
        },
      });

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/reset`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.channel).toBe("Maintenance");
      expect(body.value).toBe(220);
      expect(body.holdMs).toBe(3000);
    });

    it("restores channel to 0 after hold time elapses", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { id, dmxStartAddress } = await addFixture(app, {
        dmxStartAddress: 10,
      });

      await app.inject({
        method: "POST",
        url: `/fixtures/${id}/reset`,
      });

      const dmxAddr = dmxStartAddress + 5;
      expect(mockUniverse.updateCalls).toContainEqual({ [dmxAddr]: 200 });

      vi.advanceTimersByTime(5000);

      expect(mockUniverse.updateCalls).toContainEqual({ [dmxAddr]: 0 });
    });

    it("clears existing timer when reset is triggered again", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { id, dmxStartAddress } = await addFixture(app, {
        dmxStartAddress: 30,
      });
      const dmxAddr = dmxStartAddress + 5;

      // First reset
      await app.inject({
        method: "POST",
        url: `/fixtures/${id}/reset`,
      });

      // Advance partway, then trigger second reset
      vi.advanceTimersByTime(2000);
      await app.inject({
        method: "POST",
        url: `/fixtures/${id}/reset`,
      });

      // 3000ms after second reset — first timer was cleared, second hasn't expired
      vi.advanceTimersByTime(3000);
      const restoreCalls = mockUniverse.updateCalls.filter(
        (call) => call[dmxAddr] === 0,
      );
      expect(restoreCalls.length).toBe(0);

      // Advance past the second timer
      vi.advanceTimersByTime(2000);
      const restoreCallsAfter = mockUniverse.updateCalls.filter(
        (call) => call[dmxAddr] === 0,
      );
      expect(restoreCallsAfter.length).toBe(1);
    });

    it("uses custom holdMs from resetConfig for timer", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const { id, dmxStartAddress } = await addFixture(app, {
        name: "Custom Hold",
        dmxStartAddress: 40,
        channels: [
          { offset: 0, name: "Maintenance", type: "Generic", defaultValue: 0 },
        ],
        channelCount: 1,
        mode: "1ch",
      });

      // Configure resetConfig with 3000ms hold
      await app.inject({
        method: "PATCH",
        url: `/fixtures/${id}`,
        payload: {
          resetConfig: { channelOffset: 0, value: 220, holdMs: 3000 },
        },
      });

      await app.inject({
        method: "POST",
        url: `/fixtures/${id}/reset`,
      });

      const dmxAddr = dmxStartAddress + 0;

      vi.advanceTimersByTime(2999);
      const beforeExpiry = mockUniverse.updateCalls.filter(
        (call) => call[dmxAddr] === 0,
      );
      expect(beforeExpiry.length).toBe(0);

      vi.advanceTimersByTime(1);
      const afterExpiry = mockUniverse.updateCalls.filter(
        (call) => call[dmxAddr] === 0,
      );
      expect(afterExpiry.length).toBe(1);
    });
  });

  describe("GET /fixtures/:id/reset-info", () => {
    it("returns 404 for non-existent fixture", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/fixtures/nonexistent/reset-info",
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns reset info with auto-detected channel", async () => {
      const { id, dmxStartAddress } = await addFixture(app, {
        dmxStartAddress: 1,
      });

      const res = await app.inject({
        method: "GET",
        url: `/fixtures/${id}/reset-info`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.fixtureId).toBe(id);
      expect(body.hasReset).toBe(true);
      expect(body.configured).toBe(false);
      expect(body.channel).toEqual({
        offset: 5,
        name: "Reset",
        dmxAddress: dmxStartAddress + 5,
      });
      expect(body.value).toBe(200);
      expect(body.holdMs).toBe(5000);
    });

    it("returns reset info with explicit resetConfig", async () => {
      const { id, dmxStartAddress } = await addFixture(app, {
        dmxStartAddress: 50,
        channels: [
          { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
          { offset: 1, name: "Maintenance", type: "Generic", defaultValue: 0 },
        ],
        channelCount: 2,
        mode: "2ch",
      });

      await app.inject({
        method: "PATCH",
        url: `/fixtures/${id}`,
        payload: {
          resetConfig: { channelOffset: 1, value: 220, holdMs: 3000 },
        },
      });

      const res = await app.inject({
        method: "GET",
        url: `/fixtures/${id}/reset-info`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.fixtureId).toBe(id);
      expect(body.hasReset).toBe(true);
      expect(body.configured).toBe(true);
      expect(body.channel).toEqual({
        offset: 1,
        name: "Maintenance",
        dmxAddress: dmxStartAddress + 1,
      });
      expect(body.value).toBe(220);
      expect(body.holdMs).toBe(3000);
    });

    it("returns hasReset false when no reset channel exists", async () => {
      const { id } = await addFixture(app, {
        name: "Simple PAR",
        dmxStartAddress: 20,
        channelCount: 3,
        mode: "3ch",
        channels: noResetChannels,
      });

      const res = await app.inject({
        method: "GET",
        url: `/fixtures/${id}/reset-info`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.fixtureId).toBe(id);
      expect(body.hasReset).toBe(false);
      expect(body.configured).toBe(false);
      expect(body.channel).toBeNull();
      expect(body.value).toBe(200);
      expect(body.holdMs).toBe(5000);
    });
  });
});
