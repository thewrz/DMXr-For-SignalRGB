import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildServer } from "../server.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import type { UniverseManager } from "../dmx/universe-manager.js";
import {
  createMockUniverse,
  createTestConfig,
  createTestFixtureStore,
  createMockOflClient,
  createMockRegistry,
} from "../test-helpers.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { FastifyInstance } from "fastify";
import { createOflDiskCache } from "../ofl/ofl-disk-cache.js";
import type { OflDiskCache } from "../ofl/ofl-disk-cache.js";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("OFL cache routes", () => {
  let app: FastifyInstance;
  let store: FixtureStore;
  let universe: ReturnType<typeof createMockUniverse>;
  let manager: UniverseManager;
  let diskCache: OflDiskCache;
  let cacheDir: string;

  beforeEach(async () => {
    universe = createMockUniverse();
    manager = createUniverseManager(universe);
    manager.resumeNormal();
    store = createTestFixtureStore();
    cacheDir = await mkdtemp(join(tmpdir(), "dmxr-ofl-cache-test-"));
    diskCache = createOflDiskCache({ cacheDir });
    ({ app } = await buildServer({
      config: createTestConfig(),
      manager,
      driver: "null",
      startTime: Date.now(),
      fixtureStore: store,
      oflClient: createMockOflClient(),
      registry: createMockRegistry(),
      diskCache,
    }));
  });

  afterEach(async () => {
    store.dispose();
    await app.close();
    await rm(cacheDir, { recursive: true, force: true });
  });

  describe("GET /api/settings/ofl-cache", () => {
    it("returns stats for empty cache", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/settings/ofl-cache",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.entryCount).toBe(0);
      expect(body.totalSize).toBe(0);
    });

    it("returns stats after populating cache", async () => {
      await diskCache.set("test:key", { foo: "bar" });

      const res = await app.inject({
        method: "GET",
        url: "/api/settings/ofl-cache",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.entryCount).toBe(1);
      expect(body.totalSize).toBeGreaterThan(0);
    });
  });

  describe("POST /api/settings/ofl-cache/clear", () => {
    it("returns success after clearing", async () => {
      await diskCache.set("test:key", { foo: "bar" });

      const res = await app.inject({
        method: "POST",
        url: "/api/settings/ofl-cache/clear",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      // Verify cache is actually empty
      const statsRes = await app.inject({
        method: "GET",
        url: "/api/settings/ofl-cache",
      });
      expect(statsRes.json().entryCount).toBe(0);
    });

    it("returns success even when cache is already empty", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/settings/ofl-cache/clear",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });
});
