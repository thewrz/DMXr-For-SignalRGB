import type { FixtureLibraryProvider, LibraryRegistry } from "./types.js";

export function createLibraryRegistry(
  providers: readonly FixtureLibraryProvider[],
): LibraryRegistry {
  return {
    getAll: () => providers,
    getById: (id) => providers.find((p) => p.id === id),
    getAvailable: () => providers.filter((p) => p.status().available),
  };
}
