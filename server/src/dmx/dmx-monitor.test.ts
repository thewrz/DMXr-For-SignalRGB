import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createDmxMonitor } from "./dmx-monitor.js";
import { createUniverseManager } from "./universe-manager.js";
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
});
