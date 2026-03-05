import type { UniverseManager } from "./universe-manager.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";

export interface DmxFrameSnapshot {
  readonly timestamp: number;
  readonly universeId: string;
  readonly channels: Record<number, number>;
  readonly blackoutActive: boolean;
  readonly activeChannelCount: number;
}

export interface DmxMonitor {
  readonly getSnapshot: () => DmxFrameSnapshot;
  readonly subscribe: (callback: (frame: DmxFrameSnapshot) => void) => () => void;
  readonly subscriberCount: () => number;
  readonly close: () => void;
}

export interface DmxMonitorOptions {
  readonly manager: UniverseManager;
  readonly universeId?: string;
  readonly intervalMs?: number;
}

const DEFAULT_INTERVAL_MS = 67; // ~15fps

export function createDmxMonitor(options: DmxMonitorOptions): DmxMonitor {
  const { manager, universeId = DEFAULT_UNIVERSE_ID } = options;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const subscribers = new Set<(frame: DmxFrameSnapshot) => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  function buildSnapshot(): DmxFrameSnapshot {
    return {
      timestamp: Date.now(),
      universeId,
      channels: manager.getFullSnapshot(),
      blackoutActive: manager.isBlackoutActive(),
      activeChannelCount: manager.getActiveChannelCount(),
    };
  }

  function broadcast(): void {
    const frame = buildSnapshot();
    for (const cb of subscribers) {
      cb(frame);
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

    subscribe(callback: (frame: DmxFrameSnapshot) => void): () => void {
      if (closed) return () => {};
      subscribers.add(callback);
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
