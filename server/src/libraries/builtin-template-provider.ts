import { getBuiltinTemplates } from "../fixtures/builtin-templates.js";
import type {
  FixtureLibraryProvider,
  LibraryStatus,
  LibraryManufacturer,
  LibraryFixture,
  LibraryMode,
  LibrarySearchResult,
} from "./types.js";
import type { FixtureChannel } from "../types/protocol.js";

/**
 * Library provider that exposes built-in generic fixture templates
 * via the same interface as OFL/local-db/custom providers.
 *
 * All data is static and in-memory — no I/O, no state changes.
 * Maps are built once at construction since templates never change.
 */
export function createBuiltinTemplateProvider(): FixtureLibraryProvider {
  const templates = getBuiltinTemplates();

  // Build stable numeric ID maps (templates are static, so one-time build is safe)
  const fixtureIdToIndex = new Map<number, number>();
  const modeKeyToId = new Map<string, number>();
  const modeIdToKey = new Map<number, string>();

  let fixtureCounter = 1;
  let modeCounter = 1;

  for (let i = 0; i < templates.length; i++) {
    fixtureIdToIndex.set(fixtureCounter, i);
    fixtureCounter++;

    for (const m of templates[i].modes) {
      modeKeyToId.set(m.id, modeCounter);
      modeIdToKey.set(modeCounter, m.id);
      modeCounter++;
    }
  }

  // Single manufacturer: "Generic" with ID 1
  const MFR_ID = 1;

  return {
    id: "builtin",
    displayName: "Built-in Templates",
    description: "Common generic fixture patterns for quick setup",
    type: "local-db",

    status(): LibraryStatus {
      return {
        available: true,
        state: "ready",
        fixtureCount: templates.length,
      };
    },

    getManufacturers(): readonly LibraryManufacturer[] {
      return [{ id: MFR_ID, name: "Generic", fixtureCount: templates.length }];
    },

    getFixtures(manufacturerId: number): readonly LibraryFixture[] {
      if (manufacturerId !== MFR_ID) return [];

      return templates.map((t, i) => ({
        id: i + 1,
        name: t.name,
        modeCount: t.modes.length,
      }));
    },

    getFixtureModes(fixtureId: number): readonly LibraryMode[] {
      const index = fixtureIdToIndex.get(fixtureId);
      if (index === undefined) return [];

      const template = templates[index];
      return template.modes.map((m) => ({
        id: modeKeyToId.get(m.id)!,
        name: m.name,
        channelCount: m.channels.length,
      }));
    },

    getModeChannels(modeId: number): readonly FixtureChannel[] {
      const key = modeIdToKey.get(modeId);
      if (!key) return [];

      for (const t of templates) {
        const mode = t.modes.find((m) => m.id === key);
        if (mode) return mode.channels;
      }
      return [];
    },

    searchFixtures(query: string, limit?: number): readonly LibrarySearchResult[] {
      const tokens = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 2);
      if (tokens.length === 0) return [];

      const results: LibrarySearchResult[] = [];
      for (let i = 0; i < templates.length; i++) {
        const t = templates[i];
        const combined = `${t.name} ${t.manufacturer} ${t.category}`.toLowerCase();
        if (tokens.every((tok) => combined.includes(tok))) {
          results.push({
            fixtureId: i + 1,
            fixtureName: t.name,
            mfrId: MFR_ID,
            mfrName: "Generic",
            modeCount: t.modes.length,
            category: t.category,
          });
        }
        if (limit && results.length >= limit) break;
      }
      return results;
    },

    getFixtureCategory(fixtureId: number): string | null {
      const index = fixtureIdToIndex.get(fixtureId);
      if (index === undefined) return null;
      return templates[index].category;
    },
  };
}
