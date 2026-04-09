import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMultiUniverseCoordinator } from "./multi-universe-coordinator.js";
import type { MultiUniverseCoordinator } from "./multi-universe-coordinator.js";
import type { UniverseManager } from "./universe-manager.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";

function makeMockManager(): UniverseManager {
  return {
    applyFixtureUpdate: vi.fn().mockReturnValue(3),
    blackout: vi.fn(),
    whiteout: vi.fn(),
    resumeNormal: vi.fn(),
    isBlackoutActive: vi.fn().mockReturnValue(false),
    getActiveChannelCount: vi.fn().mockReturnValue(5),
    getChannelSnapshot: vi.fn().mockReturnValue({ 1: 128, 2: 255 }),
    getFullSnapshot: vi.fn().mockReturnValue({ 1: 128, 2: 255, 3: 64 }),
    applyRawUpdate: vi.fn(),
    getDmxSendStatus: vi.fn().mockReturnValue({ lastSendTime: Date.now(), lastSendError: null }),
    registerSafePositions: vi.fn(),
    lockChannels: vi.fn(),
    unlockChannels: vi.fn(),
    hasLockedChannels: vi.fn().mockReturnValue(false),
  };
}

describe("createMultiUniverseCoordinator", () => {
  let managerA: UniverseManager;
  let managerB: UniverseManager;
  let defaultManager: UniverseManager;
  let coordinator: MultiUniverseCoordinator;

  beforeEach(() => {
    managerA = makeMockManager();
    managerB = makeMockManager();
    defaultManager = makeMockManager();

    const managers = new Map<string, UniverseManager>([
      [DEFAULT_UNIVERSE_ID, defaultManager],
      ["uni-a", managerA],
      ["uni-b", managerB],
    ]);

    coordinator = createMultiUniverseCoordinator(() => managers);
  });

  describe("applyFixtureUpdate", () => {
    it("routes to correct manager based on universeId", () => {
      const payload = { fixture: "par-1", channels: { "1": 255 } };
      coordinator.applyFixtureUpdate("uni-a", payload);

      expect(managerA.applyFixtureUpdate).toHaveBeenCalledWith(payload);
      expect(managerB.applyFixtureUpdate).not.toHaveBeenCalled();
      expect(defaultManager.applyFixtureUpdate).not.toHaveBeenCalled();
    });

    it("uses default manager when universeId is undefined", () => {
      const payload = { fixture: "par-1", channels: { "1": 255 } };
      coordinator.applyFixtureUpdate(undefined, payload);

      expect(defaultManager.applyFixtureUpdate).toHaveBeenCalledWith(payload);
    });

    it("returns 0 when target universe has no manager", () => {
      const payload = { fixture: "par-1", channels: { "1": 255 } };
      const result = coordinator.applyFixtureUpdate("nonexistent", payload);

      expect(result).toBe(0);
    });
  });

  describe("blackout", () => {
    it("calls blackout on specific universe manager", () => {
      coordinator.blackout("uni-a");

      expect(managerA.blackout).toHaveBeenCalled();
      expect(managerB.blackout).not.toHaveBeenCalled();
      expect(defaultManager.blackout).not.toHaveBeenCalled();
    });
  });

  describe("blackoutAll", () => {
    it("calls blackout on every manager", () => {
      coordinator.blackoutAll();

      expect(managerA.blackout).toHaveBeenCalled();
      expect(managerB.blackout).toHaveBeenCalled();
      expect(defaultManager.blackout).toHaveBeenCalled();
    });
  });

  describe("whiteout", () => {
    it("calls whiteout on specific universe manager", () => {
      coordinator.whiteout("uni-b");

      expect(managerB.whiteout).toHaveBeenCalled();
      expect(managerA.whiteout).not.toHaveBeenCalled();
    });
  });

  describe("whiteoutAll", () => {
    it("calls whiteout on every manager", () => {
      coordinator.whiteoutAll();

      expect(managerA.whiteout).toHaveBeenCalled();
      expect(managerB.whiteout).toHaveBeenCalled();
      expect(defaultManager.whiteout).toHaveBeenCalled();
    });
  });

  describe("resumeNormal", () => {
    it("resumes specific universe", () => {
      coordinator.resumeNormal("uni-a");

      expect(managerA.resumeNormal).toHaveBeenCalled();
      expect(managerB.resumeNormal).not.toHaveBeenCalled();
    });
  });

  describe("resumeNormalAll", () => {
    it("resumes all universes", () => {
      coordinator.resumeNormalAll();

      expect(managerA.resumeNormal).toHaveBeenCalled();
      expect(managerB.resumeNormal).toHaveBeenCalled();
      expect(defaultManager.resumeNormal).toHaveBeenCalled();
    });
  });

  describe("getChannelSnapshot", () => {
    it("delegates to correct manager", () => {
      coordinator.getChannelSnapshot("uni-a", 1, 10);
      expect(managerA.getChannelSnapshot).toHaveBeenCalledWith(1, 10);
    });

    it("returns empty object for unknown universe", () => {
      const result = coordinator.getChannelSnapshot("nonexistent", 1, 10);
      expect(result).toEqual({});
    });
  });

  describe("getFullSnapshot", () => {
    it("delegates to correct manager", () => {
      const result = coordinator.getFullSnapshot("uni-a");
      expect(managerA.getFullSnapshot).toHaveBeenCalled();
      expect(result).toEqual({ 1: 128, 2: 255, 3: 64 });
    });

    it("returns empty object for unknown universe", () => {
      expect(coordinator.getFullSnapshot("nonexistent")).toEqual({});
    });
  });

  describe("isBlackoutActive", () => {
    it("checks specific universe", () => {
      (managerA.isBlackoutActive as ReturnType<typeof vi.fn>).mockReturnValue(true);
      expect(coordinator.isBlackoutActive("uni-a")).toBe(true);
      expect(coordinator.isBlackoutActive("uni-b")).toBe(false);
    });

    it("returns false for unknown universe", () => {
      expect(coordinator.isBlackoutActive("nonexistent")).toBe(false);
    });
  });

  describe("getActiveChannelCount", () => {
    it("delegates to correct manager", () => {
      expect(coordinator.getActiveChannelCount("uni-a")).toBe(5);
    });

    it("returns 0 for unknown universe", () => {
      expect(coordinator.getActiveChannelCount("nonexistent")).toBe(0);
    });
  });

  describe("registerSafePositions", () => {
    it("delegates to correct manager", () => {
      const positions = { 40: 128, 42: 128 };
      coordinator.registerSafePositions("uni-a", positions);
      expect(managerA.registerSafePositions).toHaveBeenCalledWith(positions);
    });
  });

  describe("lockChannels / unlockChannels", () => {
    it("delegates lock to correct manager", () => {
      coordinator.lockChannels("uni-b", [1, 2, 3]);
      expect(managerB.lockChannels).toHaveBeenCalledWith([1, 2, 3]);
    });

    it("delegates unlock to correct manager", () => {
      coordinator.unlockChannels("uni-b", [1, 2, 3]);
      expect(managerB.unlockChannels).toHaveBeenCalledWith([1, 2, 3]);
    });
  });

  describe("getDmxSendStatus", () => {
    it("delegates to correct manager", () => {
      const status = coordinator.getDmxSendStatus("uni-a");
      expect(status).toBeDefined();
      expect(status!.lastSendError).toBeNull();
    });

    it("returns undefined for unknown universe", () => {
      expect(coordinator.getDmxSendStatus("nonexistent")).toBeUndefined();
    });
  });

  describe("applyRawUpdate", () => {
    it("routes raw updates to the correct manager", () => {
      const channels = { 1: 200, 2: 100 };
      coordinator.applyRawUpdate("uni-a", channels);

      expect(managerA.applyRawUpdate).toHaveBeenCalledWith(channels, undefined);
      expect(managerB.applyRawUpdate).not.toHaveBeenCalled();
      expect(defaultManager.applyRawUpdate).not.toHaveBeenCalled();
    });

    it("is a no-op for unknown universe", () => {
      coordinator.applyRawUpdate("nonexistent", { 1: 255 });
      expect(managerA.applyRawUpdate).not.toHaveBeenCalled();
      expect(defaultManager.applyRawUpdate).not.toHaveBeenCalled();
    });
  });
});
