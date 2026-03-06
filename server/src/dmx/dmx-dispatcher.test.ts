import { describe, it, expect, vi } from "vitest";
import { createDmxDispatcher } from "./dmx-dispatcher.js";
import type { UniverseManager } from "./universe-manager.js";
import type { MultiUniverseCoordinator } from "./multi-universe-coordinator.js";

function makeMockManager(): UniverseManager {
  return {
    applyFixtureUpdate: vi.fn().mockReturnValue(3),
    blackout: vi.fn(),
    whiteout: vi.fn(),
    resumeNormal: vi.fn(),
    isBlackoutActive: vi.fn().mockReturnValue(false),
    getControlMode: vi.fn().mockReturnValue("normal"),
    getActiveChannelCount: vi.fn().mockReturnValue(10),
    getChannelSnapshot: vi.fn().mockReturnValue({}),
    getFullSnapshot: vi.fn().mockReturnValue({}),
    applyRawUpdate: vi.fn(),
    getDmxSendStatus: vi.fn().mockReturnValue({ lastSendTime: null, lastSendError: null }),
    registerSafePositions: vi.fn(),
    lockChannels: vi.fn(),
    unlockChannels: vi.fn(),
    hasLockedChannels: vi.fn().mockReturnValue(false),
  };
}

function makeMockCoordinator(): MultiUniverseCoordinator {
  return {
    applyFixtureUpdate: vi.fn().mockReturnValue(5),
    blackout: vi.fn(),
    blackoutAll: vi.fn(),
    whiteout: vi.fn(),
    whiteoutAll: vi.fn(),
    resumeNormal: vi.fn(),
    resumeNormalAll: vi.fn(),
    isBlackoutActive: vi.fn().mockReturnValue(true),
    getChannelSnapshot: vi.fn().mockReturnValue({ 1: 128 }),
    getFullSnapshot: vi.fn().mockReturnValue({}),
    getActiveChannelCount: vi.fn().mockReturnValue(20),
    registerSafePositions: vi.fn(),
    lockChannels: vi.fn(),
    unlockChannels: vi.fn(),
    applyRawUpdate: vi.fn(),
    getDmxSendStatus: vi.fn(),
    getControlMode: vi.fn().mockReturnValue("blackout"),
  };
}

describe("DmxDispatcher (no coordinator)", () => {
  it("delegates applyFixtureUpdate to manager", () => {
    const mgr = makeMockManager();
    const d = createDmxDispatcher(mgr);
    const payload = { fixture: "test", channels: { 1: 255 } };

    const result = d.applyFixtureUpdate(undefined, payload);

    expect(result).toBe(3);
    expect(mgr.applyFixtureUpdate).toHaveBeenCalledWith(payload);
  });

  it("delegates blackout to manager", () => {
    const mgr = makeMockManager();
    const d = createDmxDispatcher(mgr);

    d.blackout();

    expect(mgr.blackout).toHaveBeenCalled();
  });

  it("delegates resumeNormal to manager", () => {
    const mgr = makeMockManager();
    const d = createDmxDispatcher(mgr);

    d.resumeNormal();

    expect(mgr.resumeNormal).toHaveBeenCalled();
  });

  it("delegates applyRawUpdate to manager", () => {
    const mgr = makeMockManager();
    const d = createDmxDispatcher(mgr);

    d.applyRawUpdate(undefined, { 1: 100 });

    expect(mgr.applyRawUpdate).toHaveBeenCalledWith({ 1: 100 });
  });

  it("delegates getChannelSnapshot to manager", () => {
    const mgr = makeMockManager();
    const d = createDmxDispatcher(mgr);

    d.getChannelSnapshot(undefined, 1, 3);

    expect(mgr.getChannelSnapshot).toHaveBeenCalledWith(1, 3);
  });
});

describe("DmxDispatcher (with coordinator)", () => {
  it("delegates universe-scoped applyFixtureUpdate to coordinator", () => {
    const mgr = makeMockManager();
    const coord = makeMockCoordinator();
    const d = createDmxDispatcher(mgr, coord);
    const payload = { fixture: "test", channels: { 1: 255 } };

    const result = d.applyFixtureUpdate("uni-1", payload);

    expect(result).toBe(5);
    expect(coord.applyFixtureUpdate).toHaveBeenCalledWith("uni-1", payload);
    expect(mgr.applyFixtureUpdate).not.toHaveBeenCalled();
  });

  it("falls back to manager when universeId is undefined", () => {
    const mgr = makeMockManager();
    const coord = makeMockCoordinator();
    const d = createDmxDispatcher(mgr, coord);

    d.applyFixtureUpdate(undefined, { fixture: "test", channels: {} });

    expect(mgr.applyFixtureUpdate).toHaveBeenCalled();
    expect(coord.applyFixtureUpdate).not.toHaveBeenCalled();
  });

  it("blackout with universeId targets coordinator + always hits manager", () => {
    const mgr = makeMockManager();
    const coord = makeMockCoordinator();
    const d = createDmxDispatcher(mgr, coord);

    d.blackout("uni-1");

    expect(coord.blackout).toHaveBeenCalledWith("uni-1");
    expect(mgr.blackout).toHaveBeenCalled();
  });

  it("blackout without universeId calls blackoutAll + manager", () => {
    const mgr = makeMockManager();
    const coord = makeMockCoordinator();
    const d = createDmxDispatcher(mgr, coord);

    d.blackout();

    expect(coord.blackoutAll).toHaveBeenCalled();
    expect(mgr.blackout).toHaveBeenCalled();
  });

  it("whiteout with universeId targets coordinator + always hits manager", () => {
    const mgr = makeMockManager();
    const coord = makeMockCoordinator();
    const d = createDmxDispatcher(mgr, coord);

    d.whiteout("uni-1");

    expect(coord.whiteout).toHaveBeenCalledWith("uni-1");
    expect(mgr.whiteout).toHaveBeenCalled();
  });

  it("resumeNormal with universeId targets coordinator + always hits manager", () => {
    const mgr = makeMockManager();
    const coord = makeMockCoordinator();
    const d = createDmxDispatcher(mgr, coord);

    d.resumeNormal("uni-1");

    expect(coord.resumeNormal).toHaveBeenCalledWith("uni-1");
    expect(mgr.resumeNormal).toHaveBeenCalled();
  });

  it("getChannelSnapshot delegates to coordinator for universe", () => {
    const mgr = makeMockManager();
    const coord = makeMockCoordinator();
    const d = createDmxDispatcher(mgr, coord);

    const result = d.getChannelSnapshot("uni-1", 1, 3);

    expect(result).toEqual({ 1: 128 });
    expect(coord.getChannelSnapshot).toHaveBeenCalledWith("uni-1", 1, 3);
  });

  it("isBlackoutActive delegates to coordinator for universe", () => {
    const mgr = makeMockManager();
    const coord = makeMockCoordinator();
    const d = createDmxDispatcher(mgr, coord);

    expect(d.isBlackoutActive("uni-1")).toBe(true);
    expect(coord.isBlackoutActive).toHaveBeenCalledWith("uni-1");
  });

  it("applyRawUpdate delegates to coordinator for universe", () => {
    const mgr = makeMockManager();
    const coord = makeMockCoordinator();
    const d = createDmxDispatcher(mgr, coord);

    d.applyRawUpdate("uni-1", { 5: 200 });

    expect(coord.applyRawUpdate).toHaveBeenCalledWith("uni-1", { 5: 200 });
    expect(mgr.applyRawUpdate).not.toHaveBeenCalled();
  });
});
