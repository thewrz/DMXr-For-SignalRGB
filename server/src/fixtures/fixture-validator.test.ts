import { describe, it, expect } from "vitest";
import { validateFixtureAddress } from "./fixture-validator.js";
import type { FixtureConfig } from "../types/protocol.js";

function makeFixture(overrides: Partial<FixtureConfig> = {}): FixtureConfig {
  return {
    id: "fixture-1",
    name: "Test",
    oflKey: "generic/rgb",
    oflFixtureName: "RGB",
    mode: "3-channel",
    dmxStartAddress: 1,
    channelCount: 3,
    channels: [],
    ...overrides,
  };
}

describe("validateFixtureAddress", () => {
  it("accepts valid address with no existing fixtures", () => {
    const result = validateFixtureAddress(1, 3, []);
    expect(result.valid).toBe(true);
  });

  it("accepts address at end of universe", () => {
    const result = validateFixtureAddress(510, 3, []);
    expect(result.valid).toBe(true);
  });

  it("accepts single channel at 512", () => {
    const result = validateFixtureAddress(512, 1, []);
    expect(result.valid).toBe(true);
  });

  it("rejects address below 1", () => {
    const result = validateFixtureAddress(0, 3, []);
    expect(result.valid).toBe(false);
    expect(result.error).toContain(">= 1");
  });

  it("rejects negative address", () => {
    const result = validateFixtureAddress(-5, 3, []);
    expect(result.valid).toBe(false);
  });

  it("rejects non-integer address", () => {
    const result = validateFixtureAddress(1.5, 3, []);
    expect(result.valid).toBe(false);
  });

  it("rejects fixture extending beyond 512", () => {
    const result = validateFixtureAddress(511, 3, []);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("beyond");
  });

  it("rejects channel count below 1", () => {
    const result = validateFixtureAddress(1, 0, []);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Channel count");
  });

  it("detects overlap with existing fixture", () => {
    const existing = [makeFixture({ dmxStartAddress: 1, channelCount: 5 })];
    const result = validateFixtureAddress(3, 3, existing);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Overlaps");
  });

  it("detects overlap from behind", () => {
    const existing = [makeFixture({ dmxStartAddress: 5, channelCount: 3 })];
    const result = validateFixtureAddress(3, 4, existing);
    expect(result.valid).toBe(false);
  });

  it("allows adjacent fixtures without overlap", () => {
    const existing = [makeFixture({ dmxStartAddress: 1, channelCount: 5 })];
    const result = validateFixtureAddress(6, 3, existing);
    expect(result.valid).toBe(true);
  });

  it("allows non-overlapping fixtures", () => {
    const existing = [makeFixture({ dmxStartAddress: 10, channelCount: 5 })];
    const result = validateFixtureAddress(1, 5, existing);
    expect(result.valid).toBe(true);
  });

  it("excludes fixture by id when checking overlap", () => {
    const existing = [makeFixture({ id: "self", dmxStartAddress: 1, channelCount: 5 })];
    const result = validateFixtureAddress(1, 5, existing, "self");
    expect(result.valid).toBe(true);
  });

  it("includes error with fixture name on overlap", () => {
    const existing = [makeFixture({ name: "Stage Left", dmxStartAddress: 1, channelCount: 3 })];
    const result = validateFixtureAddress(2, 3, existing);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Stage Left");
  });
});
