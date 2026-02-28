import { describe, it, expect } from "vitest";
import { validateFixtureAddress, validateFixtureChannels } from "./fixture-validator.js";
import type { FixtureConfig, FixtureChannel } from "../types/protocol.js";

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

describe("validateFixtureChannels", () => {
  const rgb: FixtureChannel[] = [
    { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
    { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
  ];

  it("accepts valid channels matching expected count", () => {
    const result = validateFixtureChannels(rgb, 3);
    expect(result.valid).toBe(true);
    expect(result.warnings).toBeUndefined();
  });

  it("rejects mismatched channel count", () => {
    const result = validateFixtureChannels(rgb, 5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("channelCount");
    expect(result.error).toContain("5");
    expect(result.error).toContain("3");
  });

  it("rejects defaultValue below 0", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Bad", type: "Intensity", defaultValue: -1 },
    ];
    const result = validateFixtureChannels(channels, 1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("defaultValue");
    expect(result.error).toContain("-1");
  });

  it("rejects defaultValue above 255", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Bad", type: "Intensity", defaultValue: 300 },
    ];
    const result = validateFixtureChannels(channels, 1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("defaultValue");
    expect(result.error).toContain("300");
  });

  it("warns on unknown channel type but still valid", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Mystery", type: "LaserBeam", defaultValue: 0 },
    ];
    const result = validateFixtureChannels(channels, 1);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings![0]).toContain("LaserBeam");
  });

  it("returns no warnings for all known types", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
      { offset: 1, name: "Pan", type: "Pan", defaultValue: 128 },
      { offset: 2, name: "Strobe", type: "Strobe", defaultValue: 255 },
      { offset: 3, name: "Gobo", type: "Gobo", defaultValue: 0 },
    ];
    const result = validateFixtureChannels(channels, 4);
    expect(result.valid).toBe(true);
    expect(result.warnings).toBeUndefined();
  });
});
