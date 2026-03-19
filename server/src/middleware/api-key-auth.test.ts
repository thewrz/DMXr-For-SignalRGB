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

describe("API key authentication", () => {
  describe("when API_KEY is set", () => {
    let app: FastifyInstance;
    const API_KEY = "test-secret-key-123";

    beforeEach(async () => {
      ({ app } = await buildServer({
        config: createTestConfig({ apiKey: API_KEY }),
        manager: createUniverseManager(createMockUniverse()),
        driver: "null",
        startTime: Date.now(),
        fixtureStore: createTestFixtureStore(),
        oflClient: createMockOflClient(),
        registry: createMockRegistry(),
      }));
    });

    afterEach(async () => {
      await app.close();
    });

    it("returns 401 for API route without key", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/fixtures",
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe("Unauthorized");
    });

    it("returns 200 for API route with correct key", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/fixtures",
        headers: { "x-api-key": API_KEY },
      });
      expect(res.statusCode).toBe(200);
    });

    it("returns 401 for API route with wrong key", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/fixtures",
        headers: { "x-api-key": "wrong-key" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("/health is always accessible without key", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/health",
      });
      expect(res.statusCode).toBe(200);
    });

    it("protects /update route", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/update",
        payload: { fixture: "test", channels: { "1": 0 } },
      });
      expect(res.statusCode).toBe(401);
    });

    it("protects /control route", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/control/blackout",
      });
      expect(res.statusCode).toBe(401);
    });

    it("protects /search route", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/search?q=test",
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 for matching-prefix wrong-suffix key", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/fixtures",
        headers: { "x-api-key": "test-secret-key-124" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 for key that is a prefix of the correct key", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/fixtures",
        headers: { "x-api-key": "test-secret" },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("when API_KEY is not set", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      ({ app } = await buildServer({
        config: createTestConfig(),
        manager: createUniverseManager(createMockUniverse()),
        driver: "null",
        startTime: Date.now(),
        fixtureStore: createTestFixtureStore(),
        oflClient: createMockOflClient(),
        registry: createMockRegistry(),
      }));
    });

    afterEach(async () => {
      await app.close();
    });

    it("allows API routes without key", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/fixtures",
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
