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

describe("CORS", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  describe("default origins (localhost)", () => {
    beforeEach(async () => {
      app = await buildServer({
        config: createTestConfig(),
        manager: createUniverseManager(createMockUniverse()),
        driver: "null",
        startTime: Date.now(),
        fixtureStore: createTestFixtureStore(),
        oflClient: createMockOflClient(),
        registry: createMockRegistry(),
      });
    });

    it("allows localhost origin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "http://localhost:8080" },
      });

      expect(res.headers["access-control-allow-origin"]).toBe(
        "http://localhost:8080",
      );
    });

    it("allows 127.0.0.1 origin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "http://127.0.0.1:8080" },
      });

      expect(res.headers["access-control-allow-origin"]).toBe(
        "http://127.0.0.1:8080",
      );
    });

    it("allows LAN origin (192.168.x.x)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "http://192.168.1.75:8080" },
      });

      expect(res.headers["access-control-allow-origin"]).toBe(
        "http://192.168.1.75:8080",
      );
    });

    it("rejects foreign origin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "https://evil.example.com" },
      });

      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });

  describe("custom CORS_ORIGIN override", () => {
    beforeEach(async () => {
      app = await buildServer({
        config: createTestConfig({
          corsOrigin: "https://myapp.example.com, https://other.example.com",
        }),
        manager: createUniverseManager(createMockUniverse()),
        driver: "null",
        startTime: Date.now(),
        fixtureStore: createTestFixtureStore(),
        oflClient: createMockOflClient(),
        registry: createMockRegistry(),
      });
    });

    it("allows configured custom origin", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "https://myapp.example.com" },
      });

      expect(res.headers["access-control-allow-origin"]).toBe(
        "https://myapp.example.com",
      );
    });

    it("rejects origins not in custom list", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "http://localhost:8080" },
      });

      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });
});
