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
import { scoreResult } from "./search.js";
import type { FixtureLibraryProvider } from "../libraries/types.js";

function createMockLocalDbProvider(): FixtureLibraryProvider {
  return {
    id: "local-db",
    displayName: "Local Fixture Database",
    description: "Auto-detected fixture database on this machine",
    type: "local-db",
    status: () => ({ available: true, state: "connected" }),
    getManufacturers() {
      return [
        { id: 1, name: "Shehds", fixtureCount: 5 },
        { id: 2, name: "Missyee", fixtureCount: 3 },
      ];
    },
    getFixtures(mfrId: number) {
      if (mfrId === 1) {
        return [{ id: 10, name: "SLM70S Moving Head", modeCount: 3 }];
      }
      if (mfrId === 2) {
        return [{ id: 20, name: "36 LED Stage Light", modeCount: 2 }];
      }
      return [];
    },
    getFixtureModes() {
      return [];
    },
    getModeChannels() {
      return [];
    },
    searchFixtures(query: string) {
      const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
      if (tokens.length === 0) return [];

      const fixtures = [
        { fixtureId: 10, fixtureName: "SLM70S Moving Head", mfrId: 1, mfrName: "Shehds", modeCount: 3, category: "Moving Head" },
        { fixtureId: 20, fixtureName: "36 LED Stage Light", mfrId: 2, mfrName: "Missyee", modeCount: 2, category: "Color Changer" },
      ];

      return fixtures.filter((f) => {
        const combined = `${f.fixtureName} ${f.mfrName}`.toLowerCase();
        return tokens.every((t) => combined.includes(t));
      });
    },
    close() {},
  };
}

describe("GET /search", () => {
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
      registry: createMockRegistry(createMockLocalDbProvider()),
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns empty for empty query", async () => {
    const res = await app.inject({ method: "GET", url: "/search?q=" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns empty for too-short query", async () => {
    const res = await app.inject({ method: "GET", url: "/search?q=a" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns fixture results matching model name", async () => {
    const res = await app.inject({ method: "GET", url: "/search?q=SLM70" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const fixture = body.find((r: { name: string }) => r.name === "SLM70S Moving Head");
    expect(fixture).toBeDefined();
    expect(fixture.type).toBe("fixture");
    expect(fixture.source).toBe("local-db");
    expect(fixture.manufacturer).toBe("Shehds");
  });

  it("returns manufacturer results matching name", async () => {
    const res = await app.inject({ method: "GET", url: "/search?q=Missyee" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const mfr = body.find((r: { type: string; name: string }) => r.type === "manufacturer" && r.name === "Missyee");
    expect(mfr).toBeDefined();
    expect(mfr.source).toBe("local-db");
  });

  it("multi-token query ranks combined matches higher", async () => {
    const res = await app.inject({ method: "GET", url: "/search?q=Missyee 36" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.length).toBeGreaterThan(0);
    // The fixture "36 LED Stage Light" by Missyee should be in results
    const fixture = body.find((r: { name: string }) => r.name === "36 LED Stage Light");
    expect(fixture).toBeDefined();
  });

  it("results sorted by score descending", async () => {
    const res = await app.inject({ method: "GET", url: "/search?q=Shehds" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    for (let i = 1; i < body.length; i++) {
      expect(body[i - 1].score).toBeGreaterThanOrEqual(body[i].score);
    }
  });

  it("includes categories in local-db fixture results", async () => {
    const res = await app.inject({ method: "GET", url: "/search?q=SLM70" });
    const body = res.json();
    const fixture = body.find((r: { name: string }) => r.name === "SLM70S Moving Head");
    expect(fixture).toBeDefined();
    expect(fixture.categories).toEqual(["Moving Head"]);
  });

  it("includes categories in OFL fixture results", async () => {
    const res = await app.inject({ method: "GET", url: "/search?q=Flat Pro" });
    const body = res.json();
    const fixture = body.find((r: { name: string }) => r.name === "Flat Pro 18");
    expect(fixture).toBeDefined();
    expect(fixture.categories).toEqual(["Color Changer"]);
  });

  it("handles missing local-db gracefully (OFL-only)", async () => {
    const manager = createUniverseManager(createMockUniverse());
    const oflOnlyApp = await buildServer({
      config: createTestConfig(),
      manager,
      driver: "null",
      startTime: Date.now(),
      fixtureStore: createTestFixtureStore(),
      oflClient: createMockOflClient(),
      registry: createMockRegistry(),
    });

    const res = await oflOnlyApp.inject({ method: "GET", url: "/search?q=Cameo" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Should still get OFL manufacturer results
    const cameo = body.find((r: { name: string }) => r.name === "Cameo");
    expect(cameo).toBeDefined();
    expect(cameo.source).toBe("ofl");

    await oflOnlyApp.close();
  });
});

describe("scoreResult", () => {
  it("scores exact fixture name match highest", () => {
    const score = scoreResult(["par"], "PAR", "Generic");
    expect(score).toBeGreaterThan(scoreResult(["par"], "LED PAR 64", "Generic"));
  });

  it("scores fixture starts-with higher than contains", () => {
    const startsScore = scoreResult(["slm"], "SLM70S Moving Head", "Shehds");
    const containsScore = scoreResult(["slm"], "Big SLM Light", "Shehds");
    expect(startsScore).toBeGreaterThan(containsScore);
  });

  it("penalizes tokens not found anywhere", () => {
    const withMatch = scoreResult(["led"], "LED PAR", "Generic");
    const withMiss = scoreResult(["led", "xyz"], "LED PAR", "Generic");
    expect(withMatch).toBeGreaterThan(withMiss);
  });

  it("gives length bonus for shorter names", () => {
    const shortScore = scoreResult(["par"], "PAR", "Foo");
    const longScore = scoreResult(["par"], "PAR Light Stage Moving Head XL PRO", "Foo");
    expect(shortScore).toBeGreaterThan(longScore);
  });

  it("gives category boost for exact category match", () => {
    const withCategory = scoreResult(["strobe"], "Flash Unit", "Generic", ["Strobe"]);
    const withoutCategory = scoreResult(["strobe"], "Flash Unit", "Generic");
    expect(withCategory).toBeGreaterThan(withoutCategory);
  });

  it("gives partial category boost for substring match", () => {
    const partial = scoreResult(["moving"], "Spot 360", "Chauvet", ["Moving Head"]);
    const none = scoreResult(["moving"], "Spot 360", "Chauvet");
    expect(partial).toBeGreaterThan(none);
  });

  it("works with no categories arg (backward compatible)", () => {
    const score = scoreResult(["led"], "LED PAR", "Generic");
    expect(score).toBeGreaterThan(0);
  });
});
