import type { FixtureUpdatePayload } from "../types/protocol.js";
import type { UniverseManager, ControlMode } from "./universe-manager.js";
import type { MultiUniverseCoordinator } from "./multi-universe-coordinator.js";

/**
 * Unified DMX dispatch interface that hides the coordinator-vs-manager
 * branching. All operations always update the primary manager (which is
 * not in the connection pool) and optionally delegate to the coordinator
 * for universe-scoped operations.
 */
export interface DmxDispatcher {
  readonly applyFixtureUpdate: (universeId: string | undefined, payload: FixtureUpdatePayload) => number;
  readonly applyRawUpdate: (universeId: string | undefined, channels: Record<number, number>) => void;
  readonly blackout: (universeId?: string) => void;
  readonly whiteout: (universeId?: string) => void;
  readonly resumeNormal: (universeId?: string) => void;
  readonly getChannelSnapshot: (universeId: string | undefined, start: number, count: number) => Record<number, number>;
  readonly isBlackoutActive: (universeId?: string) => boolean;
  readonly getControlMode: (universeId?: string) => ControlMode;
  readonly getActiveChannelCount: (universeId?: string) => number;
}

export function createDmxDispatcher(
  manager: UniverseManager,
  coordinator?: MultiUniverseCoordinator,
): DmxDispatcher {
  return {
    applyFixtureUpdate(universeId, payload) {
      if (coordinator && universeId) {
        return coordinator.applyFixtureUpdate(universeId, payload);
      }
      return manager.applyFixtureUpdate(payload);
    },

    applyRawUpdate(universeId, channels) {
      if (coordinator && universeId) {
        coordinator.applyRawUpdate(universeId, channels);
      } else {
        manager.applyRawUpdate(channels);
      }
    },

    blackout(universeId?) {
      if (coordinator && universeId) {
        coordinator.blackout(universeId);
      } else if (coordinator) {
        coordinator.blackoutAll();
      }
      // Primary manager is not in the connection pool — always update it
      manager.blackout();
    },

    whiteout(universeId?) {
      if (coordinator && universeId) {
        coordinator.whiteout(universeId);
      } else if (coordinator) {
        coordinator.whiteoutAll();
      }
      manager.whiteout();
    },

    resumeNormal(universeId?) {
      if (coordinator && universeId) {
        coordinator.resumeNormal(universeId);
      } else if (coordinator) {
        coordinator.resumeNormalAll();
      }
      manager.resumeNormal();
    },

    getChannelSnapshot(universeId, start, count) {
      if (coordinator && universeId) {
        return coordinator.getChannelSnapshot(universeId, start, count);
      }
      return manager.getChannelSnapshot(start, count);
    },

    isBlackoutActive(universeId?) {
      if (coordinator && universeId) {
        return coordinator.isBlackoutActive(universeId);
      }
      return manager.isBlackoutActive();
    },

    getControlMode(universeId?) {
      if (coordinator && universeId) {
        return coordinator.getControlMode(universeId);
      }
      return manager.getControlMode();
    },

    getActiveChannelCount(universeId?) {
      if (coordinator && universeId) {
        return coordinator.getActiveChannelCount(universeId);
      }
      return manager.getActiveChannelCount();
    },
  };
}
