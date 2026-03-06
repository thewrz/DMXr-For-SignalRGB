import type { FastifyInstance } from "fastify";
import type { UniverseManager } from "../dmx/universe-manager.js";
import type { MultiUniverseCoordinator } from "../dmx/multi-universe-coordinator.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";
import { mapColor } from "../fixtures/channel-mapper.js";

export interface ControlModesDeps {
  readonly manager: UniverseManager;
  readonly store: FixtureStore;
  readonly coordinator?: MultiUniverseCoordinator;
}

export function registerControlModeRoutes(
  app: FastifyInstance,
  deps: ControlModesDeps,
): void {
  app.post<{ Body: { universeId?: string } }>("/control/blackout", async (request) => {
    const universeId = request.body?.universeId;

    if (deps.coordinator && universeId) {
      deps.coordinator.blackout(universeId);
    } else if (deps.coordinator) {
      deps.coordinator.blackoutAll();
    }
    // Primary manager is not in the connection pool — always update it
    deps.manager.blackout();

    const fixtures = deps.store.getAll();
    request.log.info(
      { action: "blackout", fixtureCount: fixtures.length, universeId: universeId ?? "all" },
      `blackout: ${universeId ?? "all universes"} → 0`,
    );
    return { success: true, action: "blackout", controlMode: "blackout" as const, universeId: universeId ?? null };
  });

  app.post<{ Body: { universeId?: string } }>("/control/whiteout", async (request) => {
    const universeId = request.body?.universeId;
    const fixtures = universeId
      ? deps.store.getByUniverse(universeId)
      : deps.store.getAll();

    if (deps.coordinator && universeId) {
      deps.coordinator.whiteout(universeId);
    } else if (deps.coordinator) {
      deps.coordinator.whiteoutAll();
    }
    // Primary manager is not in the connection pool — always update it
    deps.manager.whiteout();

    // Overlay fixture-specific values via mapColor for correct
    // non-color channels (pan center, strobe open, dimmer full, etc.)
    let totalChannelsSet = 0;
    if (deps.coordinator) {
      const byUniverse = new Map<string, Record<number, number>>();
      for (const fixture of fixtures) {
        const uid = fixture.universeId ?? DEFAULT_UNIVERSE_ID;
        const channels = mapColor(fixture, 255, 255, 255, 1.0);
        const existing = byUniverse.get(uid) ?? {};
        const merged = { ...existing };
        for (const [addr, val] of Object.entries(channels)) {
          merged[Number(addr)] = val;
        }
        byUniverse.set(uid, merged);
      }
      for (const [uid, updates] of byUniverse) {
        totalChannelsSet += Object.keys(updates).length;
        deps.coordinator.applyRawUpdate(uid, updates);
      }
    } else {
      const allUpdates: Record<number, number> = {};
      for (const fixture of fixtures) {
        const channels = mapColor(fixture, 255, 255, 255, 1.0);
        for (const [addr, val] of Object.entries(channels)) {
          allUpdates[Number(addr)] = val;
        }
      }
      totalChannelsSet = Object.keys(allUpdates).length;
      if (totalChannelsSet > 0) {
        deps.manager.applyRawUpdate(allUpdates);
      }
    }

    request.log.info(
      {
        action: "whiteout",
        fixtureCount: fixtures.length,
        channelsSet: totalChannelsSet,
      },
      `whiteout: ${fixtures.length} fixtures, ${totalChannelsSet} channels set via mapColor`,
    );

    return {
      success: true,
      action: "whiteout",
      controlMode: "whiteout" as const,
      fixturesUpdated: fixtures.length,
      universeId: universeId ?? null,
    };
  });

  app.post<{ Body: { universeId?: string } }>("/control/resume", async (request) => {
    const universeId = request.body?.universeId;

    if (deps.coordinator && universeId) {
      deps.coordinator.resumeNormal(universeId);
    } else if (deps.coordinator) {
      deps.coordinator.resumeNormalAll();
    }
    // Primary manager is not in the connection pool — always update it
    deps.manager.resumeNormal();

    request.log.info(
      { action: "resume", universeId: universeId ?? "all" },
      `resume: ${universeId ?? "all universes"} override cleared`,
    );
    return { success: true, action: "resume", controlMode: "normal" as const, universeId: universeId ?? null };
  });
}
