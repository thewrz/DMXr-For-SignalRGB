import type { FastifyInstance } from "fastify";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { DmxDispatcher } from "../dmx/dmx-dispatcher.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";
import { mapColor } from "../fixtures/channel-mapper.js";
import { successResponse } from "./response-helpers.js";

export interface ControlModesDeps {
  readonly dispatcher: DmxDispatcher;
  readonly store: FixtureStore;
}

export function registerControlModeRoutes(
  app: FastifyInstance,
  deps: ControlModesDeps,
): void {
  app.post<{ Body: { universeId?: string } }>("/control/blackout", async (request) => {
    const universeId = request.body?.universeId;

    deps.dispatcher.blackout(universeId);

    const fixtures = deps.store.getAll();
    request.log.info(
      { action: "blackout", fixtureCount: fixtures.length, universeId: universeId ?? "all" },
      `blackout: ${universeId ?? "all universes"} → 0`,
    );
    return successResponse({ action: "blackout" as const, controlMode: "blackout" as const, universeId: universeId ?? null });
  });

  app.post<{ Body: { universeId?: string } }>("/control/whiteout", async (request) => {
    const universeId = request.body?.universeId;
    const fixtures = universeId
      ? deps.store.getByUniverse(universeId)
      : deps.store.getAll();

    deps.dispatcher.whiteout(universeId);

    // Overlay fixture-specific values via mapColor for correct
    // non-color channels (pan center, strobe open, dimmer full, etc.)
    let totalChannelsSet = 0;
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
      deps.dispatcher.applyRawUpdate(uid, updates);
    }

    request.log.info(
      {
        action: "whiteout",
        fixtureCount: fixtures.length,
        channelsSet: totalChannelsSet,
      },
      `whiteout: ${fixtures.length} fixtures, ${totalChannelsSet} channels set via mapColor`,
    );

    return successResponse({
      action: "whiteout" as const,
      controlMode: "whiteout" as const,
      fixturesUpdated: fixtures.length,
      universeId: universeId ?? null,
    });
  });

  app.post<{ Body: { universeId?: string } }>("/control/resume", async (request) => {
    const universeId = request.body?.universeId;

    deps.dispatcher.resumeNormal(universeId);

    request.log.info(
      { action: "resume", universeId: universeId ?? "all" },
      `resume: ${universeId ?? "all universes"} override cleared`,
    );
    return successResponse({ action: "resume" as const, controlMode: "normal" as const, universeId: universeId ?? null });
  });
}
