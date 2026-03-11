import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { registerControlModeRoutes, type ControlModesDeps } from "./control-modes.js";
import { registerGroupControlRoutes, type GroupControlDeps } from "./group-control.js";
import type { DmxDispatcher } from "../dmx/dmx-dispatcher.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { GroupStore } from "../fixtures/group-store.js";
import type { FixtureConfig, FixtureGroup } from "../types/protocol.js";
import type { DmxWriteResult } from "../dmx/universe-manager.js";

function createFixture(overrides: Partial<FixtureConfig> = {}): FixtureConfig {
  return {
    id: "f1",
    name: "PAR",
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

function createGroup(): FixtureGroup {
  return {
    id: "g1",
    name: "Front",
    fixtureIds: ["f1"],
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeDispatcher(dmxResult: DmxWriteResult): DmxDispatcher {
  return {
    applyFixtureUpdate: vi.fn(() => 0),
    applyRawUpdate: vi.fn(() => dmxResult),
    blackout: vi.fn(() => dmxResult),
    whiteout: vi.fn(() => dmxResult),
    resumeNormal: vi.fn(() => dmxResult),
    getChannelSnapshot: vi.fn(() => ({ 1: 10, 2: 20, 3: 30 })),
    isBlackoutActive: vi.fn(() => false),
    getControlMode: vi.fn(() => "normal" as const),
    getActiveChannelCount: vi.fn(() => 0),
    lockChannels: vi.fn(),
    unlockChannels: vi.fn(),
  };
}

function makeFixtureStore(fixtures: FixtureConfig[]): FixtureStore {
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

function makeGroupStore(group: FixtureGroup): GroupStore {
  return {
    getAll: vi.fn(() => [group]),
    getById: vi.fn((id: string) => (id === group.id ? group : undefined)),
    add: vi.fn(() => group),
    update: vi.fn(() => group),
    remove: vi.fn(() => true),
    getGroupsForFixture: vi.fn(() => [group]),
    removeFixtureFromAll: vi.fn(),
    save: vi.fn(async () => {}),
    scheduleSave: vi.fn(),
    load: vi.fn(async () => {}),
    dispose: vi.fn(),
  };
}

describe("DMX feedback propagation", () => {
  const fixture = createFixture();
  const group = createGroup();

  describe("control-modes routes with successful DMX", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      const dispatcher = makeDispatcher({ ok: true });
      const store = makeFixtureStore([fixture]);
      app = Fastify({ logger: false });
      registerControlModeRoutes(app, { dispatcher, store });
      await app.ready();
    });

    it("blackout returns dmxStatus ok", async () => {
      const res = await app.inject({ method: "POST", url: "/control/blackout", payload: {} });
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.dmxStatus).toBe("ok");
      expect(body.dmxError).toBeUndefined();
    });

    it("whiteout returns dmxStatus ok", async () => {
      const res = await app.inject({ method: "POST", url: "/control/whiteout", payload: {} });
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.dmxStatus).toBe("ok");
    });

    it("resume returns dmxStatus ok", async () => {
      const res = await app.inject({ method: "POST", url: "/control/resume", payload: {} });
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.dmxStatus).toBe("ok");
    });
  });

  describe("control-modes routes with DMX error", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      const dispatcher = makeDispatcher({ ok: false, error: "USB disconnected" });
      const store = makeFixtureStore([fixture]);
      app = Fastify({ logger: false });
      registerControlModeRoutes(app, { dispatcher, store });
      await app.ready();
    });

    it("blackout returns dmxStatus error with message", async () => {
      const res = await app.inject({ method: "POST", url: "/control/blackout", payload: {} });
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.dmxStatus).toBe("error");
      expect(body.dmxError).toBe("USB disconnected");
    });

    it("whiteout returns dmxStatus error", async () => {
      const res = await app.inject({ method: "POST", url: "/control/whiteout", payload: {} });
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.dmxStatus).toBe("error");
      expect(body.dmxError).toBe("USB disconnected");
    });

    it("resume returns dmxStatus error", async () => {
      const res = await app.inject({ method: "POST", url: "/control/resume", payload: {} });
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.dmxStatus).toBe("error");
      expect(body.dmxError).toBe("USB disconnected");
    });
  });

  describe("group-control routes with successful DMX", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      const dispatcher = makeDispatcher({ ok: true });
      const fixtureStore = makeFixtureStore([fixture]);
      const groupStore = makeGroupStore(group);
      app = Fastify({ logger: false });
      registerGroupControlRoutes(app, { groupStore, fixtureStore, dispatcher });
      await app.ready();
    });

    it("group blackout returns dmxStatus ok", async () => {
      const res = await app.inject({ method: "POST", url: "/groups/g1/blackout" });
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.dmxStatus).toBe("ok");
    });

    it("group whiteout returns dmxStatus ok", async () => {
      const res = await app.inject({ method: "POST", url: "/groups/g1/whiteout" });
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.dmxStatus).toBe("ok");
    });

    it("group flash returns dmxStatus ok", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/groups/g1/flash",
        payload: { durationMs: 100 },
      });
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.dmxStatus).toBe("ok");
    });

    it("group resume returns dmxStatus ok", async () => {
      const res = await app.inject({ method: "POST", url: "/groups/g1/resume" });
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.dmxStatus).toBe("ok");
    });
  });

  describe("group-control routes with DMX error", () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      const dispatcher = makeDispatcher({ ok: false, error: "Device not responding" });
      const fixtureStore = makeFixtureStore([fixture]);
      const groupStore = makeGroupStore(group);
      app = Fastify({ logger: false });
      registerGroupControlRoutes(app, { groupStore, fixtureStore, dispatcher });
      await app.ready();
    });

    it("group blackout returns dmxStatus error", async () => {
      const res = await app.inject({ method: "POST", url: "/groups/g1/blackout" });
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.dmxStatus).toBe("error");
      expect(body.dmxError).toBe("Device not responding");
    });

    it("group whiteout returns dmxStatus error", async () => {
      const res = await app.inject({ method: "POST", url: "/groups/g1/whiteout" });
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.dmxStatus).toBe("error");
      expect(body.dmxError).toBe("Device not responding");
    });

    it("group flash returns dmxStatus error", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/groups/g1/flash",
        payload: { durationMs: 100 },
      });
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.dmxStatus).toBe("error");
      expect(body.dmxError).toBe("Device not responding");
    });

    it("group resume returns dmxStatus error", async () => {
      const res = await app.inject({ method: "POST", url: "/groups/g1/resume" });
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.dmxStatus).toBe("error");
      expect(body.dmxError).toBe("Device not responding");
    });
  });

  describe("HTTP status is always 200 regardless of DMX result", () => {
    it("returns 200 even when DMX fails", async () => {
      const dispatcher = makeDispatcher({ ok: false, error: "USB disconnected" });
      const store = makeFixtureStore([fixture]);
      const app = Fastify({ logger: false });
      registerControlModeRoutes(app, { dispatcher, store });
      await app.ready();

      const res = await app.inject({ method: "POST", url: "/control/blackout", payload: {} });
      expect(res.statusCode).toBe(200);
      expect(res.json().dmxStatus).toBe("error");
    });
  });
});
