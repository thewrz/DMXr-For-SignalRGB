import type { FixtureUpdatePayload } from "../types/protocol.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";
import type { UniverseManager, DmxSendStatus } from "./universe-manager.js";

export interface MultiUniverseCoordinator {
  readonly applyFixtureUpdate: (universeId: string | undefined, payload: FixtureUpdatePayload) => number;
  readonly blackout: (universeId: string) => void;
  readonly blackoutAll: () => void;
  readonly whiteout: (universeId: string) => void;
  readonly whiteoutAll: () => void;
  readonly resumeNormal: (universeId: string) => void;
  readonly resumeNormalAll: () => void;
  readonly isBlackoutActive: (universeId: string) => boolean;
  readonly getChannelSnapshot: (universeId: string, start: number, count: number) => Record<number, number>;
  readonly getFullSnapshot: (universeId: string) => Record<number, number>;
  readonly getActiveChannelCount: (universeId: string) => number;
  readonly registerSafePositions: (universeId: string, channels: Record<number, number>) => void;
  readonly lockChannels: (universeId: string, addresses: readonly number[]) => void;
  readonly unlockChannels: (universeId: string, addresses: readonly number[]) => void;
  readonly getDmxSendStatus: (universeId: string) => DmxSendStatus | undefined;
}

type ManagerProvider = () => ReadonlyMap<string, UniverseManager>;

export function createMultiUniverseCoordinator(
  getManagers: ManagerProvider,
): MultiUniverseCoordinator {
  function resolve(universeId: string | undefined): UniverseManager | undefined {
    return getManagers().get(universeId ?? DEFAULT_UNIVERSE_ID);
  }

  function forAll(fn: (manager: UniverseManager) => void): void {
    for (const manager of getManagers().values()) {
      fn(manager);
    }
  }

  return {
    applyFixtureUpdate(universeId: string | undefined, payload: FixtureUpdatePayload): number {
      const manager = resolve(universeId);
      if (!manager) return 0;
      return manager.applyFixtureUpdate(payload);
    },

    blackout(universeId: string): void {
      resolve(universeId)?.blackout();
    },

    blackoutAll(): void {
      forAll((m) => m.blackout());
    },

    whiteout(universeId: string): void {
      resolve(universeId)?.whiteout();
    },

    whiteoutAll(): void {
      forAll((m) => m.whiteout());
    },

    resumeNormal(universeId: string): void {
      resolve(universeId)?.resumeNormal();
    },

    resumeNormalAll(): void {
      forAll((m) => m.resumeNormal());
    },

    isBlackoutActive(universeId: string): boolean {
      return resolve(universeId)?.isBlackoutActive() ?? false;
    },

    getChannelSnapshot(universeId: string, start: number, count: number): Record<number, number> {
      return resolve(universeId)?.getChannelSnapshot(start, count) ?? {};
    },

    getFullSnapshot(universeId: string): Record<number, number> {
      return resolve(universeId)?.getFullSnapshot() ?? {};
    },

    getActiveChannelCount(universeId: string): number {
      return resolve(universeId)?.getActiveChannelCount() ?? 0;
    },

    registerSafePositions(universeId: string, channels: Record<number, number>): void {
      resolve(universeId)?.registerSafePositions(channels);
    },

    lockChannels(universeId: string, addresses: readonly number[]): void {
      resolve(universeId)?.lockChannels(addresses);
    },

    unlockChannels(universeId: string, addresses: readonly number[]): void {
      resolve(universeId)?.unlockChannels(addresses);
    },

    getDmxSendStatus(universeId: string): DmxSendStatus | undefined {
      return resolve(universeId)?.getDmxSendStatus();
    },
  };
}
