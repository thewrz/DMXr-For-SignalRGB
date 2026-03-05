import type { DmxUniverse } from "./driver-factory.js";
import type { ChannelMap, FixtureUpdatePayload } from "../types/protocol.js";
import { pipeLog, shouldSample } from "../logging/pipeline-logger.js";

export type ControlMode = "normal" | "blackout" | "whiteout";

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
  readonly onDmxSendTiming?: (durationMs: number) => void;
}

export interface UniverseManager {
  readonly applyFixtureUpdate: (payload: FixtureUpdatePayload) => number;
  readonly blackout: () => void;
  readonly whiteout: () => void;
  readonly resumeNormal: () => void;
  readonly isBlackoutActive: () => boolean;
  readonly getControlMode: () => ControlMode;
  readonly getActiveChannelCount: () => number;
  readonly getChannelSnapshot: (start: number, count: number) => Record<number, number>;
  readonly getFullSnapshot: () => Record<number, number>;
  readonly applyRawUpdate: (channels: Record<number, number>) => void;
  readonly getDmxSendStatus: () => DmxSendStatus;
  /** Register safe center positions for motor channels (Pan/Tilt/etc).
   *  These are restored immediately after blackout/whiteout to prevent
   *  motors from slamming to mechanical limits at DMX 0 or 255. */
  readonly registerSafePositions: (channels: Record<number, number>) => void;
  /** Lock DMX addresses so applyFixtureUpdate and blackout/whiteout skip them. */
  readonly lockChannels: (addresses: readonly number[]) => void;
  /** Unlock DMX addresses so normal writes resume. */
  readonly unlockChannels: (addresses: readonly number[]) => void;
  /** Returns true if any channels are currently locked. */
  readonly hasLockedChannels: () => boolean;
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
  const safePositions = new Map<number, number>();
  const lockedChannels = new Set<number>();
  const log = options.logger;
  let lastSendTime: number | null = null;
  let lastSendError: string | null = null;
  let blackoutActive = false;
  let controlMode: ControlMode = "normal";

  function safeSend(label: string, fn: () => void): void {
    try {
      const start = performance.now();
      fn();
      const duration = performance.now() - start;
      lastSendTime = Date.now();
      lastSendError = null;
      options.onDmxSendTiming?.(duration);
    } catch (error: unknown) {
      lastSendError = error instanceof Error ? error.message : String(error);
      log?.error(`DMX send failed (${label}): ${lastSendError}`);
      options.onDmxError?.(error);
    }
  }

  return {
    applyFixtureUpdate(payload: FixtureUpdatePayload): number {
      if (blackoutActive) {
        pipeLog("debug", `applyFixtureUpdate BLOCKED (blackout active) for "${payload.fixture}"`);
        return 0;
      }

      const dmxUpdate = buildDmxUpdate(payload.channels);

      if (dmxUpdate === null) {
        pipeLog("warn", `applyFixtureUpdate: no valid channels for "${payload.fixture}"`);
        return 0;
      }

      // Filter out locked channels (flash takes priority)
      if (lockedChannels.size > 0) {
        for (const key of Object.keys(dmxUpdate)) {
          if (lockedChannels.has(Number(key))) {
            delete dmxUpdate[Number(key)];
          }
        }
        if (Object.keys(dmxUpdate).length === 0) {
          return 0;
        }
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

      if (shouldSample(`dmxUpdate:${payload.fixture}`)) {
        const addrs = Object.keys(dmxUpdate).map(Number).sort((a, b) => a - b);
        const snapshot = addrs.map((a) => `${a}:${dmxUpdate[a]}`).join(" ");
        pipeLog(
          "verbose",
          `DMX UPDATE "${payload.fixture}": ${channelCount}ch → ${snapshot}`,
        );
      }

      return channelCount;
    },

    blackout(): void {
      blackoutActive = true;
      controlMode = "blackout";
      const prevCount = activeChannels.size;

      // Preserve locked channel values before clearing
      const lockedValues = new Map<number, number>();
      for (const ch of lockedChannels) {
        lockedValues.set(ch, activeChannels.get(ch) ?? 0);
      }

      activeChannels.clear();

      // Always use selective update when we have safe positions or locked channels
      if (safePositions.size > 0 || lockedChannels.size > 0) {
        const selective: Record<number, number> = {};
        for (let ch = MIN_CHANNEL; ch <= MAX_CHANNEL; ch++) {
          if (lockedChannels.has(ch)) {
            // Locked channels (flash) keep their current value
            const val = lockedValues.get(ch) ?? 0;
            selective[ch] = val;
            if (val > 0) activeChannels.set(ch, val);
          } else if (safePositions.has(ch)) {
            selective[ch] = safePositions.get(ch)!;
            activeChannels.set(ch, safePositions.get(ch)!);
          } else {
            selective[ch] = 0;
          }
        }
        safeSend(`blackout-selective ${MAX_CHANNEL}ch`, () => universe.update(selective));
        const preserved = safePositions.size + lockedChannels.size;
        pipeLog("info",
          `BLACKOUT: zeroed ${MAX_CHANNEL - preserved} channels, ` +
          `preserved ${safePositions.size} motor + ${lockedChannels.size} locked`,
        );
      } else {
        safeSend("blackout", () => universe.updateAll(0));
        pipeLog("info", `BLACKOUT: cleared ${prevCount} active channels → all 512 zeroed`);
      }
      log?.info("DMX blackout active");
    },

    whiteout(): void {
      blackoutActive = true;
      controlMode = "whiteout";

      // Preserve locked channel values before clearing
      const lockedValues = new Map<number, number>();
      for (const ch of lockedChannels) {
        lockedValues.set(ch, activeChannels.get(ch) ?? 0);
      }

      activeChannels.clear();

      // Always use selective update when we have safe positions or locked channels
      if (safePositions.size > 0 || lockedChannels.size > 0) {
        const selective: Record<number, number> = {};
        for (let ch = MIN_CHANNEL; ch <= MAX_CHANNEL; ch++) {
          if (lockedChannels.has(ch)) {
            const val = lockedValues.get(ch) ?? 0;
            selective[ch] = val;
            if (val > 0) activeChannels.set(ch, val);
          } else if (safePositions.has(ch)) {
            selective[ch] = safePositions.get(ch)!;
            activeChannels.set(ch, safePositions.get(ch)!);
          } else {
            selective[ch] = MAX_VALUE;
            activeChannels.set(ch, MAX_VALUE);
          }
        }
        safeSend(`whiteout-selective ${MAX_CHANNEL}ch`, () => universe.update(selective));
        const preserved = safePositions.size + lockedChannels.size;
        pipeLog("info",
          `WHITEOUT: set ${MAX_CHANNEL - preserved} channels to 255, ` +
          `preserved ${safePositions.size} motor + ${lockedChannels.size} locked`,
        );
      } else {
        safeSend("whiteout", () => universe.updateAll(MAX_VALUE));
        for (let ch = MIN_CHANNEL; ch <= MAX_CHANNEL; ch++) {
          activeChannels.set(ch, MAX_VALUE);
        }
        pipeLog("info", "WHITEOUT: all 512 channels → 255");
      }
      log?.info("DMX whiteout active");
    },

    resumeNormal(): void {
      blackoutActive = false;
      controlMode = "normal";
      pipeLog("info", "RESUME: blackout cleared, normal updates enabled");
      log?.info("DMX override cleared: resuming normal updates");
    },

    isBlackoutActive(): boolean {
      return blackoutActive;
    },

    getControlMode(): ControlMode {
      return controlMode;
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
      if (shouldSample("rawUpdate")) {
        const addrs = Object.keys(channels).map(Number).sort((a, b) => a - b);
        const snapshot = addrs.map((a) => `${a}:${channels[Number(a)]}`).join(" ");
        pipeLog("verbose", `RAW UPDATE: ${count}ch → ${snapshot}`);
      }
    },

    getDmxSendStatus(): DmxSendStatus {
      return { lastSendTime, lastSendError };
    },

    registerSafePositions(channels: Record<number, number>): void {
      for (const [key, value] of Object.entries(channels)) {
        const ch = parseInt(key, 10);
        if (isValidChannel(ch)) {
          safePositions.set(ch, clampValue(value));
        }
      }
      const snapshot = [...safePositions.entries()]
        .sort(([a], [b]) => a - b)
        .map(([ch, val]) => `${ch}:${val}`)
        .join(" ");
      pipeLog("info", `Registered ${safePositions.size} motor safe positions: ${snapshot}`);
    },

    lockChannels(addresses: readonly number[]): void {
      for (const addr of addresses) {
        if (isValidChannel(addr)) {
          lockedChannels.add(addr);
        }
      }
    },

    unlockChannels(addresses: readonly number[]): void {
      for (const addr of addresses) {
        lockedChannels.delete(addr);
      }
    },

    hasLockedChannels(): boolean {
      return lockedChannels.size > 0;
    },
  };
}
