import type { UniverseManager } from "../dmx/universe-manager.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import { computeSafePositions } from "../fixtures/motor-guard.js";
import { pipeLog } from "../logging/pipeline-logger.js";

/**
 * Initialize fixture defaults on the DMX universe.
 * - Registers motor safe positions (so blackout/whiteout doesn't slam motors)
 * - Enters blackout: zeros all channels, restores motor-safe positions
 * - Server stays in blackout until a client resumes or SignalRGB sends colors
 *
 * NOTE: We intentionally do NOT push full fixture defaults (via applyRawUpdate)
 * at startup. Doing so would bypass the blackout guard and turn on lighting
 * channels (e.g. Strobe: 255) before any client has connected. Motor channels
 * are already handled by registerSafePositions + blackout.
 */
export function initializeFixtureDefaults(
  fixtureStore: FixtureStore,
  manager: UniverseManager,
): void {
  const fixtures = fixtureStore.getAll();
  pipeLog("info", `Loaded ${fixtures.length} fixtures, initializing defaults...`);

  const safePositions = computeSafePositions(fixtures);
  manager.registerSafePositions(safePositions);
  manager.blackout();

  const motorCount = Object.keys(safePositions).length;
  pipeLog("info",
    `Fixture defaults initialization complete: ${fixtures.length} fixtures, ` +
    `${motorCount} motor channels registered, server in blackout`,
  );
}
