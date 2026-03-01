import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildServer } from "../server.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import { createMockUniverse, createTestConfig, createTestFixtureStore, createMockOflClient } from "../test-helpers.js";
import type { FastifyInstance } from "fastify";

describe("GET /health", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const manager = createUniverseManager(createMockUniverse());
    app = await buildServer({
      config: createTestConfig(),
      manager,
      driver: "null",
      startTime: Date.now(),
      fixtureStore: createTestFixtureStore(),
      oflClient: createMockOflClient(),
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns status ok with correct shape", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.driver).toBe("null");
    expect(typeof body.activeChannels).toBe("number");
    expect(typeof body.uptime).toBe("number");
  });

  it("returns the configured driver name", async () => {
    const manager = createUniverseManager(createMockUniverse());
    const customApp = await buildServer({
      config: createTestConfig({ dmxDriver: "enttec-usb-dmx-pro", dmxDevicePath: "/dev/ttyUSB0" }),
      manager,
      driver: "enttec-usb-dmx-pro",
      startTime: Date.now(),
      fixtureStore: createTestFixtureStore(),
      oflClient: createMockOflClient(),
    });

    const res = await customApp.inject({ method: "GET", url: "/health" });
    expect(res.json().driver).toBe("enttec-usb-dmx-pro");

    await customApp.close();
  });

  it("reports active channel count after updates", async () => {
    const manager = createUniverseManager(createMockUniverse());
    const testApp = await buildServer({
      config: createTestConfig(),
      manager,
      driver: "null",
      startTime: Date.now(),
      fixtureStore: createTestFixtureStore(),
      oflClient: createMockOflClient(),
    });

    await testApp.inject({
      method: "POST",
      url: "/update",
      payload: { fixture: "test", channels: { "1": 255, "2": 128 } },
    });

    const res = await testApp.inject({ method: "GET", url: "/health" });
    expect(res.json().activeChannels).toBe(2);

    await testApp.close();
  });
});
