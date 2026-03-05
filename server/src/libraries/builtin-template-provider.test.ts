import { describe, it, expect } from "vitest";
import { createBuiltinTemplateProvider } from "./builtin-template-provider.js";
import type { FixtureLibraryProvider } from "./types.js";

describe("createBuiltinTemplateProvider", () => {
  let provider: FixtureLibraryProvider;

  // Fresh provider for each test to avoid cross-test coupling
  function freshProvider() {
    return createBuiltinTemplateProvider();
  }

  it('has id "builtin" and correct metadata', () => {
    provider = freshProvider();
    expect(provider.id).toBe("builtin");
    expect(provider.displayName).toBe("Built-in Templates");
    expect(provider.type).toBe("local-db");
  });

  it("status reports available with fixture count", () => {
    provider = freshProvider();
    const status = provider.status();
    expect(status.available).toBe(true);
    expect(status.state).toBe("ready");
    expect(status.fixtureCount).toBe(9);
  });

  describe("getManufacturers", () => {
    it('returns single "Generic" manufacturer', () => {
      provider = freshProvider();
      const mfrs = provider.getManufacturers();
      expect(mfrs).toHaveLength(1);
      expect(mfrs[0].name).toBe("Generic");
      expect(mfrs[0].fixtureCount).toBe(9);
    });
  });

  describe("getFixtures", () => {
    it("returns all 9 templates for the Generic manufacturer", () => {
      provider = freshProvider();
      const mfrs = provider.getManufacturers();
      const fixtures = provider.getFixtures(mfrs[0].id);
      expect(fixtures).toHaveLength(9);
      for (const f of fixtures) {
        expect(f.name.length).toBeGreaterThan(0);
        expect(f.modeCount).toBeGreaterThanOrEqual(1);
      }
    });

    it("returns empty for unknown manufacturer id", () => {
      provider = freshProvider();
      expect(provider.getFixtures(999)).toEqual([]);
    });
  });

  describe("getFixtureModes", () => {
    it("returns modes for a fixture", () => {
      provider = freshProvider();
      const mfrs = provider.getManufacturers();
      const fixtures = provider.getFixtures(mfrs[0].id);
      const modes = provider.getFixtureModes(fixtures[0].id);
      expect(modes.length).toBeGreaterThanOrEqual(1);
      expect(modes[0].channelCount).toBeGreaterThan(0);
    });

    it("returns multiple modes for UV Blacklight", () => {
      provider = freshProvider();
      const mfrs = provider.getManufacturers();
      const fixtures = provider.getFixtures(mfrs[0].id);
      const uvFixture = fixtures.find((f) => f.name.includes("UV"));
      expect(uvFixture).toBeDefined();
      const modes = provider.getFixtureModes(uvFixture!.id);
      expect(modes.length).toBeGreaterThanOrEqual(2);
    });

    it("returns empty for unknown fixture id", () => {
      provider = freshProvider();
      expect(provider.getFixtureModes(999)).toEqual([]);
    });
  });

  describe("getModeChannels", () => {
    it("returns channels for a mode", () => {
      provider = freshProvider();
      const mfrs = provider.getManufacturers();
      const fixtures = provider.getFixtures(mfrs[0].id);
      const modes = provider.getFixtureModes(fixtures[0].id);
      const channels = provider.getModeChannels(modes[0].id);
      expect(channels.length).toBeGreaterThan(0);
      expect(channels[0]).toHaveProperty("offset");
      expect(channels[0]).toHaveProperty("name");
      expect(channels[0]).toHaveProperty("type");
    });

    it("returns empty for unknown mode id", () => {
      provider = freshProvider();
      expect(provider.getModeChannels(999)).toEqual([]);
    });
  });

  describe("searchFixtures", () => {
    it("matches by name (case-insensitive)", () => {
      provider = freshProvider();
      const results = provider.searchFixtures("rgb");
      expect(results.length).toBeGreaterThanOrEqual(1);
      for (const r of results) {
        expect(r.fixtureName.toLowerCase()).toContain("rgb");
      }
    });

    it('matches by manufacturer "generic"', () => {
      provider = freshProvider();
      const results = provider.searchFixtures("generic");
      expect(results.length).toBe(9);
    });

    it("matches dimmer template", () => {
      provider = freshProvider();
      const results = provider.searchFixtures("dimmer single");
      expect(results).toHaveLength(1);
      expect(results[0].fixtureName).toContain("Dimmer");
    });

    it("matches UV blacklight", () => {
      provider = freshProvider();
      const results = provider.searchFixtures("blacklight");
      expect(results).toHaveLength(1);
      expect(results[0].fixtureName).toContain("UV");
    });

    it("returns empty for no match", () => {
      provider = freshProvider();
      expect(provider.searchFixtures("zzzzz")).toEqual([]);
    });

    it("returns empty for short tokens", () => {
      provider = freshProvider();
      expect(provider.searchFixtures("a")).toEqual([]);
    });

    it("respects limit", () => {
      provider = freshProvider();
      const results = provider.searchFixtures("generic", 3);
      expect(results).toHaveLength(3);
    });
  });

  describe("getFixtureCategory", () => {
    it("returns category for valid fixture", () => {
      provider = freshProvider();
      const mfrs = provider.getManufacturers();
      const fixtures = provider.getFixtures(mfrs[0].id);
      const category = provider.getFixtureCategory?.(fixtures[0].id);
      expect(category).toBeDefined();
      expect(typeof category).toBe("string");
    });

    it("returns null for unknown fixture", () => {
      provider = freshProvider();
      const category = provider.getFixtureCategory?.(999);
      expect(category).toBeNull();
    });
  });
});
