import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildServer } from "../server.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import type { UniverseManager } from "../dmx/universe-manager.js";
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

const movingHeadBody = {
  name: "Moving Head",
  mode: "13ch",
  dmxStartAddress: 40,
  channelCount: 6,
  channels: [
    { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
    { offset: 1, name: "Pan Fine", type: "Pan", defaultValue: 0 },
    { offset: 2, name: "Tilt", type: "Tilt", defaultValue: 128 },
    { offset: 3, name: "Tilt Fine", type: "Tilt", defaultValue: 0 },
    { offset: 4, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    { offset: 5, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
  ],
};

describe("Fixture routes", () => {
  let app: FastifyInstance;
  let store: FixtureStore;
  let universe: ReturnType<typeof createMockUniverse>;
  let manager: UniverseManager;

  beforeEach(async () => {
    universe = createMockUniverse();
    manager = createUniverseManager(universe);
    manager.resumeNormal();
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
    store.dispose();
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

    it("creates fixture with channelRemap", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: { ...validFixtureBody, channelRemap: { 1: 2, 2: 1 } },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().channelRemap).toEqual({ "1": 2, "2": 1 });
    });

    it("returns 400 for invalid channelRemap (duplicate targets)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: { ...validFixtureBody, channelRemap: { 0: 1, 1: 1 } },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Duplicate target");
    });

    it("creates fixture without channelRemap (backward-compat)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().channelRemap).toBeUndefined();
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

    it("updates channelOverrides and returns 200", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const patchRes = await app.inject({
        method: "PATCH",
        url: `/fixtures/${id}`,
        payload: { channelOverrides: { "0": { value: 128, enabled: true } } },
      });

      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json().channelOverrides).toEqual({ "0": { value: 128, enabled: true } });
    });

    it("updates whiteGateThreshold and returns 200", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const patchRes = await app.inject({
        method: "PATCH",
        url: `/fixtures/${id}`,
        payload: { whiteGateThreshold: 200 },
      });

      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json().whiteGateThreshold).toBe(200);
    });

    it("returns 400 for override value > 255", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const patchRes = await app.inject({
        method: "PATCH",
        url: `/fixtures/${id}`,
        payload: { channelOverrides: { "0": { value: 300, enabled: true } } },
      });

      expect(patchRes.statusCode).toBe(400);
    });

    it("pushes enabled override value to DMX immediately", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: movingHeadBody,
      });
      const { id } = addRes.json();

      universe.updateCalls.length = 0; // clear any prior calls

      await app.inject({
        method: "PATCH",
        url: `/fixtures/${id}`,
        payload: { channelOverrides: { "2": { value: 100, enabled: true } } },
      });

      // Tilt (offset 2, base 40) → DMX addr 42 should be pushed immediately
      expect(universe.updateCalls).toHaveLength(1);
      expect(universe.updateCalls[0][42]).toBe(100);
    });

    it("pushes defaultValue to DMX when override is disabled", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: movingHeadBody,
      });
      const { id } = addRes.json();

      universe.updateCalls.length = 0;

      await app.inject({
        method: "PATCH",
        url: `/fixtures/${id}`,
        payload: { channelOverrides: { "2": { value: 100, enabled: false } } },
      });

      // Tilt override disabled → reverts to defaultValue 128
      expect(universe.updateCalls).toHaveLength(1);
      expect(universe.updateCalls[0][42]).toBe(128);
    });

    it("uses safe center for motor channels when override disabled and defaultValue is 0", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: movingHeadBody,
      });
      const { id } = addRes.json();

      universe.updateCalls.length = 0;

      // Pan Fine (offset 1) has defaultValue=0 and type=Pan
      // Motor guard should clamp to 2 (min with buffer 4), not send 0
      await app.inject({
        method: "PATCH",
        url: `/fixtures/${id}`,
        payload: { channelOverrides: { "1": { value: 50, enabled: false } } },
      });

      expect(universe.updateCalls).toHaveLength(1);
      // Pan Fine defaultValue=0 → clamped to motor guard min (2)
      expect(universe.updateCalls[0][41]).toBe(2);
    });

    it("pushes multiple override channels in one update", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: movingHeadBody,
      });
      const { id } = addRes.json();

      universe.updateCalls.length = 0;

      await app.inject({
        method: "PATCH",
        url: `/fixtures/${id}`,
        payload: {
          channelOverrides: {
            "0": { value: 200, enabled: true },
            "2": { value: 50, enabled: true },
          },
        },
      });

      expect(universe.updateCalls).toHaveLength(1);
      expect(universe.updateCalls[0][40]).toBe(200); // Pan
      expect(universe.updateCalls[0][42]).toBe(50);  // Tilt
    });
  });

  describe("POST /fixtures/:id/duplicate", () => {
    it("duplicates fixture with auto-calculated address", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const dupRes = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/duplicate`,
        payload: {},
      });

      expect(dupRes.statusCode).toBe(201);
      const body = dupRes.json();
      expect(body.name).toBe("Test PAR (copy)");
      expect(body.dmxStartAddress).toBe(4); // 1 + 3 channels
      expect(body.channelCount).toBe(3);
      expect(body.id).not.toBe(id);
    });

    it("uses custom name when provided", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const dupRes = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/duplicate`,
        payload: { name: "Stage Right PAR" },
      });

      expect(dupRes.statusCode).toBe(201);
      expect(dupRes.json().name).toBe("Stage Right PAR");
    });

    it("uses explicit address when provided", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const dupRes = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/duplicate`,
        payload: { dmxStartAddress: 100 },
      });

      expect(dupRes.statusCode).toBe(201);
      expect(dupRes.json().dmxStartAddress).toBe(100);
    });

    it("returns 404 for unknown source fixture", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/nonexistent/duplicate",
        payload: {},
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 409 when explicit address overlaps", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: validFixtureBody,
      });
      const { id } = addRes.json();

      const dupRes = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/duplicate`,
        payload: { dmxStartAddress: 2 },
      });

      expect(dupRes.statusCode).toBe(409);
    });

    it("returns 409 when no space available for auto-address", async () => {
      // Fill up the universe with a fixture spanning channels 1-512
      const bigFixture = {
        name: "Big",
        mode: "512ch",
        dmxStartAddress: 1,
        channelCount: 512,
        channels: Array.from({ length: 512 }, (_, i) => ({
          offset: i,
          name: `Ch ${i + 1}`,
          type: "Generic",
          defaultValue: 0,
        })),
      };
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: bigFixture,
      });
      const { id } = addRes.json();

      const dupRes = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/duplicate`,
        payload: {},
      });

      expect(dupRes.statusCode).toBe(409);
      expect(dupRes.json().error).toContain("No available");
    });

    it("copies oflKey and source from original", async () => {
      const addRes = await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: { ...validFixtureBody, source: "ofl" },
      });
      const { id } = addRes.json();

      const dupRes = await app.inject({
        method: "POST",
        url: `/fixtures/${id}/duplicate`,
        payload: {},
      });

      const body = dupRes.json();
      expect(body.oflKey).toBe("cameo/flat-pro-18");
      expect(body.source).toBe("ofl");
    });
  });

  describe("POST /fixtures/batch", () => {
    const batchBody = {
      name: "PAR",
      mode: "3-channel",
      startAddress: 1,
      count: 4,
      channelCount: 3,
      channels: [
        { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
        { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
        { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
      ],
    };

    it("creates multiple fixtures with auto-spaced addresses", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/batch",
        payload: batchBody,
      });

      expect(res.statusCode).toBe(201);
      const fixtures = res.json();
      expect(fixtures).toHaveLength(4);
      expect(fixtures[0].name).toBe("PAR 1");
      expect(fixtures[1].name).toBe("PAR 2");
      expect(fixtures[2].name).toBe("PAR 3");
      expect(fixtures[3].name).toBe("PAR 4");
      expect(fixtures[0].dmxStartAddress).toBe(1);
      expect(fixtures[1].dmxStartAddress).toBe(4);
      expect(fixtures[2].dmxStartAddress).toBe(7);
      expect(fixtures[3].dmxStartAddress).toBe(10);
    });

    it("uses custom spacing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/batch",
        payload: { ...batchBody, spacing: 5 },
      });

      expect(res.statusCode).toBe(201);
      const fixtures = res.json();
      expect(fixtures[0].dmxStartAddress).toBe(1);
      expect(fixtures[1].dmxStartAddress).toBe(6);
      expect(fixtures[2].dmxStartAddress).toBe(11);
      expect(fixtures[3].dmxStartAddress).toBe(16);
    });

    it("uses plain name (no suffix) for count=1", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/batch",
        payload: { ...batchBody, count: 1 },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json()[0].name).toBe("PAR");
    });

    it("returns 409 when batch extends beyond channel 512", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/batch",
        payload: { ...batchBody, startAddress: 500, count: 5 },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toContain("beyond channel 512");
    });

    it("returns 400 when spacing < channelCount", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/batch",
        payload: { ...batchBody, spacing: 2 },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Spacing");
    });

    it("returns 409 when batch overlaps existing fixture", async () => {
      await app.inject({
        method: "POST",
        url: "/fixtures",
        payload: { ...validFixtureBody, dmxStartAddress: 5 },
      });

      const res = await app.inject({
        method: "POST",
        url: "/fixtures/batch",
        payload: { ...batchBody, startAddress: 1, count: 3 },
      });

      // Fixture 2 at DMX 4 overlaps with existing at DMX 5-7
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toContain("Fixture 2");
    });

    it("returns 400 for missing required fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/batch",
        payload: { name: "Test" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for channelCount mismatch", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/batch",
        payload: { ...batchBody, channelCount: 5 },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("channelCount");
    });

    it("creates batch fixtures with channelRemap", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/batch",
        payload: { ...batchBody, channelRemap: { 1: 2, 2: 1 } },
      });
      expect(res.statusCode).toBe(201);
      const fixtures = res.json();
      for (const f of fixtures) {
        expect(f.channelRemap).toEqual({ "1": 2, "2": 1 });
      }
    });

    it("propagates oflKey and source to all fixtures", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/batch",
        payload: { ...batchBody, oflKey: "cameo/flat-pro-18", source: "ofl" },
      });

      expect(res.statusCode).toBe(201);
      const fixtures = res.json();
      for (const f of fixtures) {
        expect(f.oflKey).toBe("cameo/flat-pro-18");
        expect(f.source).toBe("ofl");
      }
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
