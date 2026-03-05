import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createDmxMonitor } from "./dmx-monitor.js";
import { createUniverseManager } from "./universe-manager.js";
import { createMultiUniverseCoordinator } from "./multi-universe-coordinator.js";
import { createMockUniverse } from "../test-helpers.js";
import type { DmxMonitor, DmxFrameSnapshot } from "./dmx-monitor.js";
import type { UniverseManager } from "./universe-manager.js";

describe("createDmxMonitor", () => {
  let mockUniverse: ReturnType<typeof createMockUniverse>;
  let manager: UniverseManager;
  let monitor: DmxMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    mockUniverse = createMockUniverse();
    manager = createUniverseManager(mockUniverse);
  });

  afterEach(() => {
    monitor?.close();
    vi.useRealTimers();
  });

  it("returns an object with getSnapshot, subscribe, and close", () => {
    monitor = createDmxMonitor({ manager });

    expect(monitor.getSnapshot).toBeTypeOf("function");
    expect(monitor.subscribe).toBeTypeOf("function");
    expect(monitor.close).toBeTypeOf("function");
  });

  it("getSnapshot returns current channel state from manager", () => {
    manager.applyFixtureUpdate({ fixture: "test", channels: { "1": 128, "2": 255 } });
    monitor = createDmxMonitor({ manager });

    const snapshot = monitor.getSnapshot();

    expect(snapshot.channels[1]).toBe(128);
    expect(snapshot.channels[2]).toBe(255);
  });

  it("getSnapshot returns metadata alongside channel values", () => {
    manager.applyFixtureUpdate({ fixture: "test", channels: { "1": 100 } });
    monitor = createDmxMonitor({ manager, universeId: "universe-1" });

    const snapshot = monitor.getSnapshot();

    expect(snapshot.universeId).toBe("universe-1");
    expect(snapshot.timestamp).toBeTypeOf("number");
    expect(snapshot.blackoutActive).toBe(false);
    expect(snapshot.activeChannelCount).toBe(1);
  });

  it("getSnapshot reflects blackout state", () => {
    manager.applyFixtureUpdate({ fixture: "test", channels: { "1": 255 } });
    manager.blackout();
    monitor = createDmxMonitor({ manager });

    const snapshot = monitor.getSnapshot();

    expect(snapshot.blackoutActive).toBe(true);
  });

  it("getSnapshot includes controlMode field", () => {
    monitor = createDmxMonitor({ manager });

    expect(monitor.getSnapshot().controlMode).toBe("normal");

    manager.blackout();
    expect(monitor.getSnapshot().controlMode).toBe("blackout");

    manager.resumeNormal();
    manager.whiteout();
    expect(monitor.getSnapshot().controlMode).toBe("whiteout");
  });

  it("getSnapshot uses default universe ID when none provided", () => {
    monitor = createDmxMonitor({ manager });

    const snapshot = monitor.getSnapshot();

    expect(snapshot.universeId).toBe("default");
  });

  describe("subscribe", () => {
    it("delivers frame snapshots at configured interval", () => {
      manager.applyFixtureUpdate({ fixture: "test", channels: { "5": 200 } });
      monitor = createDmxMonitor({ manager, intervalMs: 100 });

      const frames: DmxFrameSnapshot[] = [];
      monitor.subscribe((frame) => frames.push(frame));

      vi.advanceTimersByTime(350);

      expect(frames.length).toBe(3);
      expect(frames[0].channels[5]).toBe(200);
    });

    it("returns an unsubscribe function that stops delivery", () => {
      monitor = createDmxMonitor({ manager, intervalMs: 100 });

      const frames: DmxFrameSnapshot[] = [];
      const unsub = monitor.subscribe((frame) => frames.push(frame));

      vi.advanceTimersByTime(250);
      const countBefore = frames.length;

      unsub();
      vi.advanceTimersByTime(500);

      expect(frames.length).toBe(countBefore);
    });

    it("multiple subscribers receive the same frames", () => {
      manager.applyFixtureUpdate({ fixture: "test", channels: { "1": 42 } });
      monitor = createDmxMonitor({ manager, intervalMs: 100 });

      const framesA: DmxFrameSnapshot[] = [];
      const framesB: DmxFrameSnapshot[] = [];
      monitor.subscribe((frame) => framesA.push(frame));
      monitor.subscribe((frame) => framesB.push(frame));

      vi.advanceTimersByTime(150);

      expect(framesA.length).toBe(1);
      expect(framesB.length).toBe(1);
      expect(framesA[0].channels[1]).toBe(42);
      expect(framesB[0].channels[1]).toBe(42);
    });

    it("lazy-starts the interval on first subscribe", () => {
      monitor = createDmxMonitor({ manager, intervalMs: 100 });

      // No subscribers — advancing time should not produce any frames
      // (verified indirectly: subscribe later and check frame count)
      vi.advanceTimersByTime(500);

      const frames: DmxFrameSnapshot[] = [];
      monitor.subscribe((frame) => frames.push(frame));

      vi.advanceTimersByTime(250);

      // Should have exactly 2 frames (at 100ms and 200ms), not 7
      expect(frames.length).toBe(2);
    });

    it("stops the interval when last subscriber unsubscribes", () => {
      monitor = createDmxMonitor({ manager, intervalMs: 100 });

      const framesA: DmxFrameSnapshot[] = [];
      const framesB: DmxFrameSnapshot[] = [];
      const unsubA = monitor.subscribe((frame) => framesA.push(frame));
      const unsubB = monitor.subscribe((frame) => framesB.push(frame));

      vi.advanceTimersByTime(150);
      expect(framesA.length).toBe(1);

      unsubA();
      vi.advanceTimersByTime(150);
      // B still subscribed — should still get frames (at 100ms, 200ms, 300ms = 3 total)
      expect(framesB.length).toBe(3);

      unsubB();
      // Resubscribe after all unsubscribed — interval should restart fresh
      const framesC: DmxFrameSnapshot[] = [];
      monitor.subscribe((frame) => framesC.push(frame));

      vi.advanceTimersByTime(150);
      expect(framesC.length).toBe(1);
    });

    it("reflects live channel changes in subsequent frames", () => {
      monitor = createDmxMonitor({ manager, intervalMs: 100 });

      const frames: DmxFrameSnapshot[] = [];
      monitor.subscribe((frame) => frames.push(frame));

      vi.advanceTimersByTime(150);
      expect(frames[0].channels[10]).toBeUndefined();

      manager.applyFixtureUpdate({ fixture: "test", channels: { "10": 77 } });
      vi.advanceTimersByTime(100);

      expect(frames[1].channels[10]).toBe(77);
    });
  });

  describe("close", () => {
    it("stops interval and prevents further delivery", () => {
      monitor = createDmxMonitor({ manager, intervalMs: 100 });

      const frames: DmxFrameSnapshot[] = [];
      monitor.subscribe((frame) => frames.push(frame));

      vi.advanceTimersByTime(150);
      const countBefore = frames.length;

      monitor.close();
      vi.advanceTimersByTime(500);

      expect(frames.length).toBe(countBefore);
    });

    it("is safe to call multiple times", () => {
      monitor = createDmxMonitor({ manager, intervalMs: 100 });

      monitor.close();
      monitor.close();
      // No throw
    });
  });

  describe("subscriberCount", () => {
    it("tracks the number of active subscribers", () => {
      monitor = createDmxMonitor({ manager });

      expect(monitor.subscriberCount()).toBe(0);

      const unsub1 = monitor.subscribe(() => {});
      expect(monitor.subscriberCount()).toBe(1);

      const unsub2 = monitor.subscribe(() => {});
      expect(monitor.subscriberCount()).toBe(2);

      unsub1();
      expect(monitor.subscriberCount()).toBe(1);

      unsub2();
      expect(monitor.subscriberCount()).toBe(0);
    });
  });

  describe("multi-universe support (coordinator)", () => {
    let mockUniverseA: ReturnType<typeof createMockUniverse>;
    let mockUniverseB: ReturnType<typeof createMockUniverse>;
    let managerA: UniverseManager;
    let managerB: UniverseManager;

    beforeEach(() => {
      mockUniverseA = createMockUniverse();
      mockUniverseB = createMockUniverse();
      managerA = createUniverseManager(mockUniverseA);
      managerB = createUniverseManager(mockUniverseB);
    });

    it("getSnapshot resolves the correct universe via coordinator", () => {
      const managers = new Map<string, UniverseManager>([
        ["uni-a", managerA],
        ["uni-b", managerB],
      ]);
      const coordinator = createMultiUniverseCoordinator(() => managers);

      managerA.applyFixtureUpdate({ fixture: "par", channels: { "1": 100 } });
      managerB.applyFixtureUpdate({ fixture: "mover", channels: { "40": 200 } });

      monitor = createDmxMonitor({ coordinator });

      const snapA = monitor.getSnapshot("uni-a");
      expect(snapA.universeId).toBe("uni-a");
      expect(snapA.channels[1]).toBe(100);
      expect(snapA.channels[40]).toBeUndefined();

      const snapB = monitor.getSnapshot("uni-b");
      expect(snapB.universeId).toBe("uni-b");
      expect(snapB.channels[40]).toBe(200);
      expect(snapB.channels[1]).toBeUndefined();
    });

    it("getSnapshot falls back to default universe when no universeId given", () => {
      const managers = new Map<string, UniverseManager>([
        ["default", managerA],
        ["uni-b", managerB],
      ]);
      const coordinator = createMultiUniverseCoordinator(() => managers);

      managerA.applyFixtureUpdate({ fixture: "par", channels: { "5": 55 } });

      monitor = createDmxMonitor({ coordinator });

      const snap = monitor.getSnapshot();
      expect(snap.universeId).toBe("default");
      expect(snap.channels[5]).toBe(55);
    });

    it("getSnapshot returns empty state for unknown universe", () => {
      const managers = new Map<string, UniverseManager>([
        ["uni-a", managerA],
      ]);
      const coordinator = createMultiUniverseCoordinator(() => managers);

      monitor = createDmxMonitor({ coordinator });

      const snap = monitor.getSnapshot("nonexistent");
      expect(snap.universeId).toBe("nonexistent");
      expect(snap.activeChannelCount).toBe(0);
      expect(snap.blackoutActive).toBe(false);
      expect(Object.keys(snap.channels)).toHaveLength(0);
    });

    it("subscribe delivers frames for the specified universe", () => {
      const managers = new Map<string, UniverseManager>([
        ["uni-a", managerA],
        ["uni-b", managerB],
      ]);
      const coordinator = createMultiUniverseCoordinator(() => managers);

      managerA.applyFixtureUpdate({ fixture: "par", channels: { "1": 111 } });
      managerB.applyFixtureUpdate({ fixture: "mover", channels: { "40": 222 } });

      monitor = createDmxMonitor({ coordinator, intervalMs: 100 });

      const framesA: DmxFrameSnapshot[] = [];
      monitor.subscribe((frame) => framesA.push(frame), "uni-a");

      vi.advanceTimersByTime(150);

      expect(framesA.length).toBe(1);
      expect(framesA[0].universeId).toBe("uni-a");
      expect(framesA[0].channels[1]).toBe(111);
      expect(framesA[0].channels[40]).toBeUndefined();
    });

    it("subscribers to different universes receive independent frames", () => {
      const managers = new Map<string, UniverseManager>([
        ["uni-a", managerA],
        ["uni-b", managerB],
      ]);
      const coordinator = createMultiUniverseCoordinator(() => managers);

      managerA.applyFixtureUpdate({ fixture: "par", channels: { "1": 10 } });
      managerB.applyFixtureUpdate({ fixture: "mover", channels: { "1": 99 } });

      monitor = createDmxMonitor({ coordinator, intervalMs: 100 });

      const framesA: DmxFrameSnapshot[] = [];
      const framesB: DmxFrameSnapshot[] = [];
      monitor.subscribe((frame) => framesA.push(frame), "uni-a");
      monitor.subscribe((frame) => framesB.push(frame), "uni-b");

      vi.advanceTimersByTime(150);

      expect(framesA[0].channels[1]).toBe(10);
      expect(framesB[0].channels[1]).toBe(99);
    });

    it("falls back to legacy manager when coordinator is not provided", () => {
      manager.applyFixtureUpdate({ fixture: "test", channels: { "3": 33 } });
      monitor = createDmxMonitor({ manager });

      const snap = monitor.getSnapshot();
      expect(snap.channels[3]).toBe(33);
      expect(snap.universeId).toBe("default");
    });

    it("coordinator blackout state is reflected per-universe", () => {
      const managers = new Map<string, UniverseManager>([
        ["uni-a", managerA],
        ["uni-b", managerB],
      ]);
      const coordinator = createMultiUniverseCoordinator(() => managers);

      managerA.applyFixtureUpdate({ fixture: "par", channels: { "1": 255 } });
      managerA.blackout();

      monitor = createDmxMonitor({ coordinator });

      expect(monitor.getSnapshot("uni-a").blackoutActive).toBe(true);
      expect(monitor.getSnapshot("uni-b").blackoutActive).toBe(false);
    });
  });
});
