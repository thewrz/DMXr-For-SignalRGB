import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OflClient } from "./ofl-client.js";
import type { OflDiskCache, CacheResult } from "./ofl-disk-cache.js";
import { createCachedOflClient } from "./cached-ofl-client.js";

function createMockInner(): OflClient {
  return {
    getManufacturers: vi.fn(),
    getManufacturerFixtures: vi.fn(),
    getFixture: vi.fn(),
    searchFixtures: vi.fn(),
  };
}

function createMockDiskCache(): OflDiskCache {
  return {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
    getStats: vi.fn(),
    keys: vi.fn(),
  };
}

const MANUFACTURERS_DATA = {
  cameo: { name: "Cameo", fixtureCount: 42 },
};

const MANUFACTURER_DETAIL = {
  name: "Cameo",
  fixtures: [{ key: "par64", name: "PAR 64", categories: ["Color Changer"] }],
};

const FIXTURE_DEF = {
  name: "PAR 64",
  categories: ["Color Changer"],
  availableChannels: {},
  modes: [{ name: "3ch", channels: ["Red", "Green", "Blue"] }],
};

describe("createCachedOflClient", () => {
  let inner: ReturnType<typeof createMockInner>;
  let diskCache: ReturnType<typeof createMockDiskCache>;

  beforeEach(() => {
    inner = createMockInner();
    diskCache = createMockDiskCache();
  });

  describe("getManufacturers", () => {
    it("calls inner and writes to disk cache", async () => {
      vi.mocked(inner.getManufacturers).mockResolvedValue(MANUFACTURERS_DATA);
      vi.mocked(diskCache.set).mockResolvedValue();
      const client = createCachedOflClient({ inner, diskCache });

      const result = await client.getManufacturers();

      expect(result).toEqual(MANUFACTURERS_DATA);
      expect(inner.getManufacturers).toHaveBeenCalledOnce();
      expect(diskCache.set).toHaveBeenCalledWith("manufacturers", MANUFACTURERS_DATA);
    });

    it("falls back to disk cache when inner throws", async () => {
      vi.mocked(inner.getManufacturers).mockRejectedValue(new Error("offline"));
      vi.mocked(diskCache.get).mockResolvedValue({
        data: MANUFACTURERS_DATA,
        stale: false,
      });
      const client = createCachedOflClient({ inner, diskCache });

      const result = await client.getManufacturers();

      expect(result).toEqual(MANUFACTURERS_DATA);
      expect(diskCache.get).toHaveBeenCalledWith("manufacturers");
    });

    it("returns stale data when inner throws and cache is stale", async () => {
      vi.mocked(inner.getManufacturers).mockRejectedValue(new Error("offline"));
      vi.mocked(diskCache.get).mockResolvedValue({
        data: MANUFACTURERS_DATA,
        stale: true,
      });
      const client = createCachedOflClient({ inner, diskCache });

      const result = await client.getManufacturers();

      expect(result).toEqual(MANUFACTURERS_DATA);
    });

    it("updates cache when inner succeeds after stale", async () => {
      const freshData = { ...MANUFACTURERS_DATA, newMfr: { name: "New", fixtureCount: 1 } };
      vi.mocked(inner.getManufacturers).mockResolvedValue(freshData);
      vi.mocked(diskCache.set).mockResolvedValue();
      const client = createCachedOflClient({ inner, diskCache });

      const result = await client.getManufacturers();

      expect(result).toEqual(freshData);
      expect(diskCache.set).toHaveBeenCalledWith("manufacturers", freshData);
    });
  });

  describe("getManufacturerFixtures", () => {
    it("uses cache key with manufacturer name", async () => {
      vi.mocked(inner.getManufacturerFixtures).mockResolvedValue(MANUFACTURER_DETAIL);
      vi.mocked(diskCache.set).mockResolvedValue();
      const client = createCachedOflClient({ inner, diskCache });

      await client.getManufacturerFixtures("acme");

      expect(diskCache.set).toHaveBeenCalledWith("manufacturer:acme", MANUFACTURER_DETAIL);
    });
  });

  describe("getFixture", () => {
    it("uses cache key with manufacturer and model", async () => {
      vi.mocked(inner.getFixture).mockResolvedValue(FIXTURE_DEF);
      vi.mocked(diskCache.set).mockResolvedValue();
      const client = createCachedOflClient({ inner, diskCache });

      await client.getFixture("acme", "par64");

      expect(diskCache.set).toHaveBeenCalledWith("fixture:acme/par64", FIXTURE_DEF);
    });

    it("falls back to disk cache when inner throws", async () => {
      vi.mocked(inner.getFixture).mockRejectedValue(new Error("offline"));
      vi.mocked(diskCache.get).mockResolvedValue({
        data: FIXTURE_DEF,
        stale: false,
      });
      const client = createCachedOflClient({ inner, diskCache });

      const result = await client.getFixture("acme", "par64");

      expect(result).toEqual(FIXTURE_DEF);
      expect(diskCache.get).toHaveBeenCalledWith("fixture:acme/par64");
    });
  });

  describe("searchFixtures", () => {
    it("delegates directly to inner client without caching", () => {
      const results = [
        { mfrKey: "acme", mfrName: "ACME", fixtureKey: "par64", fixtureName: "PAR 64", categories: [] },
      ];
      vi.mocked(inner.searchFixtures).mockReturnValue(results);
      const client = createCachedOflClient({ inner, diskCache });

      const result = client.searchFixtures("par");

      expect(result).toEqual(results);
      expect(diskCache.set).not.toHaveBeenCalled();
      expect(diskCache.get).not.toHaveBeenCalled();
    });
  });

  describe("fresh install scenarios", () => {
    it("works normally with empty cache when inner succeeds", async () => {
      vi.mocked(inner.getManufacturers).mockResolvedValue(MANUFACTURERS_DATA);
      vi.mocked(diskCache.set).mockResolvedValue();
      const client = createCachedOflClient({ inner, diskCache });

      const result = await client.getManufacturers();

      expect(result).toEqual(MANUFACTURERS_DATA);
    });

    it("propagates error when cache is empty and inner fails", async () => {
      vi.mocked(inner.getManufacturers).mockRejectedValue(new Error("network down"));
      vi.mocked(diskCache.get).mockResolvedValue(undefined);
      const client = createCachedOflClient({ inner, diskCache });

      await expect(client.getManufacturers()).rejects.toThrow("network down");
    });
  });
});
