import type { DmxUniverse } from "./driver-factory.js";
import type { ChannelMap, FixtureUpdatePayload } from "../types/protocol.js";

const MIN_CHANNEL = 1;
const MAX_CHANNEL = 512;
const MIN_VALUE = 0;
const MAX_VALUE = 255;

export interface DmxSendStatus {
  readonly lastSendTime: number | null;
  readonly lastSendError: string | null;
}

export interface UniverseManagerOptions {
  readonly onDmxError?: (error: unknown) => void;
}

export interface UniverseManager {
  readonly applyFixtureUpdate: (payload: FixtureUpdatePayload) => number;
  readonly blackout: () => void;
  readonly whiteout: () => void;
  readonly getActiveChannelCount: () => number;
  readonly getChannelSnapshot: (start: number, count: number) => Record<number, number>;
  readonly applyRawUpdate: (channels: Record<number, number>) => void;
  readonly getDmxSendStatus: () => DmxSendStatus;
}

function clampValue(value: number): number {
  return Math.max(MIN_VALUE, Math.min(MAX_VALUE, Math.round(value)));
}

function isValidChannel(channel: number): boolean {
  return Number.isInteger(channel) && channel >= MIN_CHANNEL && channel <= MAX_CHANNEL;
}

/**
 * Validates and transforms a ChannelMap into a DMX-safe update object.
 * Returns null if no valid channels found.
 */
function buildDmxUpdate(channels: ChannelMap): Record<number, number> | null {
  const result: Record<number, number> = {};
  let count = 0;

  for (const [key, value] of Object.entries(channels)) {
    const channel = parseInt(key, 10);

    if (isValidChannel(channel) && typeof value === "number" && Number.isFinite(value)) {
      result[channel] = clampValue(value);
      count++;
    }
  }

  return count === 0 ? null : result;
}

export function createUniverseManager(
  universe: DmxUniverse,
  options: UniverseManagerOptions = {},
): UniverseManager {
  const activeChannels = new Map<number, number>();
  let lastSendTime: number | null = null;
  let lastSendError: string | null = null;

  function safeSend(fn: () => void): void {
    try {
      fn();
      lastSendTime = Date.now();
      lastSendError = null;
    } catch (error: unknown) {
      lastSendError = error instanceof Error ? error.message : String(error);
      options.onDmxError?.(error);
    }
  }

  return {
    applyFixtureUpdate(payload: FixtureUpdatePayload): number {
      const dmxUpdate = buildDmxUpdate(payload.channels);

      if (dmxUpdate === null) {
        return 0;
      }

      for (const [ch, val] of Object.entries(dmxUpdate)) {
        const chNum = Number(ch);
        if (val > 0) {
          activeChannels.set(chNum, val);
        } else {
          activeChannels.delete(chNum);
        }
      }

      safeSend(() => universe.update(dmxUpdate));

      return Object.keys(dmxUpdate).length;
    },

    blackout(): void {
      safeSend(() => universe.updateAll(0));
      activeChannels.clear();
    },

    whiteout(): void {
      safeSend(() => universe.updateAll(MAX_VALUE));
      for (let ch = MIN_CHANNEL; ch <= MAX_CHANNEL; ch++) {
        activeChannels.set(ch, MAX_VALUE);
      }
    },

    getActiveChannelCount(): number {
      return activeChannels.size;
    },

    getChannelSnapshot(start: number, count: number): Record<number, number> {
      const snapshot: Record<number, number> = {};
      for (let ch = start; ch < start + count; ch++) {
        snapshot[ch] = activeChannels.get(ch) ?? 0;
      }
      return snapshot;
    },

    applyRawUpdate(channels: Record<number, number>): void {
      for (const [ch, val] of Object.entries(channels)) {
        const chNum = Number(ch);
        if (val > 0) {
          activeChannels.set(chNum, val);
        } else {
          activeChannels.delete(chNum);
        }
      }
      safeSend(() => universe.update(channels));
    },

    getDmxSendStatus(): DmxSendStatus {
      return { lastSendTime, lastSendError };
    },
  };
}
