import type { UserFixtureStore } from "../fixtures/user-fixture-store.js";
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
 * Library provider that exposes user-created fixture templates
 * via the same interface as OFL/local-db providers.
 *
 * Uses incremental numeric IDs mapped to UUID strings since
 * the FixtureLibraryProvider interface uses `number` IDs.
 */
export function createUserFixtureProvider(
  store: UserFixtureStore,
): FixtureLibraryProvider {
  // Bidirectional maps: numeric ID ↔ UUID string
  // Rebuilt on each accessor call to stay in sync with store changes.
  function buildMaps() {
    const templates = store.getAll();

    const mfrNameToId = new Map<string, number>();
    const mfrIdToName = new Map<number, string>();
    const fixtureUuidToId = new Map<string, number>();
    const fixtureIdToUuid = new Map<number, string>();
    const modeUuidToId = new Map<string, number>();
    const modeIdToUuid = new Map<number, string>();

    let mfrCounter = 1;
    let fixtureCounter = 1;
    let modeCounter = 1;

    for (const t of templates) {
      // Manufacturer dedup
      if (!mfrNameToId.has(t.manufacturer)) {
        mfrNameToId.set(t.manufacturer, mfrCounter);
        mfrIdToName.set(mfrCounter, t.manufacturer);
        mfrCounter++;
      }

      // Fixture
      fixtureUuidToId.set(t.id, fixtureCounter);
      fixtureIdToUuid.set(fixtureCounter, t.id);
      fixtureCounter++;

      // Modes
      for (const m of t.modes) {
        modeUuidToId.set(m.id, modeCounter);
        modeIdToUuid.set(modeCounter, m.id);
        modeCounter++;
      }
    }

    return {
      templates,
      mfrNameToId,
      mfrIdToName,
      fixtureUuidToId,
      fixtureIdToUuid,
      modeUuidToId,
      modeIdToUuid,
    };
  }

  return {
    id: "custom",
    displayName: "My Fixtures",
    description: "User-created custom fixture templates",
    type: "local-db",

    status(): LibraryStatus {
      return {
        available: true,
        state: "ready",
        fixtureCount: store.getAll().length,
      };
    },

    getManufacturers(): readonly LibraryManufacturer[] {
      const { templates, mfrNameToId } = buildMaps();

      // Count fixtures per manufacturer
      const counts = new Map<string, number>();
      for (const t of templates) {
        counts.set(t.manufacturer, (counts.get(t.manufacturer) ?? 0) + 1);
      }

      const result: LibraryManufacturer[] = [];
      for (const [name, id] of mfrNameToId) {
        result.push({ id, name, fixtureCount: counts.get(name) ?? 0 });
      }
      return result;
    },

    getFixtures(manufacturerId: number): readonly LibraryFixture[] {
      const { templates, mfrIdToName, fixtureUuidToId } = buildMaps();
      const mfrName = mfrIdToName.get(manufacturerId);
      if (!mfrName) return [];

      return templates
        .filter((t) => t.manufacturer === mfrName)
        .map((t) => ({
          id: fixtureUuidToId.get(t.id)!,
          name: t.name,
          modeCount: t.modes.length,
        }));
    },

    getFixtureModes(fixtureId: number): readonly LibraryMode[] {
      const { templates, fixtureIdToUuid, modeUuidToId } = buildMaps();
      const uuid = fixtureIdToUuid.get(fixtureId);
      if (!uuid) return [];

      const template = templates.find((t) => t.id === uuid);
      if (!template) return [];

      return template.modes.map((m) => ({
        id: modeUuidToId.get(m.id)!,
        name: m.name,
        channelCount: m.channels.length,
      }));
    },

    getModeChannels(modeId: number): readonly FixtureChannel[] {
      const { templates, modeIdToUuid } = buildMaps();
      const uuid = modeIdToUuid.get(modeId);
      if (!uuid) return [];

      for (const t of templates) {
        const mode = t.modes.find((m) => m.id === uuid);
        if (mode) return mode.channels;
      }
      return [];
    },

    searchFixtures(query: string, limit?: number): readonly LibrarySearchResult[] {
      const { templates, fixtureUuidToId, mfrNameToId } = buildMaps();
      const tokens = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 2);
      if (tokens.length === 0) return [];

      const results: LibrarySearchResult[] = [];
      for (const t of templates) {
        const combined = `${t.name} ${t.manufacturer} ${t.category}`.toLowerCase();
        if (tokens.every((tok) => combined.includes(tok))) {
          results.push({
            fixtureId: fixtureUuidToId.get(t.id)!,
            fixtureName: t.name,
            mfrId: mfrNameToId.get(t.manufacturer)!,
            mfrName: t.manufacturer,
            modeCount: t.modes.length,
            category: t.category,
          });
        }
        if (limit && results.length >= limit) break;
      }
      return results;
    },
  };
}
