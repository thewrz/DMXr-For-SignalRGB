import type {
  OflManufacturersResponse,
  OflManufacturerDetail,
  OflFixtureDefinition,
  OflFixtureSummary,
} from "./ofl-types.js";

const OFL_BASE_URL = "https://open-fixture-library.org";
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 200;

interface CacheEntry<T> {
  readonly data: T;
  readonly expiresAt: number;
}

export interface OflSearchResult {
  readonly mfrKey: string;
  readonly mfrName: string;
  readonly fixtureKey: string;
  readonly fixtureName: string;
  readonly categories: readonly string[];
}

export interface OflClient {
  readonly getManufacturers: () => Promise<OflManufacturersResponse>;
  readonly getManufacturerFixtures: (
    manufacturerKey: string,
  ) => Promise<OflManufacturerDetail>;
  readonly getFixture: (
    manufacturer: string,
    model: string,
  ) => Promise<OflFixtureDefinition>;
  readonly searchFixtures: (query: string) => OflSearchResult[];
}

interface OflClientOptions {
  readonly baseUrl?: string;
  readonly ttlMs?: number;
  readonly fetchFn?: typeof fetch;
}

export function createOflClient(options: OflClientOptions = {}): OflClient {
  const baseUrl = options.baseUrl ?? OFL_BASE_URL;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const fetchFn = options.fetchFn ?? fetch;
  const cache = new Map<string, CacheEntry<unknown>>();

  async function cachedFetch<T>(key: string, url: string): Promise<T> {
    const cached = cache.get(key);

    if (cached !== undefined && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }

    const response = await fetchFn(url);

    if (!response.ok) {
      throw new Error(`OFL API error: ${response.status} ${response.statusText} for ${url}`);
    }

    const data = (await response.json()) as T;

    if (cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }

    cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    return data;
  }

  return {
    async getManufacturers(): Promise<OflManufacturersResponse> {
      return cachedFetch<OflManufacturersResponse>(
        "manufacturers",
        `${baseUrl}/api/v1/manufacturers`,
      );
    },

    async getManufacturerFixtures(
      manufacturerKey: string,
    ): Promise<OflManufacturerDetail> {
      const manufacturers = await cachedFetch<OflManufacturersResponse>(
        "manufacturers",
        `${baseUrl}/api/v1/manufacturers`,
      );

      const mfr = manufacturers[manufacturerKey];

      if (mfr === undefined) {
        throw new Error(`Manufacturer not found: ${manufacturerKey}`);
      }

      const detail = await cachedFetch<{
        fixtures:
          | readonly { key: string; name: string; categories: string[] }[]
          | Record<string, { name: string; categories: string[] }>;
      }>(
        `manufacturer:${manufacturerKey}`,
        `${baseUrl}/api/v1/manufacturers/${manufacturerKey}`,
      );

      const raw = detail.fixtures ?? [];
      const fixtures: OflFixtureSummary[] = Array.isArray(raw)
        ? raw.map((fixture) => ({
            key: fixture.key,
            name: fixture.name,
            categories: fixture.categories ?? [],
          }))
        : Object.entries(raw).map(([key, fixture]) => ({
            key,
            name: fixture.name,
            categories: fixture.categories ?? [],
          }));

      return {
        name: mfr.name,
        fixtures,
      };
    },

    async getFixture(
      manufacturer: string,
      model: string,
    ): Promise<OflFixtureDefinition> {
      return cachedFetch<OflFixtureDefinition>(
        `fixture:${manufacturer}/${model}`,
        `${baseUrl}/${manufacturer}/${model}.json`,
      );
    },

    searchFixtures(query: string): OflSearchResult[] {
      const tokens = query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 2);
      if (tokens.length === 0) return [];

      const results: OflSearchResult[] = [];

      for (const [key, entry] of cache.entries()) {
        if (!key.startsWith("manufacturer:")) continue;
        if (entry.expiresAt <= Date.now()) continue;

        const mfrKey = key.slice("manufacturer:".length);
        const detail = entry.data as {
          fixtures:
            | readonly { key: string; name: string; categories?: string[] }[]
            | Record<string, { name: string; categories?: string[] }>;
        };

        const raw = detail.fixtures ?? [];
        const fixtures = Array.isArray(raw)
          ? raw
          : Object.entries(raw).map(([k, v]) => ({ key: k, ...v }));

        // Resolve manufacturer name from the manufacturers cache
        const mfrsEntry = cache.get("manufacturers");
        const mfrs = mfrsEntry && mfrsEntry.expiresAt > Date.now()
          ? (mfrsEntry.data as OflManufacturersResponse)
          : undefined;
        const mfrName = mfrs?.[mfrKey]?.name ?? mfrKey;

        for (const fixture of fixtures) {
          const combined = `${fixture.name} ${mfrName} ${(fixture.categories ?? []).join(" ")}`.toLowerCase();
          const matches = tokens.every((t) => combined.includes(t));
          if (matches) {
            results.push({
              mfrKey,
              mfrName,
              fixtureKey: fixture.key,
              fixtureName: fixture.name,
              categories: fixture.categories ?? [],
            });
          }
        }
      }

      return results;
    },
  };
}
