import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildServer } from "../server.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import { createMockUniverse, createTestConfig, createTestFixtureStore, createMockOflClient, createMockRegistry } from "../test-helpers.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { FastifyInstance } from "fastify";

const validFixtureBody = {
  name: "Test PAR",
  oflKey: "cameo/flat-pro-18",
  oflFixtureName: "Flat Pro 18",
  mode: "3-channel",
  dmxStartAddress: 1,
  channelCount: 3,
  channels: [
    { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
    { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
  ],
};

describe("Fixture routes", () => {
  let app: FastifyInstance;
  let store: FixtureStore;

  beforeEach(async () => {
    const manager = createUniverseManager(createMockUniverse());
    store = createTestFixtureStore();
    app = await buildServer({
      config: createTestConfig(),
      manager,
      driver: "null",
      startTime: Date.now(),
      fixtureStore: store,
      oflClient: createMockOflClient(),
      registry: createMockRegistry(),
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /fixtures", () => {
    it("returns empty array initially", async () => {
      const res = await app.inject({ method: "GET", url: "/fixtures" });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns fixtures after adding", async () => {
      await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });

      const res = await app.inject({ method: "GET", url: "/fixtures" });
      const body = res.json();

      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("Test PAR");
    });
  });

  describe("POST /fixtures", () => {
    it("creates fixture and returns 201", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBeDefined();
      expect(body.name).toBe("Test PAR");
      expect(body.dmxStartAddress).toBe(1);
      expect(body.channelCount).toBe(3);
    });

    it("returns 400 for missing required fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: { name: "Test" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 409 for overlapping addresses", async () => {
      await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });

      const res = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: { ...validFixtureBody, name: "Second", dmxStartAddress: 2 },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toContain("Overlaps");
    });

    it("allows non-overlapping fixtures", async () => {
      await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });

      const res = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: { ...validFixtureBody, name: "Second", dmxStartAddress: 4 },
      });

      expect(res.statusCode).toBe(201);
    });

    it("returns 409 for address exceeding 512", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: { ...validFixtureBody, dmxStartAddress: 511, channelCount: 3 },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  describe("PATCH /fixtures/:id", () => {
    it("updates name and returns 200", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const patchRes = await app.inject({
        method: "PATCH",
        url: `/fixtures/${id}`,
        payload: { name: "Renamed PAR" },
      });

      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json().name).toBe("Renamed PAR");
      expect(patchRes.json().id).toBe(id);
    });

    it("updates dmxStartAddress and returns 200", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const patchRes = await app.inject({
        method: "PATCH",
        url: `/fixtures/${id}`,
        payload: { dmxStartAddress: 100 },
      });

      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json().dmxStartAddress).toBe(100);
    });

    it("returns 404 for unknown id", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/fixtures/nonexistent",
        payload: { name: "X" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 409 for overlapping address", async () => {
      await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });

      const addRes2 = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: { ...validFixtureBody, name: "Second", dmxStartAddress: 10 },
      });
      const { id } = addRes2.json();

      const patchRes = await app.inject({
        method: "PATCH",
        url: `/fixtures/${id}`,
        payload: { dmxStartAddress: 2 },
      });

      expect(patchRes.statusCode).toBe(409);
      expect(patchRes.json().error).toContain("Overlaps");
    });

    it("allows moving to same address (self-overlap)", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const patchRes = await app.inject({
        method: "PATCH",
        url: `/fixtures/${id}`,
        payload: { dmxStartAddress: 1 },
      });

      expect(patchRes.statusCode).toBe(200);
    });

    it("returns 400 for invalid address", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const patchRes = await app.inject({
        method: "PATCH",
        url: `/fixtures/${id}`,
        payload: { dmxStartAddress: 0 },
      });

      expect(patchRes.statusCode).toBe(400);
    });
  });

  describe("DELETE /fixtures/:id", () => {
    it("removes fixture and returns success", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const delRes = await app.inject({
        method: "DELETE",
        url: `/fixtures/${id}`,
      });

      expect(delRes.statusCode).toBe(200);
      expect(delRes.json().success).toBe(true);

      const listRes = await app.inject({ method: "GET", url: "/fixtures" });
      expect(listRes.json()).toHaveLength(0);
    });

    it("returns 404 for unknown id", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/fixtures/nonexistent",
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
