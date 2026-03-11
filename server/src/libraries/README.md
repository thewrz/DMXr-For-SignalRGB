# libraries/ — Fixture Library Provider System

## Provider Interface

All fixture sources implement `FixtureLibraryProvider` (defined in `types.ts`):

```ts
interface FixtureLibraryProvider {
  id: string;               // "ofl" | "local-db" | "user" | "builtin"
  displayName: string;
  type: "local-db" | "api";
  status(): LibraryStatus;
  getManufacturers(): LibraryManufacturer[];
  getFixtures(mfrId: number): LibraryFixture[];
  getFixtureModes(fixtureId: number): LibraryMode[];
  getModeChannels(modeId: number): FixtureChannel[];
  searchFixtures(query: string, limit?: number): LibrarySearchResult[];
}
```

## Registry Pattern

`registry.ts` -> `createLibraryRegistry(providers[])` -> `LibraryRegistry`

The registry is a read-only container: `getAll()`, `getById(id)`, `getAvailable()`.
Providers are registered at startup in `bootstrap/library-setup.ts` and never change.

## Providers

| File | ID | Source | Notes |
|------|----|--------|-------|
| `ofl-provider.ts` | `ofl` | Open Fixture Library API | Search delegated to `/search` route due to async caching |
| `local-db-provider.ts` | `local-db` | SoundSwitch SQLite DB | Auto-detected on disk; uses `ss-client` from soundswitch/ |
| `user-fixture-provider.ts` | `user` | User-created templates | Maps UUID-based store to numeric IDs for the provider interface |
| `builtin-template-provider.ts` | `builtin` | Hardcoded templates | Static in-memory data, no I/O |

## How It Connects

- Routes (`routes/libraries.ts`) expose the registry via REST endpoints
- `routes/search.ts` provides unified search across all providers + OFL API
- The web UI's library browser sidebar consumes these endpoints
