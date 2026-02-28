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

export interface DmxLogger {
  readonly info: (msg: string) => void;
  readonly warn: (msg: string) => void;
  readonly error: (msg: string) => void;
}

export interface UniverseManagerOptions {
  readonly onDmxError?: (error: unknown) => void;
  readonly logger?: DmxLogger;
}

export interface UniverseManager {
  readonly applyFixtureUpdate: (payload: FixtureUpdatePayload) => number;
  readonly blackout: () => void;
  readonly whiteout: () => void;
  readonly resumeNormal: () => void;
  readonly isBlackoutActive: () => boolean;
  readonly getActiveChannelCount: () => number;
  readonly getChannelSnapshot: (start: number, count: number) => Record<number, number>;
  readonly getFullSnapshot: () => Record<number, number>;
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
  const log = options.logger;
  let lastSendTime: number | null = null;
  let lastSendError: string | null = null;
  let blackoutActive = false;

  function safeSend(label: string, fn: () => void): void {
    try {
      fn();
      lastSendTime = Date.now();
      lastSendError = null;
    } catch (error: unknown) {
      lastSendError = error instanceof Error ? error.message : String(error);
      log?.error(`DMX send failed (${label}): ${lastSendError}`);
      options.onDmxError?.(error);
    }
  }

  return {
    applyFixtureUpdate(payload: FixtureUpdatePayload): number {
      if (blackoutActive) {
        return 0;
      }

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

      const channelCount = Object.keys(dmxUpdate).length;
      safeSend(`fixture-update ${channelCount}ch`, () => universe.update(dmxUpdate));
      log?.info(`DMX update: ${channelCount} channels sent`);

      return channelCount;
    },

    blackout(): void {
      blackoutActive = true;
      safeSend("blackout", () => universe.updateAll(0));
      activeChannels.clear();
      log?.info("DMX blackout: all 512 channels → 0 (override active)");
    },

    whiteout(): void {
      blackoutActive = true;
      safeSend("whiteout", () => universe.updateAll(MAX_VALUE));
      for (let ch = MIN_CHANNEL; ch <= MAX_CHANNEL; ch++) {
        activeChannels.set(ch, MAX_VALUE);
      }
      log?.info("DMX whiteout: all 512 channels → 255 (override active)");
    },

    resumeNormal(): void {
      blackoutActive = false;
      log?.info("DMX override cleared: resuming normal updates");
    },

    isBlackoutActive(): boolean {
      return blackoutActive;
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

    getFullSnapshot(): Record<number, number> {
      const snapshot: Record<number, number> = {};
      for (const [ch, val] of activeChannels) {
        snapshot[ch] = val;
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
      const count = Object.keys(channels).length;
      safeSend(`raw-update ${count}ch`, () => universe.update(channels));
    },

    getDmxSendStatus(): DmxSendStatus {
      return { lastSendTime, lastSendError };
    },
  };
}
