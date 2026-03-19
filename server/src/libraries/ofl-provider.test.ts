import { describe, it, expect } from "vitest";
import { createMockOflClient } from "../test-helpers.js";
import { createOflProvider } from "./ofl-provider.js";

describe("createOflProvider", () => {
  it('has id "ofl"', () => {
    const provider = createOflProvider(createMockOflClient());
    expect(provider.id).toBe("ofl");
  });

  it('has type "api"', () => {
    const provider = createOflProvider(createMockOflClient());
    expect(provider.type).toBe("api");
  });

  it('has displayName "Open Fixture Library"', () => {
    const provider = createOflProvider(createMockOflClient());
    expect(provider.displayName).toBe("Open Fixture Library");
  });

  it("status() returns available and connected", () => {
    const provider = createOflProvider(createMockOflClient());
    expect(provider.status()).toEqual({ available: true, state: "connected" });
  });

  it("getManufacturers() returns empty array", () => {
    const provider = createOflProvider(createMockOflClient());
    expect(provider.getManufacturers()).toEqual([]);
  });

  it("getFixtures() returns empty array", () => {
    const provider = createOflProvider(createMockOflClient());
    expect(provider.getFixtures(1)).toEqual([]);
  });

  it("getFixtureModes() returns empty array", () => {
    const provider = createOflProvider(createMockOflClient());
    expect(provider.getFixtureModes(1)).toEqual([]);
  });

  it("getModeChannels() returns empty array", () => {
    const provider = createOflProvider(createMockOflClient());
    expect(provider.getModeChannels(1)).toEqual([]);
  });

  it("searchFixtures() returns empty array regardless of query", () => {
    const provider = createOflProvider(createMockOflClient());

    expect(provider.searchFixtures("cameo")).toEqual([]);
    expect(provider.searchFixtures("anything")).toEqual([]);
    expect(provider.searchFixtures("")).toEqual([]);
  });
});
