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

describe("fixture-batch routes", () => {
  let app: FastifyInstance;
  let fixtureStore: FixtureStore;
  let groupStore: GroupStore;
  let fixturePath: string;
  let groupPath: string;

  beforeEach(async () => {
    const ts = Date.now();
    fixturePath = join(tmpdir(), `dmxr-batch-fix-${ts}.json`);
    groupPath = join(tmpdir(), `dmxr-batch-grp-${ts}.json`);
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

  describe("DELETE /fixtures/batch", () => {
    it("deletes multiple fixtures", async () => {
      const f1 = fixtureStore.add(makeRequest({ name: "A", dmxStartAddress: 1 }));
      const f2 = fixtureStore.add(makeRequest({ name: "B", dmxStartAddress: 10 }));
      fixtureStore.add(makeRequest({ name: "C", dmxStartAddress: 20 }));

      const res = await app.inject({
        method: "DELETE",
        url: "/fixtures/batch",
        payload: { ids: [f1.id, f2.id] },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.deleted).toEqual([f1.id, f2.id]);
      expect(body.count).toBe(2);
      expect(fixtureStore.getAll()).toHaveLength(1);
      expect(fixtureStore.getAll()[0].name).toBe("C");
    });

    it("returns 400 for unknown IDs", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/fixtures/batch",
        payload: { ids: ["nonexistent"] },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/Unknown fixture IDs/);
    });

    it("removes fixtures from groups before deleting", async () => {
      const f1 = fixtureStore.add(makeRequest({ name: "A", dmxStartAddress: 1 }));
      const f2 = fixtureStore.add(makeRequest({ name: "B", dmxStartAddress: 10 }));
      groupStore.add({ name: "Test Group", fixtureIds: [f1.id, f2.id] });

      await app.inject({
        method: "DELETE",
        url: "/fixtures/batch",
        payload: { ids: [f1.id] },
      });

      const group = groupStore.getAll()[0];
      expect(group.fixtureIds).not.toContain(f1.id);
      expect(group.fixtureIds).toContain(f2.id);
    });
  });

  describe("PATCH /fixtures/batch-move", () => {
    it("moves multiple fixtures to new addresses atomically", async () => {
      const f1 = fixtureStore.add(makeRequest({ name: "A", dmxStartAddress: 1 }));
      const f2 = fixtureStore.add(makeRequest({ name: "B", dmxStartAddress: 10 }));

      const res = await app.inject({
        method: "PATCH",
        url: "/fixtures/batch-move",
        payload: {
          moves: [
            { id: f1.id, dmxStartAddress: 100 },
            { id: f2.id, dmxStartAddress: 200 },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.moved).toHaveLength(2);
      expect(fixtureStore.getById(f1.id)!.dmxStartAddress).toBe(100);
      expect(fixtureStore.getById(f2.id)!.dmxStartAddress).toBe(200);
    });

    it("preserves relative spacing (delta applied uniformly)", async () => {
      const f1 = fixtureStore.add(makeRequest({ name: "A", dmxStartAddress: 1 }));
      const f2 = fixtureStore.add(makeRequest({ name: "B", dmxStartAddress: 10 }));

      // Move both by +50
      const res = await app.inject({
        method: "PATCH",
        url: "/fixtures/batch-move",
        payload: {
          moves: [
            { id: f1.id, dmxStartAddress: 51 },
            { id: f2.id, dmxStartAddress: 60 },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      // Spacing preserved: 60 - 51 = 9 = 10 - 1
      expect(fixtureStore.getById(f1.id)!.dmxStartAddress).toBe(51);
      expect(fixtureStore.getById(f2.id)!.dmxStartAddress).toBe(60);
    });

    it("returns 400 if any ID is unknown", async () => {
      const f1 = fixtureStore.add(makeRequest({ name: "A", dmxStartAddress: 1 }));

      const res = await app.inject({
        method: "PATCH",
        url: "/fixtures/batch-move",
        payload: {
          moves: [
            { id: f1.id, dmxStartAddress: 100 },
            { id: "nonexistent", dmxStartAddress: 200 },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/Unknown fixture ID/);
      // Original should be unchanged (atomic — no partial application)
      expect(fixtureStore.getById(f1.id)!.dmxStartAddress).toBe(1);
    });

    it("returns 409 if any target overlaps a stationary fixture", async () => {
      const f1 = fixtureStore.add(makeRequest({ name: "A", dmxStartAddress: 1 }));
      fixtureStore.add(makeRequest({ name: "Stationary", dmxStartAddress: 50 }));

      const res = await app.inject({
        method: "PATCH",
        url: "/fixtures/batch-move",
        payload: {
          moves: [{ id: f1.id, dmxStartAddress: 49 }],
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toMatch(/Overlaps/);
      // Unchanged
      expect(fixtureStore.getById(f1.id)!.dmxStartAddress).toBe(1);
    });

    it("returns 409 if targets overlap each other (non-uniform delta)", async () => {
      const f1 = fixtureStore.add(makeRequest({ name: "A", dmxStartAddress: 1 }));
      const f2 = fixtureStore.add(makeRequest({ name: "B", dmxStartAddress: 10 }));

      const res = await app.inject({
        method: "PATCH",
        url: "/fixtures/batch-move",
        payload: {
          moves: [
            { id: f1.id, dmxStartAddress: 100 },
            { id: f2.id, dmxStartAddress: 101 }, // overlaps A's 100-102
          ],
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toMatch(/Overlaps/);
    });

    it("returns 409 if any target exceeds channel 512 or below 1", async () => {
      const f1 = fixtureStore.add(makeRequest({ name: "A", dmxStartAddress: 1 }));

      const resOver = await app.inject({
        method: "PATCH",
        url: "/fixtures/batch-move",
        payload: {
          moves: [{ id: f1.id, dmxStartAddress: 511 }], // 511-513 exceeds 512
        },
      });
      expect(resOver.statusCode).toBe(409);

      const resUnder = await app.inject({
        method: "PATCH",
        url: "/fixtures/batch-move",
        payload: {
          moves: [{ id: f1.id, dmxStartAddress: 0 }],
        },
      });
      // Schema rejects dmxStartAddress < 1 as 400
      expect(resUnder.statusCode).toBe(400);
    });

    it("allows fixtures that swap positions (A→B old spot, B→A old spot)", async () => {
      const f1 = fixtureStore.add(makeRequest({ name: "A", dmxStartAddress: 1 }));
      const f2 = fixtureStore.add(makeRequest({ name: "B", dmxStartAddress: 10 }));

      const res = await app.inject({
        method: "PATCH",
        url: "/fixtures/batch-move",
        payload: {
          moves: [
            { id: f1.id, dmxStartAddress: 10 },
            { id: f2.id, dmxStartAddress: 1 },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      expect(fixtureStore.getById(f1.id)!.dmxStartAddress).toBe(10);
      expect(fixtureStore.getById(f2.id)!.dmxStartAddress).toBe(1);
    });

    it("returns 400 for empty moves array", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/fixtures/batch-move",
        payload: { moves: [] },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /fixtures/batch-duplicate", () => {
    it("duplicates multiple fixtures at auto-found addresses", async () => {
      const f1 = fixtureStore.add(makeRequest({ name: "A", dmxStartAddress: 1 }));
      const f2 = fixtureStore.add(makeRequest({ name: "B", dmxStartAddress: 10 }));

      const res = await app.inject({
        method: "POST",
        url: "/fixtures/batch-duplicate",
        payload: { ids: [f1.id, f2.id] },
      });

      expect(res.statusCode).toBe(201);
      const created = res.json();
      expect(created).toHaveLength(2);
      expect(created[0].name).toBe("A (copy)");
      expect(created[1].name).toBe("B (copy)");
      // Duplicates should not overlap originals or each other
      expect(fixtureStore.getAll()).toHaveLength(4);
    });

    it("returns 400 for unknown source IDs", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/batch-duplicate",
        payload: { ids: ["nonexistent"] },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/Unknown fixture ID/);
    });

    it("returns 409 when no address space available", async () => {
      // Fill the universe with a huge fixture
      fixtureStore.add(
        makeRequest({
          name: "Giant",
          dmxStartAddress: 1,
          channelCount: 512,
          channels: Array.from({ length: 512 }, (_, i) => ({
            offset: i,
            name: `Ch${i}`,
            type: "Generic",
            defaultValue: 0,
          })),
        }),
      );

      const f1 = fixtureStore.getAll()[0];

      const res = await app.inject({
        method: "POST",
        url: "/fixtures/batch-duplicate",
        payload: { ids: [f1.id] },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toMatch(/No available DMX address space/);
    });

    it("places duplicates without overlapping each other", async () => {
      const f1 = fixtureStore.add(makeRequest({ name: "A", dmxStartAddress: 1 }));

      const res = await app.inject({
        method: "POST",
        url: "/fixtures/batch-duplicate",
        payload: { ids: [f1.id, f1.id] },
      });

      expect(res.statusCode).toBe(201);
      const created = res.json();
      // Each duplicate should have a distinct, non-overlapping address
      const addr1 = created[0].dmxStartAddress;
      const addr2 = created[1].dmxStartAddress;
      expect(Math.abs(addr1 - addr2)).toBeGreaterThanOrEqual(3);
    });
  });
});
