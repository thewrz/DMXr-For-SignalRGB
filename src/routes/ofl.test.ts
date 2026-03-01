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

describe("OFL routes", () => {
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

  describe("GET /ofl/manufacturers", () => {
    it("returns manufacturer list", async () => {
      const res = await app.inject({ method: "GET", url: "/ofl/manufacturers" });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.cameo).toBeDefined();
      expect(body.cameo.name).toBe("Cameo");
    });
  });

  describe("GET /ofl/manufacturers/:key", () => {
    it("returns manufacturer fixtures", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/ofl/manufacturers/cameo",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.name).toBe("Cameo");
      expect(body.fixtures).toHaveLength(1);
    });

    it("returns 404 for unknown manufacturer", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/ofl/manufacturers/nonexistent",
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("GET /ofl/fixture/:mfr/:model", () => {
    it("returns fixture definition", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/ofl/fixture/cameo/flat-pro-18",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.name).toBe("Flat Pro 18");
      expect(body.modes).toBeDefined();
    });

    it("returns 404 for unknown fixture", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/ofl/fixture/nonexistent/nope",
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
