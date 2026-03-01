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
import type { FixtureLibraryProvider } from "../libraries/types.js";

function createMockLocalDbProvider(): FixtureLibraryProvider {
  return {
    id: "local-db",
    displayName: "Local Fixture Database",
    description: "Auto-detected fixture database on this machine",
    type: "local-db",
    status: () => ({ available: true, state: "connected", fixtureCount: 5 }),
    getManufacturers: () => [
      { id: 1, name: "Shehds", fixtureCount: 3 },
      { id: 2, name: "Missyee", fixtureCount: 2 },
    ],
    getFixtures: (mfrId: number) => {
      if (mfrId === 1) return [{ id: 10, name: "SLM70S", modeCount: 2 }];
      return [];
    },
    getFixtureModes: (fixtureId: number) => {
      if (fixtureId === 10) return [{ id: 100, name: "13ch", channelCount: 3 }];
      return [];
    },
    getModeChannels: (modeId: number) => {
      if (modeId === 100) {
        return [
          { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
          { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
          { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
        ];
      }
      return [];
    },
    searchFixtures: () => [],
    close: () => {},
  };
}

describe("Library routes", () => {
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

  describe("GET /libraries", () => {
    it("returns all libraries with status", async () => {
      const res = await app.inject({ method: "GET", url: "/libraries" });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.length).toBeGreaterThanOrEqual(2);

      const ofl = body.find((l: { id: string }) => l.id === "ofl");
      expect(ofl).toBeDefined();
      expect(ofl.displayName).toBe("Open Fixture Library");
      expect(ofl.status.available).toBe(true);

      const localDb = body.find((l: { id: string }) => l.id === "local-db");
      expect(localDb).toBeDefined();
      expect(localDb.displayName).toBe("Local Fixture Database");
      expect(localDb.status.available).toBe(true);
    });
  });

  describe("GET /libraries/:id/manufacturers", () => {
    it("returns manufacturers for local-db", async () => {
      const res = await app.inject({ method: "GET", url: "/libraries/local-db/manufacturers" });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(2);
      expect(body[0].name).toBe("Shehds");
    });

    it("returns 404 for unknown library", async () => {
      const res = await app.inject({ method: "GET", url: "/libraries/unknown/manufacturers" });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("GET /libraries/:id/manufacturers/:mfrId/fixtures", () => {
    it("returns fixtures for a manufacturer", async () => {
      const res = await app.inject({ method: "GET", url: "/libraries/local-db/manufacturers/1/fixtures" });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("SLM70S");
    });

    it("returns 400 for invalid manufacturer id", async () => {
      const res = await app.inject({ method: "GET", url: "/libraries/local-db/manufacturers/abc/fixtures" });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /libraries/:id/fixtures/:fid/modes", () => {
    it("returns modes for a fixture", async () => {
      const res = await app.inject({ method: "GET", url: "/libraries/local-db/fixtures/10/modes" });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.fixtureId).toBe(10);
      expect(body.modes).toHaveLength(1);
      expect(body.modes[0].name).toBe("13ch");
    });
  });

  describe("GET /libraries/:id/fixtures/:fid/modes/:mid/channels", () => {
    it("returns channels for a mode", async () => {
      const res = await app.inject({ method: "GET", url: "/libraries/local-db/fixtures/10/modes/100/channels" });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(3);
      expect(body[0].name).toBe("Red");
    });
  });

  describe("POST /libraries/:id/fixtures/:fid/modes/:mid/import", () => {
    it("imports a fixture from library", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/libraries/local-db/fixtures/10/modes/100/import",
        payload: { name: "Test SLM70S", dmxStartAddress: 1 },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.name).toBe("Test SLM70S");
      expect(body.source).toBe("local-db");
      expect(body.channelCount).toBe(3);
    });

    it("returns 409 for overlapping address", async () => {
      await app.inject({
        method: "POST",
        url: "/libraries/local-db/fixtures/10/modes/100/import",
        payload: { name: "First", dmxStartAddress: 1 },
      });

      const res = await app.inject({
        method: "POST",
        url: "/libraries/local-db/fixtures/10/modes/100/import",
        payload: { name: "Second", dmxStartAddress: 2 },
      });

      expect(res.statusCode).toBe(409);
    });

    it("returns 404 for empty channels", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/libraries/local-db/fixtures/10/modes/999/import",
        payload: { name: "Empty", dmxStartAddress: 1 },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
