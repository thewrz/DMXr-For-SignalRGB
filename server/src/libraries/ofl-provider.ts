import type { OflClient } from "../ofl/ofl-client.js";
import type {
  FixtureLibraryProvider,
  LibraryStatus,
  LibraryManufacturer,
  LibraryFixture,
  LibraryMode,
  LibrarySearchResult,
} from "./types.js";
import type { FixtureChannel } from "../types/protocol.js";

export function createOflProvider(client: OflClient): FixtureLibraryProvider {
  return {
    id: "ofl",
    displayName: "Open Fixture Library",
    description: "Community-maintained open fixture database",
    type: "api",

    status(): LibraryStatus {
      return { available: true, state: "connected" };
    },

    getManufacturers(): readonly LibraryManufacturer[] {
      return [];
    },

    getFixtures(): readonly LibraryFixture[] {
      return [];
    },

    getFixtureModes(): readonly LibraryMode[] {
      return [];
    },

    getModeChannels(): readonly FixtureChannel[] {
      return [];
    },

    searchFixtures(query: string): readonly LibrarySearchResult[] {
      // OFL search is handled separately via /search route due to its
      // unique async caching semantics. This provider exists for registry
      // completeness and status reporting.
      return [];
    },
  };
}
