import { describe, it, expect, vi, beforeEach } from "vitest";
import { createUniverseManager } from "./universe-manager.js";
import type { DmxUniverse } from "./driver-factory.js";

function createMockUniverse(): DmxUniverse & {
  updateCalls: Array<Record<number, number>>;
  updateAllCalls: number[];
} {
  const updateCalls: Array<Record<number, number>> = [];
  const updateAllCalls: number[] = [];

  return {
    updateCalls,
    updateAllCalls,
    update: (channels) => {
      updateCalls.push(channels);
    },
    updateAll: (value) => {
      updateAllCalls.push(value);
    },
  };
}

describe("createUniverseManager", () => {
  let mock: ReturnType<typeof createMockUniverse>;
  let manager: ReturnType<typeof createUniverseManager>;

  beforeEach(() => {
    mock = createMockUniverse();
    manager = createUniverseManager(mock);
  });

  describe("applyFixtureUpdate", () => {
    it("updates valid channels and returns count", () => {
      const count = manager.applyFixtureUpdate({
        fixture: "fixture-1",
        channels: { "1": 255, "2": 128, "3": 64, "4": 200 },
      });

      expect(count).toBe(4);
      expect(mock.updateCalls).toHaveLength(1);
      expect(mock.updateCalls[0]).toEqual({ 1: 255, 2: 128, 3: 64, 4: 200 });
    });

    it("clamps values above 255 to 255", () => {
      manager.applyFixtureUpdate({
        fixture: "test",
        channels: { "1": 300 },
      });

      expect(mock.updateCalls[0]).toEqual({ 1: 255 });
    });

    it("clamps values below 0 to 0", () => {
      manager.applyFixtureUpdate({
        fixture: "test",
        channels: { "1": -50 },
      });

      expect(mock.updateCalls[0]).toEqual({ 1: 0 });
    });

    it("rounds fractional values", () => {
      manager.applyFixtureUpdate({
        fixture: "test",
        channels: { "1": 127.6 },
      });

      expect(mock.updateCalls[0]).toEqual({ 1: 128 });
    });

    it("rejects channels below 1", () => {
      const count = manager.applyFixtureUpdate({
        fixture: "test",
        channels: { "0": 255 },
      });

      expect(count).toBe(0);
      expect(mock.updateCalls).toHaveLength(0);
    });

    it("rejects channels above 512", () => {
      const count = manager.applyFixtureUpdate({
        fixture: "test",
        channels: { "513": 255 },
      });

      expect(count).toBe(0);
      expect(mock.updateCalls).toHaveLength(0);
    });

    it("filters out invalid channels and keeps valid ones", () => {
      const count = manager.applyFixtureUpdate({
        fixture: "test",
        channels: { "0": 100, "1": 200, "513": 50, "512": 255 },
      });

      expect(count).toBe(2);
      expect(mock.updateCalls[0]).toEqual({ 1: 200, 512: 255 });
    });

    it("returns 0 for empty channels object", () => {
      const count = manager.applyFixtureUpdate({
        fixture: "test",
        channels: {},
      });

      expect(count).toBe(0);
      expect(mock.updateCalls).toHaveLength(0);
    });

    it("rejects NaN values", () => {
      const count = manager.applyFixtureUpdate({
        fixture: "test",
        channels: { "1": NaN },
      });

      expect(count).toBe(0);
    });

    it("rejects Infinity values", () => {
      const count = manager.applyFixtureUpdate({
        fixture: "test",
        channels: { "1": Infinity },
      });

      expect(count).toBe(0);
    });
  });

  describe("blackout", () => {
    it("calls updateAll(0) on the universe", () => {
      manager.blackout();

      expect(mock.updateAllCalls).toEqual([0]);
    });

    it("resets active channel count to 0", () => {
      manager.applyFixtureUpdate({
        fixture: "test",
        channels: { "1": 255, "2": 128 },
      });
      expect(manager.getActiveChannelCount()).toBe(2);

      manager.blackout();
      expect(manager.getActiveChannelCount()).toBe(0);
    });
  });

  describe("getActiveChannelCount", () => {
    it("returns 0 initially", () => {
      expect(manager.getActiveChannelCount()).toBe(0);
    });

    it("tracks unique channels across multiple updates", () => {
      manager.applyFixtureUpdate({
        fixture: "a",
        channels: { "1": 255, "2": 128 },
      });
      manager.applyFixtureUpdate({
        fixture: "b",
        channels: { "2": 200, "3": 100 },
      });

      expect(manager.getActiveChannelCount()).toBe(3);
    });

    it("removes channels set to 0 from active count", () => {
      manager.applyFixtureUpdate({
        fixture: "a",
        channels: { "1": 255, "2": 128, "3": 64 },
      });
      expect(manager.getActiveChannelCount()).toBe(3);

      manager.applyFixtureUpdate({
        fixture: "a",
        channels: { "2": 0 },
      });
      expect(manager.getActiveChannelCount()).toBe(2);
    });
  });

  describe("getDmxSendStatus", () => {
    it("returns null lastSendTime and lastSendError initially", () => {
      const status = manager.getDmxSendStatus();
      expect(status.lastSendTime).toBeNull();
      expect(status.lastSendError).toBeNull();
    });

    it("updates lastSendTime after successful send", () => {
      const before = Date.now();
      manager.applyFixtureUpdate({
        fixture: "test",
        channels: { "1": 255 },
      });
      const status = manager.getDmxSendStatus();
      expect(status.lastSendTime).toBeGreaterThanOrEqual(before);
      expect(status.lastSendError).toBeNull();
    });

    it("tracks error when universe.update throws", () => {
      const errorCallback = vi.fn();
      const failingUniverse: DmxUniverse = {
        update: () => { throw new Error("USB disconnected"); },
        updateAll: () => {},
      };
      const mgr = createUniverseManager(failingUniverse, { onDmxError: errorCallback });

      mgr.applyFixtureUpdate({
        fixture: "test",
        channels: { "1": 255 },
      });

      const status = mgr.getDmxSendStatus();
      expect(status.lastSendError).toBe("USB disconnected");
      expect(errorCallback).toHaveBeenCalledOnce();
    });

    it("tracks error when universe.updateAll throws", () => {
      const failingUniverse: DmxUniverse = {
        update: () => {},
        updateAll: () => { throw new Error("Device removed"); },
      };
      const mgr = createUniverseManager(failingUniverse);

      mgr.blackout();

      const status = mgr.getDmxSendStatus();
      expect(status.lastSendError).toBe("Device removed");
    });

    it("clears error after successful send", () => {
      const failingUpdate = vi.fn()
        .mockImplementationOnce(() => { throw new Error("Temporary failure"); })
        .mockImplementation(() => {});

      const universe: DmxUniverse = {
        update: failingUpdate,
        updateAll: () => {},
      };
      const mgr = createUniverseManager(universe);

      mgr.applyFixtureUpdate({ fixture: "test", channels: { "1": 255 } });
      expect(mgr.getDmxSendStatus().lastSendError).toBe("Temporary failure");

      mgr.applyFixtureUpdate({ fixture: "test", channels: { "1": 128 } });
      expect(mgr.getDmxSendStatus().lastSendError).toBeNull();
    });
  });
});
