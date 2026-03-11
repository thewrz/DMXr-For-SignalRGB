import type { MovementEngine } from "./movement-interpolator.js";
import type { FixtureStore } from "./fixture-store.js";
import type { DmxDispatcher } from "../dmx/dmx-dispatcher.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";

export interface MovementTickDeps {
  readonly engine: MovementEngine;
  readonly fixtureStore: FixtureStore;
  readonly dispatcher: DmxDispatcher;
}

/**
 * Creates a tick handler that reads movement engine outputs and dispatches
 * DMX updates to the correct universe via DmxDispatcher.
 */
export function createMovementTickHandler(deps: MovementTickDeps) {
  return (deltaMs: number): void => {
    const outputs = deps.engine.tick(deltaMs);

    for (const [fixtureId, output] of outputs) {
      const fixture = deps.fixtureStore.getById(fixtureId);
      if (!fixture) continue;

      const channels: Record<number, number> = {};
      for (const ch of fixture.channels) {
        const addr = fixture.dmxStartAddress + ch.offset;
        if (ch.type === "Pan" && !/fine/i.test(ch.name)) {
          channels[addr] = output.panCoarse;
        } else if (ch.type === "Pan" && /fine/i.test(ch.name)) {
          channels[addr] = output.panFine;
        } else if (ch.type === "Tilt" && !/fine/i.test(ch.name)) {
          channels[addr] = output.tiltCoarse;
        } else if (ch.type === "Tilt" && /fine/i.test(ch.name)) {
          channels[addr] = output.tiltFine;
        }
      }

      if (Object.keys(channels).length > 0) {
        deps.dispatcher.applyRawUpdate(fixture.universeId ?? DEFAULT_UNIVERSE_ID, channels);
      }
    }
  };
}
