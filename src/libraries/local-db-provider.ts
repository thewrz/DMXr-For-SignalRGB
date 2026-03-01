import type { SsClient, SsStatus } from "../soundswitch/ss-client.js";
import type {
  FixtureLibraryProvider,
  LibraryStatus,
  LibraryManufacturer,
  LibraryFixture,
  LibraryMode,
  LibrarySearchResult,
} from "./types.js";
import type { FixtureChannel } from "../types/protocol.js";

export function createLocalDbProvider(
  client: SsClient | null,
  ssStatus: SsStatus,
): FixtureLibraryProvider {
  return {
    id: "local-db",
    displayName: "Local Fixture Database",
    description: "Auto-detected fixture database on this machine",
    type: "local-db",

    status(): LibraryStatus {
      return ssStatus;
    },

    getManufacturers(): readonly LibraryManufacturer[] {
      if (!client) return [];
      return client.getManufacturers();
    },

    getFixtures(manufacturerId: number): readonly LibraryFixture[] {
      if (!client) return [];
      return client.getFixtures(manufacturerId);
    },

    getFixtureModes(fixtureId: number): readonly LibraryMode[] {
      if (!client) return [];
      return client.getFixtureModes(fixtureId);
    },

    getModeChannels(modeId: number): readonly FixtureChannel[] {
      if (!client) return [];
      return client.mapToFixtureChannels(modeId);
    },

    searchFixtures(query: string, limit?: number): readonly LibrarySearchResult[] {
      if (!client) return [];
      return client.searchFixtures(query, limit);
    },

    close(): void {
      client?.close();
    },
  };
}
