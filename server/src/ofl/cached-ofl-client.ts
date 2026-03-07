import type { OflClient, OflSearchResult } from "./ofl-client.js";
import type { OflDiskCache } from "./ofl-disk-cache.js";
import type {
  OflManufacturersResponse,
  OflManufacturerDetail,
  OflFixtureDefinition,
} from "./ofl-types.js";

export interface CachedOflClientOptions {
  readonly inner: OflClient;
  readonly diskCache: OflDiskCache;
}

async function fetchWithFallback<T>(
  fetchFn: () => Promise<T>,
  cacheKey: string,
  diskCache: OflDiskCache,
): Promise<T> {
  try {
    const data = await fetchFn();
    await diskCache.set(cacheKey, data);
    return data;
  } catch (error) {
    const cached = await diskCache.get(cacheKey);

    if (cached !== undefined) {
      return cached.data as T;
    }

    throw error;
  }
}

export function createCachedOflClient(options: CachedOflClientOptions): OflClient {
  const { inner, diskCache } = options;

  return {
    getManufacturers(): Promise<OflManufacturersResponse> {
      return fetchWithFallback(
        () => inner.getManufacturers(),
        "manufacturers",
        diskCache,
      );
    },

    getManufacturerFixtures(manufacturerKey: string): Promise<OflManufacturerDetail> {
      return fetchWithFallback(
        () => inner.getManufacturerFixtures(manufacturerKey),
        `manufacturer:${manufacturerKey}`,
        diskCache,
      );
    },

    getFixture(manufacturer: string, model: string): Promise<OflFixtureDefinition> {
      return fetchWithFallback(
        () => inner.getFixture(manufacturer, model),
        `fixture:${manufacturer}/${model}`,
        diskCache,
      );
    },

    searchFixtures(query: string): OflSearchResult[] {
      return inner.searchFixtures(query);
    },
  };
}
