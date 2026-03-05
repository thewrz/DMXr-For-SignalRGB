import type { UniverseManager } from "./universe-manager.js";
import type { MultiUniverseCoordinator } from "./multi-universe-coordinator.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";

export interface DmxFrameSnapshot {
  readonly timestamp: number;
  readonly universeId: string;
  readonly channels: Record<number, number>;
  readonly blackoutActive: boolean;
  readonly activeChannelCount: number;
}

export interface DmxMonitor {
  readonly getSnapshot: (universeId?: string) => DmxFrameSnapshot;
  readonly subscribe: (callback: (frame: DmxFrameSnapshot) => void, universeId?: string) => () => void;
  readonly subscriberCount: () => number;
  readonly close: () => void;
}

export interface DmxMonitorOptions {
  readonly manager?: UniverseManager;
  readonly coordinator?: MultiUniverseCoordinator;
  readonly universeId?: string;
  readonly intervalMs?: number;
}

const DEFAULT_INTERVAL_MS = 67; // ~15fps

const EMPTY_SNAPSHOT: Omit<DmxFrameSnapshot, "timestamp" | "universeId"> = {
  channels: {},
  blackoutActive: false,
  activeChannelCount: 0,
};

export function createDmxMonitor(options: DmxMonitorOptions): DmxMonitor {
  const { manager, coordinator, universeId: defaultUniverseId = DEFAULT_UNIVERSE_ID } = options;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;

  // Each subscriber is tagged with its target universe
  const subscribers = new Map<(frame: DmxFrameSnapshot) => void, string>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  function buildSnapshot(universeId?: string): DmxFrameSnapshot {
    const uid = universeId ?? defaultUniverseId;

    if (coordinator) {
      return {
        timestamp: Date.now(),
        universeId: uid,
        channels: coordinator.getFullSnapshot(uid),
        blackoutActive: coordinator.isBlackoutActive(uid),
        activeChannelCount: coordinator.getActiveChannelCount(uid),
      };
    }

    if (manager) {
      return {
        timestamp: Date.now(),
        universeId: uid,
        channels: manager.getFullSnapshot(),
        blackoutActive: manager.isBlackoutActive(),
        activeChannelCount: manager.getActiveChannelCount(),
      };
    }

    return { timestamp: Date.now(), universeId: uid, ...EMPTY_SNAPSHOT };
  }

  function broadcast(): void {
    // Group subscribers by universe to avoid redundant snapshots
    const byUniverse = new Map<string, Array<(frame: DmxFrameSnapshot) => void>>();
    for (const [cb, uid] of subscribers) {
      const list = byUniverse.get(uid);
      if (list) {
        list.push(cb);
      } else {
        byUniverse.set(uid, [cb]);
      }
    }

    for (const [uid, callbacks] of byUniverse) {
      const frame = buildSnapshot(uid);
      for (const cb of callbacks) {
        cb(frame);
      }
    }
  }

  function startInterval(): void {
    if (timer === null && !closed) {
      timer = setInterval(broadcast, intervalMs);
    }
  }

  function stopInterval(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    getSnapshot: buildSnapshot,

    subscribe(callback: (frame: DmxFrameSnapshot) => void, universeId?: string): () => void {
      if (closed) return () => {};
      subscribers.set(callback, universeId ?? defaultUniverseId);
      startInterval();

      return () => {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          stopInterval();
        }
      };
    },

    subscriberCount(): number {
      return subscribers.size;
    },

    close(): void {
      closed = true;
      stopInterval();
      subscribers.clear();
    },
  };
}
