import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { registerGroupControlRoutes, type GroupControlDeps } from "./group-control.js";
import type { GroupStore } from "../fixtures/group-store.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { DmxDispatcher } from "../dmx/dmx-dispatcher.js";
import type { FixtureConfig, FixtureGroup } from "../types/protocol.js";

function createTestFixture(overrides: Partial<FixtureConfig> = {}): FixtureConfig {
  return {
    id: "fixture-1",
    name: "RGB PAR",
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

function createTestGroup(overrides: Partial<FixtureGroup> = {}): FixtureGroup {
  return {
    id: "group-1",
    name: "Front Wash",
    fixtureIds: ["fixture-1", "fixture-2"],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createMockGroupStore(group?: FixtureGroup): GroupStore {
  return {
    getAll: vi.fn(() => (group ? [group] : [])),
    getById: vi.fn((id: string) => (group && group.id === id ? group : undefined)),
    add: vi.fn(() => group!),
    update: vi.fn(() => group),
    remove: vi.fn(() => true),
    getGroupsForFixture: vi.fn(() => (group ? [group] : [])),
    removeFixtureFromAll: vi.fn(),
    save: vi.fn(async () => {}),
    scheduleSave: vi.fn(),
    load: vi.fn(async () => {}),
    dispose: vi.fn(),
  };
}

function createMockFixtureStore(fixtures: FixtureConfig[]): FixtureStore {
  return {
    getAll: vi.fn(() => fixtures),
    getById: vi.fn((id: string) => fixtures.find((f) => f.id === id)),
    getByUniverse: vi.fn(() => fixtures),
    add: vi.fn(() => fixtures[0]),
    addBatch: vi.fn(() => fixtures),
    update: vi.fn(() => fixtures[0]),
    remove: vi.fn(() => true),
    save: vi.fn(async () => {}),
    scheduleSave: vi.fn(),
    load: vi.fn(async () => {}),
    dispose: vi.fn(),
  };
}

function createMockDispatcher(): DmxDispatcher {
  return {
    applyFixtureUpdate: vi.fn(() => 0),
    applyRawUpdate: vi.fn(),
    blackout: vi.fn(),
    whiteout: vi.fn(),
    resumeNormal: vi.fn(),
    getChannelSnapshot: vi.fn(() => ({ 1: 10, 2: 20, 3: 30 })),
    isBlackoutActive: vi.fn(() => false),
    getControlMode: vi.fn(() => "normal" as const),
    getActiveChannelCount: vi.fn(() => 0),
    lockChannels: vi.fn(),
    unlockChannels: vi.fn(),
  };
}

describe("Group control routes", () => {
  let app: FastifyInstance;
  let groupStore: GroupStore;
  let fixtureStore: FixtureStore;
  let dispatcher: DmxDispatcher;

  const fixture1 = createTestFixture({ id: "fixture-1", name: "PAR 1", dmxStartAddress: 1 });
  const fixture2 = createTestFixture({ id: "fixture-2", name: "PAR 2", dmxStartAddress: 10 });
  const group = createTestGroup({ fixtureIds: ["fixture-1", "fixture-2"] });

  beforeEach(async () => {
    groupStore = createMockGroupStore(group);
    fixtureStore = createMockFixtureStore([fixture1, fixture2]);
    dispatcher = createMockDispatcher();

    app = Fastify({ logger: false });
    registerGroupControlRoutes(app, { groupStore, fixtureStore, dispatcher });
    await app.ready();
  });

  describe("POST /groups/:id/blackout", () => {
    it("zeros all channels for group fixtures and locks them", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/groups/group-1/blackout",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.action).toBe("blackout");
      expect(body.fixturesUpdated).toBe(2);

      expect(dispatcher.applyRawUpdate).toHaveBeenCalledTimes(2);
      // First fixture: channels 1, 2, 3 zeroed
      expect(dispatcher.applyRawUpdate).toHaveBeenCalledWith(
        "default",
        { 1: 0, 2: 0, 3: 0 },
      );
      // Second fixture: channels 10, 11, 12 zeroed
      expect(dispatcher.applyRawUpdate).toHaveBeenCalledWith(
        "default",
        { 10: 0, 11: 0, 12: 0 },
      );

      // Channels locked to prevent SignalRGB overwrite
      expect(dispatcher.lockChannels).toHaveBeenCalledWith([1, 2, 3, 10, 11, 12]);
    });

    it("returns 404 for unknown group", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/groups/nonexistent/blackout",
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().success).toBe(false);
      expect(res.json().error).toBe("Group not found");
    });
  });

  describe("POST /groups/:id/whiteout", () => {
    it("maxes all channels via mapColor for group fixtures", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/groups/group-1/whiteout",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.action).toBe("whiteout");
      expect(body.fixturesUpdated).toBe(2);

      // mapColor is called for each fixture, then applyRawUpdate
      expect(dispatcher.applyRawUpdate).toHaveBeenCalledTimes(2);
    });

    it("returns 404 for unknown group", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/groups/nonexistent/whiteout",
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().success).toBe(false);
    });
  });

  describe("POST /groups/:id/flash", () => {
    it("flashes fixtures and snapshots current values", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/groups/group-1/flash",
        payload: { durationMs: 200 },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.action).toBe("flash");
      expect(body.fixturesUpdated).toBe(2);
      expect(body.durationMs).toBe(200);

      // Snapshot is taken for each fixture, then white applied
      expect(dispatcher.getChannelSnapshot).toHaveBeenCalledTimes(2);
      // 2 white applications happened immediately
      expect(dispatcher.applyRawUpdate).toHaveBeenCalledTimes(2);
    });

    it("restores snapshot after duration elapses", async () => {
      await app.inject({
        method: "POST",
        url: "/groups/group-1/flash",
        payload: { durationMs: 50 },
      });

      // 2 calls for the initial white application
      expect(dispatcher.applyRawUpdate).toHaveBeenCalledTimes(2);

      // Wait for the restore timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 2 more calls for the snapshot restore
      expect(dispatcher.applyRawUpdate).toHaveBeenCalledTimes(4);
    });

    it("uses default 500ms duration when not specified", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/groups/group-1/flash",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().durationMs).toBe(500);
    });

    it("returns 404 for unknown group", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/groups/nonexistent/flash",
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().success).toBe(false);
    });
  });

  describe("POST /groups/:id/resume", () => {
    it("unlocks channels and restores fixture defaults", async () => {
      // First blackout to lock channels
      await app.inject({
        method: "POST",
        url: "/groups/group-1/blackout",
      });

      // Now resume
      const res = await app.inject({
        method: "POST",
        url: "/groups/group-1/resume",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.action).toBe("resume");
      expect(body.fixturesUpdated).toBe(2);

      // Unlock was called with the same addresses that were locked
      expect(dispatcher.unlockChannels).toHaveBeenCalledWith([1, 2, 3, 10, 11, 12]);
      // 2 blackout + 2 resume = 4 applyRawUpdate calls
      expect(dispatcher.applyRawUpdate).toHaveBeenCalledTimes(4);
    });

    it("returns 404 for unknown group", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/groups/nonexistent/resume",
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().success).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles group with empty fixtureIds", async () => {
      const emptyGroup = createTestGroup({ id: "empty-group", fixtureIds: [] });
      const emptyGroupStore = createMockGroupStore(emptyGroup);
      const emptyApp = Fastify({ logger: false });
      registerGroupControlRoutes(emptyApp, {
        groupStore: emptyGroupStore,
        fixtureStore,
        dispatcher,
      });
      await emptyApp.ready();

      const res = await emptyApp.inject({
        method: "POST",
        url: "/groups/empty-group/blackout",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().fixturesUpdated).toBe(0);
      expect(dispatcher.applyRawUpdate).not.toHaveBeenCalled();

      await emptyApp.close();
    });

    it("handles group with orphaned fixture IDs", async () => {
      const orphanGroup = createTestGroup({
        id: "orphan-group",
        fixtureIds: ["nonexistent-fixture"],
      });
      const orphanGroupStore = createMockGroupStore(orphanGroup);
      const orphanApp = Fastify({ logger: false });
      registerGroupControlRoutes(orphanApp, {
        groupStore: orphanGroupStore,
        fixtureStore,
        dispatcher,
      });
      await orphanApp.ready();

      const res = await orphanApp.inject({
        method: "POST",
        url: "/groups/orphan-group/whiteout",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().fixturesUpdated).toBe(0);
      expect(dispatcher.applyRawUpdate).not.toHaveBeenCalled();

      await orphanApp.close();
    });

    it("respects fixture universeId when applying updates", async () => {
      const universeFixture = createTestFixture({
        id: "fixture-1",
        universeId: "universe-2",
        dmxStartAddress: 1,
      });
      const uniFixtureStore = createMockFixtureStore([universeFixture]);
      const uniGroup = createTestGroup({ fixtureIds: ["fixture-1"] });
      const uniGroupStore = createMockGroupStore(uniGroup);
      const uniApp = Fastify({ logger: false });
      registerGroupControlRoutes(uniApp, {
        groupStore: uniGroupStore,
        fixtureStore: uniFixtureStore,
        dispatcher,
      });
      await uniApp.ready();

      await uniApp.inject({
        method: "POST",
        url: "/groups/group-1/blackout",
      });

      expect(dispatcher.applyRawUpdate).toHaveBeenCalledWith(
        "universe-2",
        expect.any(Object),
      );

      await uniApp.close();
    });
  });
});
