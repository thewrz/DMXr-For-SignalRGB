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

    // AUTH-C1: previously-unauthenticated mutating routes must require auth.
    // Every one of these was bypassed under the prefix-allowlist fail-open logic.
    describe("AUTH-C1 fail-closed: routes outside the old API_PREFIXES list", () => {
      const unauthRequests: Array<{
        name: string;
        method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
        url: string;
        payload?: unknown;
      }> = [
        { name: "GET /settings", method: "GET", url: "/settings" },
        {
          name: "PATCH /settings",
          method: "PATCH",
          url: "/settings",
          payload: { port: 8081 },
        },
        {
          name: "POST /settings/restart",
          method: "POST",
          url: "/settings/restart",
        },
        { name: "GET /universes", method: "GET", url: "/universes" },
        {
          name: "POST /universes",
          method: "POST",
          url: "/universes",
          payload: { name: "x", driverType: "null" },
        },
        { name: "GET /groups", method: "GET", url: "/groups" },
        {
          name: "POST /groups",
          method: "POST",
          url: "/groups",
          payload: { name: "g", fixtureIds: [] },
        },
        {
          name: "POST /groups/:id/blackout",
          method: "POST",
          url: "/groups/abc/blackout",
        },
        {
          name: "GET /user-fixtures",
          method: "GET",
          url: "/user-fixtures",
        },
        {
          name: "POST /user-fixtures",
          method: "POST",
          url: "/user-fixtures",
          payload: {},
        },
        {
          name: "GET /remap-presets",
          method: "GET",
          url: "/remap-presets",
        },
        {
          name: "PUT /remap-presets/:key",
          method: "PUT",
          url: "/remap-presets/test",
          payload: { remap: {} },
        },
        {
          name: "DELETE /remap-presets/:key",
          method: "DELETE",
          url: "/remap-presets/test",
        },
        { name: "GET /metrics", method: "GET", url: "/metrics" },
        {
          name: "GET /metrics/prometheus",
          method: "GET",
          url: "/metrics/prometheus",
        },
        { name: "GET /api/logs", method: "GET", url: "/api/logs" },
        {
          name: "POST /api/logs/clear",
          method: "POST",
          url: "/api/logs/clear",
        },
        {
          name: "GET /api/logs/stream",
          method: "GET",
          url: "/api/logs/stream",
        },
        {
          name: "GET /api/dmx/monitor",
          method: "GET",
          url: "/api/dmx/monitor",
        },
        {
          name: "GET /api/dmx/snapshot",
          method: "GET",
          url: "/api/dmx/snapshot",
        },
        {
          name: "GET /api/diagnostics/connection-log",
          method: "GET",
          url: "/api/diagnostics/connection-log",
        },
        {
          name: "GET /config/export",
          method: "GET",
          url: "/config/export",
        },
        {
          name: "POST /config/import",
          method: "POST",
          url: "/config/import",
          payload: {},
        },
        {
          name: "POST /api/settings/ofl-cache/clear",
          method: "POST",
          url: "/api/settings/ofl-cache/clear",
        },
      ];

      for (const req of unauthRequests) {
        it(`${req.name} returns 401 without key`, async () => {
          const res = await app.inject({
            method: req.method,
            url: req.url,
            payload: req.payload,
          });
          expect(res.statusCode).toBe(401);
        });
      }
    });

    describe("AUTH-C1 fail-closed: public routes remain accessible", () => {
      it("GET /health stays public", async () => {
        const res = await app.inject({ method: "GET", url: "/health" });
        expect(res.statusCode).toBe(200);
      });

      it("GET /favicon.ico stays public", async () => {
        const res = await app.inject({ method: "GET", url: "/favicon.ico" });
        // 404 is acceptable if the asset isn't present in test; what matters
        // is that we don't return 401.
        expect(res.statusCode).not.toBe(401);
      });

      it("GET / (static root) stays public", async () => {
        const res = await app.inject({ method: "GET", url: "/" });
        expect(res.statusCode).not.toBe(401);
      });
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
