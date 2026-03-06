import type { UniverseManager } from "../dmx/universe-manager.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import { getFixtureDefaults } from "../fixtures/channel-mapper.js";
import { computeSafePositions } from "../fixtures/motor-guard.js";
import { pipeLog } from "../logging/pipeline-logger.js";

/**
 * Initialize fixture defaults on the DMX universe.
 * - Registers motor safe positions (so blackout/whiteout doesn't slam motors)
 * - Sets all channels to fixture defaults via applyRawUpdate (bypasses blackout guard)
 * - Server stays in blackout until a client resumes or SignalRGB sends colors
 */
export function initializeFixtureDefaults(
  fixtureStore: FixtureStore,
  manager: UniverseManager,
): void {
  const fixtures = fixtureStore.getAll();
  pipeLog("info", `Loaded ${fixtures.length} fixtures, initializing defaults...`);

  manager.registerSafePositions(computeSafePositions(fixtures));
  manager.blackout();

  for (const fixture of fixtures) {
    const defaults = getFixtureDefaults(fixture);
    manager.applyRawUpdate(defaults);
    const count = Object.keys(defaults).length;
    pipeLog("info", `Startup defaults for "${fixture.name}": ${count} channels pushed to DMX`);
  }

  pipeLog("info", "Fixture defaults initialization complete");
}
