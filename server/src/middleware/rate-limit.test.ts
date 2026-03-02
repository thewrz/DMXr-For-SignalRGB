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
import type { FastifyInstance } from "fastify";

describe("Rate limiting", () => {
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
      registry: createMockRegistry(),
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("includes rate-limit headers in responses", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.headers["x-ratelimit-limit"]).toBeDefined();
    expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
  });

  it("returns 429 when global limit exceeded", async () => {
    // Global limit is 100/min — send 101 requests
    const requests = Array.from({ length: 101 }, () =>
      app.inject({ method: "GET", url: "/health" }),
    );
    const responses = await Promise.all(requests);

    const tooMany = responses.filter((r) => r.statusCode === 429);
    expect(tooMany.length).toBeGreaterThan(0);
  });

  it("/update/colors has higher limit than global default", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/update/colors",
      payload: { fixtures: [] },
    });

    // The per-route limit should be 6000
    expect(res.headers["x-ratelimit-limit"]).toBe("6000");
  });

  it("/update has medium limit", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/update",
      payload: { fixture: "test", channels: { "1": 0 } },
    });

    expect(res.headers["x-ratelimit-limit"]).toBe("600");
  });
});
