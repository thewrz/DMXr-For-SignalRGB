# ofl/ — Open Fixture Library Client & Cache

## Architecture

Three layers, innermost to outermost:

### ofl-client.ts
- `createOflClient(options?)` -> `OflClient`
- Fetches from `https://open-fixture-library.org/api/v1/`
- In-memory TTL cache (10min, max 200 entries) with LRU eviction
- `searchFixtures(query)`: searches cached manufacturer data (no network call)
- Methods: `getManufacturers`, `getManufacturerFixtures`, `getFixture`

### ofl-disk-cache.ts
- `createOflDiskCache(options?)` -> `OflDiskCache`
- Persists cache entries as JSON files in `./config/ofl-cache/`
- Each file is a `CacheEnvelope { data, cachedAt, ttlMs }` (default 7-day TTL)
- Stale entries are still returned (caller decides whether to use them)
- Methods: `get`, `set`, `clear`, `getStats`, `keys`

### cached-ofl-client.ts (wrapper pattern)
- `createCachedOflClient({ inner, diskCache })` -> `OflClient`
- Same `OflClient` interface; wraps the inner client with `fetchWithFallback`:
  - On success: writes to disk cache, returns fresh data
  - On failure: falls back to disk cache (even if stale)
  - Search is pass-through (uses inner client's in-memory cache)

### ofl-types.ts
- TypeScript interfaces for OFL API responses: `OflManufacturersResponse`,
  `OflManufacturerDetail`, `OflFixtureDefinition`, `OflFixtureSummary`
