import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildServer } from "../server.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import { createMockUniverse, createTestConfig, createTestFixtureStore, createMockOflClient } from "../test-helpers.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { FastifyInstance } from "fastify";

describe("POST /update", () => {
  let app: FastifyInstance;
  let store: FixtureStore;

  beforeEach(async () => {
    const manager = createUniverseManager(createMockUniverse());
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

  it("returns success for valid payload", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/update",
      payload: {
        fixture: "fixture-1",
        channels: { "1": 255, "2": 128, "3": 64, "4": 200 },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.fixture).toBe("fixture-1");
    expect(body.channelsUpdated).toBe(4);
  });

  it("returns 400 when fixture is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/update",
      payload: { channels: { "1": 255 } },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when channels is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/update",
      payload: { fixture: "test" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when fixture is empty string", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/update",
      payload: { fixture: "", channels: { "1": 255 } },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for non-JSON body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/update",
      headers: { "content-type": "application/json" },
      payload: "not json",
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns success:false when all channels are invalid", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/update",
      payload: { fixture: "test", channels: { "0": 255, "513": 128 } },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.channelsUpdated).toBe(0);
  });
});

describe("POST /update/colors", () => {
  let app: FastifyInstance;
  let store: FixtureStore;

  beforeEach(async () => {
    const manager = createUniverseManager(createMockUniverse());
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

  it("maps colors to fixture channels", async () => {
    const addRes = await app.inject({
      method: "POST",
      url: "/fixtures",
      payload: {
        name: "Test",
        oflKey: "test/rgb",
        oflFixtureName: "RGB",
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
    const { id } = addRes.json();

    const res = await app.inject({
      method: "POST",
      url: "/update/colors",
      payload: {
        fixtures: [{ id, r: 255, g: 128, b: 64, brightness: 1.0 }],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.channelsUpdated).toBe(3);
  });

  it("skips unknown fixture ids", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/update/colors",
      payload: {
        fixtures: [{ id: "nonexistent", r: 255, g: 128, b: 64, brightness: 1.0 }],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(false);
  });

  it("returns 400 for missing fixtures array", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/update/colors",
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});
