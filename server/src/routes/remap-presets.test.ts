import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../server.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import {
  createMockUniverse,
  createTestConfig,
  createTestFixtureStore,
  createMockOflClient,
  createMockRegistry,
} from "../test-helpers.js";
import { createRemapPresetStore } from "../config/remap-preset-store.js";
import type { RemapPresetStore } from "../config/remap-preset-store.js";

describe("Remap preset routes", () => {
  let app: FastifyInstance;
  let store: RemapPresetStore;
  let filePath: string;

  beforeEach(async () => {
    filePath = `/tmp/dmxr-test-presets-${randomUUID()}.json`;
    store = createRemapPresetStore(filePath);
    await store.load();

    const universe = createMockUniverse();
    const manager = createUniverseManager(universe);
    manager.resumeNormal();

    app = await buildServer({
      config: createTestConfig(),
      manager,
      driver: "null",
      startTime: Date.now(),
      fixtureStore: createTestFixtureStore(),
      oflClient: createMockOflClient(),
      registry: createMockRegistry(),
      remapPresetStore: store,
    });
  });

  afterEach(async () => {
    await app.close();
    try {
      await unlink(filePath);
    } catch {
      // may not exist
    }
  });

  describe("GET /remap-presets", () => {
    it("returns empty object initially", async () => {
      const res = await app.inject({ method: "GET", url: "/remap-presets" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({});
    });
  });

  describe("PUT /remap-presets/:key", () => {
    it("creates a preset with valid body", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/remap-presets/test-par",
        payload: { channelCount: 3, remap: { 1: 2, 2: 1 } },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        channelCount: 3,
        remap: { 1: 2, 2: 1 },
      });
    });

    it("rejects duplicate targets with 400", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/remap-presets/bad",
        payload: { channelCount: 3, remap: { 0: 1, 1: 1 } },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/[Dd]uplicate/);
    });
  });

  describe("GET /remap-presets/:key", () => {
    it("returns 200 for known key", async () => {
      store.upsert("my-preset", { channelCount: 5, remap: { 0: 4 } });

      const res = await app.inject({
        method: "GET",
        url: "/remap-presets/my-preset",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ channelCount: 5, remap: { 0: 4 } });
    });

    it("returns 404 for unknown key", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/remap-presets/unknown",
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /remap-presets/:key", () => {
    it("returns 204 for known key", async () => {
      store.upsert("deletable", { channelCount: 3, remap: { 0: 1 } });

      const res = await app.inject({
        method: "DELETE",
        url: "/remap-presets/deletable",
      });

      expect(res.statusCode).toBe(204);
    });

    it("returns 404 for unknown key", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/remap-presets/nope",
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("URL-encoded keys with slashes", () => {
    it("handles slash-delimited keys via encodeURIComponent", async () => {
      const key = "oppsk/bl-18/7ch";
      const encoded = encodeURIComponent(key);

      const putRes = await app.inject({
        method: "PUT",
        url: `/remap-presets/${encoded}`,
        payload: { channelCount: 7, remap: { 0: 6, 6: 0 } },
      });
      expect(putRes.statusCode).toBe(200);

      const getRes = await app.inject({
        method: "GET",
        url: `/remap-presets/${encoded}`,
      });
      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().channelCount).toBe(7);
    });
  });
});
