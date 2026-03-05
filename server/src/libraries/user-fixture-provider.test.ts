import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createUserFixtureProvider } from "./user-fixture-provider.js";
import { createUserFixtureStore } from "../fixtures/user-fixture-store.js";
import type { UserFixtureStore } from "../fixtures/user-fixture-store.js";
import type { FixtureLibraryProvider } from "./types.js";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rm } from "node:fs/promises";

function addTestTemplate(
  store: UserFixtureStore,
  overrides: {
    name?: string;
    manufacturer?: string;
    category?: string;
    modes?: { name: string; channels: { offset: number; name: string; type: string; color?: string; defaultValue: number }[] }[];
  } = {},
) {
  return store.add({
    name: overrides.name ?? "Test PAR",
    manufacturer: overrides.manufacturer ?? "DIY",
    category: overrides.category ?? "Color Changer",
    modes: overrides.modes ?? [
      {
        name: "3ch",
        channels: [
          { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
          { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
          { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
        ],
      },
    ],
  });
}

describe("createUserFixtureProvider", () => {
  let store: UserFixtureStore;
  let provider: FixtureLibraryProvider;
  let filePath: string;

  beforeEach(() => {
    filePath = join(tmpdir(), `dmxr-ufp-test-${Date.now()}.json`);
    store = createUserFixtureStore(filePath);
    provider = createUserFixtureProvider(store);
  });

  afterEach(async () => {
    store.dispose();
    try {
      await rm(filePath);
    } catch {
      // ignore
    }
  });

  it('has id "custom" and displayName "My Fixtures"', () => {
    expect(provider.id).toBe("custom");
    expect(provider.displayName).toBe("My Fixtures");
  });

  it("status is always available", () => {
    const status = provider.status();
    expect(status.available).toBe(true);
    expect(status.fixtureCount).toBe(0);
  });

  describe("getManufacturers", () => {
    it("returns empty array when no templates", () => {
      expect(provider.getManufacturers()).toEqual([]);
    });

    it("returns deduplicated manufacturers", () => {
      addTestTemplate(store, { name: "PAR 1", manufacturer: "DIY" });
      addTestTemplate(store, { name: "PAR 2", manufacturer: "DIY" });
      addTestTemplate(store, { name: "Spot", manufacturer: "Acme" });

      const mfrs = provider.getManufacturers();
      expect(mfrs).toHaveLength(2);

      const diy = mfrs.find((m) => m.name === "DIY");
      expect(diy).toBeDefined();
      expect(diy!.fixtureCount).toBe(2);

      const acme = mfrs.find((m) => m.name === "Acme");
      expect(acme).toBeDefined();
      expect(acme!.fixtureCount).toBe(1);
    });
  });

  describe("getFixtures", () => {
    it("returns fixtures filtered by manufacturer", () => {
      addTestTemplate(store, { name: "PAR 1", manufacturer: "DIY" });
      addTestTemplate(store, { name: "Spot", manufacturer: "Acme" });

      const mfrs = provider.getManufacturers();
      const diyId = mfrs.find((m) => m.name === "DIY")!.id;

      const fixtures = provider.getFixtures(diyId);
      expect(fixtures).toHaveLength(1);
      expect(fixtures[0].name).toBe("PAR 1");
    });

    it("returns empty for unknown manufacturer id", () => {
      expect(provider.getFixtures(999)).toEqual([]);
    });
  });

  describe("getFixtureModes", () => {
    it("returns modes for a fixture", () => {
      addTestTemplate(store, {
        name: "Multi-Mode",
        modes: [
          { name: "3ch", channels: [{ offset: 0, name: "R", type: "ColorIntensity", color: "Red", defaultValue: 0 }] },
          { name: "7ch", channels: [{ offset: 0, name: "R", type: "ColorIntensity", color: "Red", defaultValue: 0 }] },
        ],
      });

      const mfrs = provider.getManufacturers();
      const fixtures = provider.getFixtures(mfrs[0].id);
      const modes = provider.getFixtureModes(fixtures[0].id);

      expect(modes).toHaveLength(2);
      expect(modes[0].name).toBe("3ch");
      expect(modes[1].name).toBe("7ch");
    });

    it("returns empty for unknown fixture id", () => {
      expect(provider.getFixtureModes(999)).toEqual([]);
    });
  });

  describe("getModeChannels", () => {
    it("returns channels for a mode", () => {
      addTestTemplate(store);

      const mfrs = provider.getManufacturers();
      const fixtures = provider.getFixtures(mfrs[0].id);
      const modes = provider.getFixtureModes(fixtures[0].id);
      const channels = provider.getModeChannels(modes[0].id);

      expect(channels).toHaveLength(3);
      expect(channels[0].name).toBe("Red");
      expect(channels[1].name).toBe("Green");
      expect(channels[2].name).toBe("Blue");
    });

    it("returns empty for unknown mode id", () => {
      expect(provider.getModeChannels(999)).toEqual([]);
    });
  });

  describe("searchFixtures", () => {
    it("matches by name", () => {
      addTestTemplate(store, { name: "SuperBeam 5000" });

      const results = provider.searchFixtures("superbeam");
      expect(results).toHaveLength(1);
      expect(results[0].fixtureName).toBe("SuperBeam 5000");
    });

    it("matches by manufacturer", () => {
      addTestTemplate(store, { manufacturer: "Acme Lighting" });

      const results = provider.searchFixtures("acme");
      expect(results).toHaveLength(1);
      expect(results[0].mfrName).toBe("Acme Lighting");
    });

    it("returns empty for no match", () => {
      addTestTemplate(store);
      expect(provider.searchFixtures("zzzzz")).toEqual([]);
    });

    it("returns empty for short tokens", () => {
      addTestTemplate(store);
      expect(provider.searchFixtures("a")).toEqual([]);
    });

    it("respects limit", () => {
      addTestTemplate(store, { name: "PAR 1" });
      addTestTemplate(store, { name: "PAR 2" });
      addTestTemplate(store, { name: "PAR 3" });

      const results = provider.searchFixtures("PAR", 2);
      expect(results).toHaveLength(2);
    });
  });
});
