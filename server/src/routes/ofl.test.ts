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
import type { OflClient } from "../ofl/ofl-client.js";
import type { FastifyInstance } from "fastify";

function createFailingOflClient(error: Error): OflClient {
  return {
    async getManufacturers() { throw error; },
    async getManufacturerFixtures() { throw error; },
    async getFixture() { throw error; },
    searchFixtures() { return []; },
  };
}

async function buildAppWith(oflClient: OflClient): Promise<FastifyInstance> {
  const manager = createUniverseManager(createMockUniverse());
  const { app } = await buildServer({
    config: createTestConfig(),
    manager,
    driver: "null",
    startTime: Date.now(),
    fixtureStore: createTestFixtureStore(),
    oflClient,
    registry: createMockRegistry(),
  });
  return app;
}

describe("OFL routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildAppWith(createMockOflClient());
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

describe("OFL routes — upstream error handling", () => {
  afterEach(async () => {
    // apps are created per-test in this block
  });

  it("returns 502 with DNS message on getaddrinfo failure", async () => {
    const app = await buildAppWith(
      createFailingOflClient(new Error("fetch failed: getaddrinfo ENOTFOUND open-fixture-library.org")),
    );

    const res = await app.inject({ method: "GET", url: "/ofl/manufacturers" });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toContain("DNS lookup failed");

    await app.close();
  });

  it("returns 502 on connection refused", async () => {
    const app = await buildAppWith(
      createFailingOflClient(new Error("fetch failed: ECONNREFUSED")),
    );

    const res = await app.inject({ method: "GET", url: "/ofl/manufacturers/cameo" });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toContain("check that the server has internet access");

    await app.close();
  });

  it("returns 502 on connection timeout", async () => {
    const app = await buildAppWith(
      createFailingOflClient(new Error("fetch failed: ETIMEDOUT")),
    );

    const res = await app.inject({ method: "GET", url: "/ofl/fixture/cameo/flat-pro-18" });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toContain("check that the server has internet access");

    await app.close();
  });

  it("returns 502 on upstream OFL API error (e.g. 500)", async () => {
    const app = await buildAppWith(
      createFailingOflClient(new Error("OFL API error: 500 Internal Server Error for https://open-fixture-library.org/api/v1/manufacturers")),
    );

    const res = await app.inject({ method: "GET", url: "/ofl/manufacturers" });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toContain("having issues");

    await app.close();
  });

  it("returns 503 on unknown errors", async () => {
    const app = await buildAppWith(
      createFailingOflClient(new Error("something unexpected")),
    );

    const res = await app.inject({ method: "GET", url: "/ofl/manufacturers" });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toContain("temporarily unavailable");

    await app.close();
  });

  it("returns 404 for not-found errors", async () => {
    const app = await buildAppWith(
      createFailingOflClient(new Error("Manufacturer not found: bogus")),
    );

    const res = await app.inject({ method: "GET", url: "/ofl/manufacturers/bogus" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain("not found");

    await app.close();
  });

  it("returns 502 on generic fetch failure (no specific error code)", async () => {
    const app = await buildAppWith(
      createFailingOflClient(new Error("fetch failed")),
    );

    const res = await app.inject({ method: "GET", url: "/ofl/manufacturers" });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toContain("may not have internet access");

    await app.close();
  });
});
