import { describe, it, expect, vi } from "vitest";
import { createOflClient } from "./ofl-client.js";

function mockFetch(responses: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const data = responses[url];

    if (data === undefined) {
      return { ok: false, status: 404, statusText: "Not Found" } as Response;
    }

    return {
      ok: true,
      status: 200,
      json: async () => data,
    } as Response;
  });
}

describe("createOflClient", () => {
  const baseUrl = "https://ofl.test";

  describe("getManufacturers", () => {
    it("fetches and returns manufacturers", async () => {
      const fetchFn = mockFetch({
        [`${baseUrl}/api/v1/manufacturers`]: {
          cameo: { name: "Cameo", fixtureCount: 42 },
        },
      });
      const client = createOflClient({ baseUrl, fetchFn });

      const result = await client.getManufacturers();

      expect(result).toEqual({ cameo: { name: "Cameo", fixtureCount: 42 } });
      expect(fetchFn).toHaveBeenCalledOnce();
    });

    it("caches responses", async () => {
      const fetchFn = mockFetch({
        [`${baseUrl}/api/v1/manufacturers`]: {
          cameo: { name: "Cameo", fixtureCount: 42 },
        },
      });
      const client = createOflClient({ baseUrl, fetchFn });

      await client.getManufacturers();
      await client.getManufacturers();

      expect(fetchFn).toHaveBeenCalledOnce();
    });

    it("refetches after TTL expires", async () => {
      const fetchFn = mockFetch({
        [`${baseUrl}/api/v1/manufacturers`]: {
          cameo: { name: "Cameo", fixtureCount: 42 },
        },
      });
      const client = createOflClient({ baseUrl, fetchFn, ttlMs: 0 });

      await client.getManufacturers();
      await client.getManufacturers();

      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("getManufacturerFixtures", () => {
    it("fetches manufacturer detail and returns fixtures (array format)", async () => {
      const fetchFn = mockFetch({
        [`${baseUrl}/api/v1/manufacturers`]: {
          cameo: { name: "Cameo", fixtureCount: 1 },
        },
        [`${baseUrl}/api/v1/manufacturers/cameo`]: {
          fixtures: [
            { key: "flat-pro-18", name: "Flat Pro 18", categories: ["Color Changer"] },
          ],
        },
      });
      const client = createOflClient({ baseUrl, fetchFn });

      const result = await client.getManufacturerFixtures("cameo");

      expect(result.name).toBe("Cameo");
      expect(result.fixtures).toHaveLength(1);
      expect(result.fixtures[0].key).toBe("flat-pro-18");
      expect(result.fixtures[0].name).toBe("Flat Pro 18");
    });

    it("throws for unknown manufacturer", async () => {
      const fetchFn = mockFetch({
        [`${baseUrl}/api/v1/manufacturers`]: {
          cameo: { name: "Cameo", fixtureCount: 1 },
        },
      });
      const client = createOflClient({ baseUrl, fetchFn });

      await expect(
        client.getManufacturerFixtures("nonexistent"),
      ).rejects.toThrow("Manufacturer not found");
    });
  });

  describe("getFixture", () => {
    it("fetches fixture definition", async () => {
      const fetchFn = mockFetch({
        [`${baseUrl}/cameo/flat-pro-18.json`]: {
          name: "Flat Pro 18",
          categories: ["Color Changer"],
          availableChannels: {
            Red: { type: "ColorIntensity", color: "Red" },
          },
          modes: [{ name: "3-channel", channels: ["Red", "Green", "Blue"] }],
        },
      });
      const client = createOflClient({ baseUrl, fetchFn });

      const result = await client.getFixture("cameo", "flat-pro-18");

      expect(result.name).toBe("Flat Pro 18");
      expect(result.modes).toHaveLength(1);
      expect(result.modes[0].channels).toHaveLength(3);
    });

    it("throws on API error", async () => {
      const fetchFn = mockFetch({});
      const client = createOflClient({ baseUrl, fetchFn });

      await expect(
        client.getFixture("nonexistent", "fixture"),
      ).rejects.toThrow("OFL API error");
    });
  });
});
