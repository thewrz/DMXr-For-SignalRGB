import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { registerGroupRoutes } from "./groups.js";
import type { GroupStore } from "../fixtures/group-store.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { FixtureGroup } from "../types/protocol.js";

function mockGroupStore(overrides: Partial<GroupStore> = {}): GroupStore {
  return {
    getAll: vi.fn().mockReturnValue([]),
    getById: vi.fn().mockReturnValue(undefined),
    add: vi.fn().mockImplementation((req) => ({
      id: "g1",
      ...req,
      fixtureIds: [...req.fixtureIds],
      createdAt: new Date().toISOString(),
    })),
    update: vi.fn().mockReturnValue(undefined),
    remove: vi.fn().mockReturnValue(false),
    getGroupsForFixture: vi.fn().mockReturnValue([]),
    removeFixtureFromAll: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    scheduleSave: vi.fn(),
    load: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    ...overrides,
  };
}

function mockFixtureStore(overrides: Partial<FixtureStore> = {}): FixtureStore {
  return {
    getAll: vi.fn().mockReturnValue([]),
    getById: vi.fn().mockReturnValue(undefined),
    getByUniverse: vi.fn().mockReturnValue([]),
    add: vi.fn(),
    addBatch: vi.fn(),
    update: vi.fn(),
    remove: vi.fn().mockReturnValue(false),
    save: vi.fn().mockResolvedValue(undefined),
    scheduleSave: vi.fn(),
    load: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    ...overrides,
  };
}

const sampleGroup: FixtureGroup = {
  id: "g1",
  name: "Front Wash",
  fixtureIds: ["f1", "f2"],
  color: "#ff0000",
  createdAt: "2026-03-06T00:00:00.000Z",
};

describe("Group routes", () => {
  let app: FastifyInstance;
  let groupStore: GroupStore;
  let fixtureStore: FixtureStore;

  beforeEach(async () => {
    groupStore = mockGroupStore();
    fixtureStore = mockFixtureStore();
    app = Fastify();
    registerGroupRoutes(app, { groupStore, fixtureStore });
    await app.ready();
  });

  describe("GET /groups", () => {
    it("returns all groups", async () => {
      vi.mocked(groupStore.getAll).mockReturnValue([sampleGroup]);

      const res = await app.inject({ method: "GET", url: "/groups" });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([sampleGroup]);
    });

    it("returns empty array when no groups exist", async () => {
      const res = await app.inject({ method: "GET", url: "/groups" });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });

  describe("POST /groups", () => {
    it("creates a group and returns 201", async () => {
      vi.mocked(fixtureStore.getById).mockReturnValue({
        id: "f1",
        name: "PAR",
        mode: "3ch",
        dmxStartAddress: 1,
        channelCount: 3,
        channels: [],
      });

      const res = await app.inject({
        method: "POST",
        url: "/groups",
        payload: { name: "Stage Left", fixtureIds: ["f1"], color: "#00ff00" },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toHaveProperty("id");
      expect(groupStore.add).toHaveBeenCalled();
      expect(groupStore.save).toHaveBeenCalled();
    });

    it("rejects when fixtureIds reference unknown fixtures", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/groups",
        payload: { name: "Bad Group", fixtureIds: ["unknown-id"] },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Unknown fixture IDs");
    });

    it("rejects empty name via schema validation", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/groups",
        payload: { name: "", fixtureIds: [] },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects missing fixtureIds", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/groups",
        payload: { name: "No Members" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when store throws for duplicate name", async () => {
      vi.mocked(fixtureStore.getById).mockReturnValue({
        id: "f1",
        name: "PAR",
        mode: "3ch",
        dmxStartAddress: 1,
        channelCount: 3,
        channels: [],
      });
      vi.mocked(groupStore.add).mockImplementation(() => {
        throw new Error('Group name "Dupes" already exists');
      });

      const res = await app.inject({
        method: "POST",
        url: "/groups",
        payload: { name: "Dupes", fixtureIds: ["f1"] },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("already exists");
    });
  });

  describe("GET /groups/:id", () => {
    it("returns a group by id", async () => {
      vi.mocked(groupStore.getById).mockReturnValue(sampleGroup);

      const res = await app.inject({ method: "GET", url: "/groups/g1" });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(sampleGroup);
    });

    it("returns 404 for unknown group", async () => {
      const res = await app.inject({ method: "GET", url: "/groups/nope" });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("Group not found");
    });
  });

  describe("PATCH /groups/:id", () => {
    it("updates a group and returns 200", async () => {
      const updated = { ...sampleGroup, name: "Renamed" };
      vi.mocked(groupStore.update).mockReturnValue(updated);

      const res = await app.inject({
        method: "PATCH",
        url: "/groups/g1",
        payload: { name: "Renamed" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe("Renamed");
      expect(groupStore.scheduleSave).toHaveBeenCalled();
    });

    it("returns 404 for unknown group", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/groups/nope",
        payload: { name: "Whatever" },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("Group not found");
    });

    it("validates fixtureIds when provided", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/groups/g1",
        payload: { fixtureIds: ["unknown-fixture"] },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Unknown fixture IDs");
    });

    it("returns 400 when store throws for duplicate name", async () => {
      vi.mocked(groupStore.update).mockImplementation(() => {
        throw new Error('Group name "Dupes" already exists');
      });

      const res = await app.inject({
        method: "PATCH",
        url: "/groups/g1",
        payload: { name: "Dupes" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("already exists");
    });
  });

  describe("DELETE /groups/:id", () => {
    it("deletes a group and returns success", async () => {
      vi.mocked(groupStore.remove).mockReturnValue(true);

      const res = await app.inject({ method: "DELETE", url: "/groups/g1" });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true });
      expect(groupStore.save).toHaveBeenCalled();
    });

    it("returns 404 for unknown group", async () => {
      const res = await app.inject({ method: "DELETE", url: "/groups/nope" });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe("Group not found");
    });
  });
});
