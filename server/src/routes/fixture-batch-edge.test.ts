import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { createFixtureStore } from "../fixtures/fixture-store.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { AddFixtureRequest } from "../types/protocol.js";
import { registerFixtureBatchRoutes } from "./fixture-batch.js";
import { createGroupStore } from "../fixtures/group-store.js";
import type { GroupStore } from "../fixtures/group-store.js";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rm } from "node:fs/promises";

function makeRequest(overrides: Partial<AddFixtureRequest> = {}): AddFixtureRequest {
  return {
    name: "Test PAR",
    mode: "3ch",
    dmxStartAddress: 1,
    channelCount: 3,
    channels: [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ],
    ...overrides,
  };
}

describe("fixture-batch routes edge cases", () => {
  let app: FastifyInstance;
  let fixtureStore: FixtureStore;
  let groupStore: GroupStore;
  let fixturePath: string;
  let groupPath: string;

  beforeEach(async () => {
    const ts = Date.now();
    fixturePath = join(tmpdir(), `dmxr-batch-edge-fix-${ts}.json`);
    groupPath = join(tmpdir(), `dmxr-batch-edge-grp-${ts}.json`);
    fixtureStore = createFixtureStore(fixturePath);
    groupStore = createGroupStore(groupPath);

    app = Fastify();
    registerFixtureBatchRoutes(app, { fixtureStore, groupStore });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await rm(fixturePath, { force: true });
    await rm(groupPath, { force: true });
  });

  describe("DELETE /fixtures/batch edge cases", () => {
    it("returns 400 for empty ids array", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/fixtures/batch",
        payload: { ids: [] },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when some ids are unknown and some are valid", async () => {
      const f1 = fixtureStore.add(makeRequest({ name: "A", dmxStartAddress: 1 }));

      const res = await app.inject({
        method: "DELETE",
        url: "/fixtures/batch",
        payload: { ids: [f1.id, "nonexistent"] },
      });

      expect(res.statusCode).toBe(400);
      // Original fixture should be untouched (atomic validation)
      expect(fixtureStore.getById(f1.id)).toBeDefined();
    });

    it("removes fixture from multiple groups", async () => {
      const f1 = fixtureStore.add(makeRequest({ name: "A", dmxStartAddress: 1 }));
      groupStore.add({ name: "Group 1", fixtureIds: [f1.id] });
      groupStore.add({ name: "Group 2", fixtureIds: [f1.id] });

      await app.inject({
        method: "DELETE",
        url: "/fixtures/batch",
        payload: { ids: [f1.id] },
      });

      const groups = groupStore.getAll();
      expect(groups[0].fixtureIds).not.toContain(f1.id);
      expect(groups[1].fixtureIds).not.toContain(f1.id);
    });
  });

  describe("POST /fixtures/batch-duplicate edge cases", () => {
    it("duplicates fixture to a different universe", async () => {
      const f1 = fixtureStore.add(makeRequest({
        name: "A",
        dmxStartAddress: 1,
        universeId: "universe-1",
      }));

      const res = await app.inject({
        method: "POST",
        url: "/fixtures/batch-duplicate",
        payload: { ids: [f1.id], universeId: "universe-2" },
      });

      expect(res.statusCode).toBe(201);
      const created = res.json();
      expect(created[0].name).toBe("A (copy)");
      expect(created[0].universeId).toBe("universe-2");
    });

    it("copies OFL metadata from source fixture", async () => {
      const f1 = fixtureStore.add(makeRequest({
        name: "My Light",
        dmxStartAddress: 1,
        oflKey: "cameo/flat-pro-18",
        oflFixtureName: "Flat Pro 18",
        source: "ofl",
        category: "Color Changer",
      }));

      const res = await app.inject({
        method: "POST",
        url: "/fixtures/batch-duplicate",
        payload: { ids: [f1.id] },
      });

      expect(res.statusCode).toBe(201);
      const created = res.json();
      expect(created[0].oflKey).toBe("cameo/flat-pro-18");
      expect(created[0].oflFixtureName).toBe("Flat Pro 18");
      expect(created[0].source).toBe("ofl");
      expect(created[0].category).toBe("Color Changer");
    });

    it("returns 400 for empty ids array", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/batch-duplicate",
        payload: { ids: [] },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("PATCH /fixtures/batch-move edge cases", () => {
    it("allows moving a single fixture to its current position", async () => {
      const f1 = fixtureStore.add(makeRequest({ name: "A", dmxStartAddress: 10 }));

      const res = await app.inject({
        method: "PATCH",
        url: "/fixtures/batch-move",
        payload: {
          moves: [{ id: f1.id, dmxStartAddress: 10 }],
        },
      });

      expect(res.statusCode).toBe(200);
      expect(fixtureStore.getById(f1.id)!.dmxStartAddress).toBe(10);
    });

    it("allows moving fixture to address 1 (minimum valid)", async () => {
      const f1 = fixtureStore.add(makeRequest({ name: "A", dmxStartAddress: 100 }));

      const res = await app.inject({
        method: "PATCH",
        url: "/fixtures/batch-move",
        payload: {
          moves: [{ id: f1.id, dmxStartAddress: 1 }],
        },
      });

      expect(res.statusCode).toBe(200);
      expect(fixtureStore.getById(f1.id)!.dmxStartAddress).toBe(1);
    });

    it("allows moving fixture to address 510 (max for 3ch fixture)", async () => {
      const f1 = fixtureStore.add(makeRequest({ name: "A", dmxStartAddress: 1 }));

      const res = await app.inject({
        method: "PATCH",
        url: "/fixtures/batch-move",
        payload: {
          moves: [{ id: f1.id, dmxStartAddress: 510 }],
        },
      });

      expect(res.statusCode).toBe(200);
      expect(fixtureStore.getById(f1.id)!.dmxStartAddress).toBe(510);
    });

    it("does not modify original fixtures when validation fails", async () => {
      const f1 = fixtureStore.add(makeRequest({ name: "A", dmxStartAddress: 1 }));
      const f2 = fixtureStore.add(makeRequest({ name: "B", dmxStartAddress: 10 }));

      // First move is valid, second overlaps with first's new position
      const res = await app.inject({
        method: "PATCH",
        url: "/fixtures/batch-move",
        payload: {
          moves: [
            { id: f1.id, dmxStartAddress: 100 },
            { id: f2.id, dmxStartAddress: 101 }, // overlaps f1 at 100-102
          ],
        },
      });

      expect(res.statusCode).toBe(409);
      // Both fixtures should be unchanged
      expect(fixtureStore.getById(f1.id)!.dmxStartAddress).toBe(1);
      expect(fixtureStore.getById(f2.id)!.dmxStartAddress).toBe(10);
    });
  });
});
