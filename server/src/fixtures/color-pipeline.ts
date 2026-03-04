import type { FixtureStore } from "./fixture-store.js";
import type { UniverseManager } from "../dmx/universe-manager.js";
import { mapColor } from "./channel-mapper.js";
import { pipeLog, shouldSample } from "../logging/pipeline-logger.js";

export interface ColorEntry {
  readonly id?: string;
  readonly fixtureIndex?: number;
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly brightness: number;
}

export interface ColorBatchResult {
  readonly fixturesMatched: number;
  readonly channelsUpdated: number;
}

export function processColorBatch(
  entries: readonly ColorEntry[],
  fixtureStore: FixtureStore,
  manager: UniverseManager,
): ColorBatchResult {
  let totalChannels = 0;
  let fixturesMatched = 0;
  const allUpdates: Record<number, number> = {};
  const trace = shouldSample("colorBatch");

  const allFixtures = fixtureStore.getAll();

  for (const entry of entries) {
    const fixture =
      entry.id !== undefined
        ? fixtureStore.getById(entry.id)
        : entry.fixtureIndex !== undefined
          ? allFixtures[entry.fixtureIndex]
          : undefined;

    if (fixture === undefined) {
      if (trace) {
        const ref = entry.id !== undefined
          ? `id="${entry.id}"`
          : `index=${entry.fixtureIndex}`;
        pipeLog("debug", `colorBatch: entry ${ref} → NO MATCH`);
      }
      continue;
    }

    fixturesMatched++;

    const channels = mapColor(
      fixture,
      entry.r,
      entry.g,
      entry.b,
      entry.brightness,
    );

    for (const [addr, val] of Object.entries(channels)) {
      allUpdates[Number(addr)] = val;
    }

    totalChannels += Object.keys(channels).length;
  }

  let channelsUpdated = 0;

  if (totalChannels > 0) {
    channelsUpdated = manager.applyFixtureUpdate({
      fixture: "color-batch",
      channels: allUpdates,
    });
  }

  if (trace) {
    const addrs = Object.keys(allUpdates).map(Number).sort((a, b) => a - b);
    const snapshot = addrs.map((a) => `${a}:${allUpdates[a]}`).join(" ");
    pipeLog(
      "verbose",
      `colorBatch: ${entries.length} entries → ${fixturesMatched} matched, ` +
      `${channelsUpdated}/${totalChannels} ch sent\n  DMX: ${snapshot}`,
    );
  }

  return { fixturesMatched, channelsUpdated };
}
