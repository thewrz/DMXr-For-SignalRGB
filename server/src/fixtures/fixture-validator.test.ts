import { describe, it, expect } from "vitest";
import { validateFixtureAddress, validateFixtureChannels, findNextAvailableAddress } from "./fixture-validator.js";
import type { FixtureConfig, FixtureChannel } from "../types/protocol.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";

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

  describe("per-universe scoping", () => {
    it("only checks overlap within the same universeId", () => {
      const existing = [
        makeFixture({ id: "a", dmxStartAddress: 1, channelCount: 5, universeId: "uni-1" }),
      ];
      // Same address range but on a different universe → no overlap
      const result = validateFixtureAddress(1, 5, existing, undefined, "uni-2");
      expect(result.valid).toBe(true);
    });

    it("detects overlap within the same universe", () => {
      const existing = [
        makeFixture({ id: "a", dmxStartAddress: 1, channelCount: 5, universeId: "uni-1" }),
      ];
      const result = validateFixtureAddress(3, 3, existing, undefined, "uni-1");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Overlaps");
    });

    it("allows same address on different universes", () => {
      const existing = [
        makeFixture({ id: "a", dmxStartAddress: 1, channelCount: 7, universeId: "uni-1" }),
        makeFixture({ id: "b", dmxStartAddress: 1, channelCount: 7, universeId: "uni-2" }),
      ];
      // Adding to uni-3 at same address → valid
      const result = validateFixtureAddress(1, 7, existing, undefined, "uni-3");
      expect(result.valid).toBe(true);
    });

    it("defaults to DEFAULT_UNIVERSE_ID when universeId omitted", () => {
      const existing = [
        makeFixture({ id: "a", dmxStartAddress: 1, channelCount: 5 }),
      ];
      // No universeId → checks against default universe (where fixture without universeId lives)
      const result = validateFixtureAddress(3, 3, existing);
      expect(result.valid).toBe(false);
    });

    it("fixtures without universeId treated as default universe", () => {
      const existing = [
        makeFixture({ id: "a", dmxStartAddress: 1, channelCount: 5 }), // no universeId
      ];
      // Explicitly specifying default universe → should overlap
      const result = validateFixtureAddress(3, 3, existing, undefined, DEFAULT_UNIVERSE_ID);
      expect(result.valid).toBe(false);
    });
  });
});

describe("findNextAvailableAddress", () => {
  it("returns 1 when no fixtures exist", () => {
    expect(findNextAvailableAddress(3, [])).toBe(1);
  });

  it("returns address after existing fixture", () => {
    const existing = [makeFixture({ dmxStartAddress: 1, channelCount: 5 })];
    expect(findNextAvailableAddress(3, existing)).toBe(6);
  });

  it("finds gap between fixtures", () => {
    const existing = [
      makeFixture({ id: "a", dmxStartAddress: 1, channelCount: 3 }),
      makeFixture({ id: "b", dmxStartAddress: 10, channelCount: 3 }),
    ];
    // Gap at 4-9 (6 channels), 3ch fixture fits at 4
    expect(findNextAvailableAddress(3, existing)).toBe(4);
  });

  it("skips gap too small and finds next one", () => {
    const existing = [
      makeFixture({ id: "a", dmxStartAddress: 1, channelCount: 3 }),
      makeFixture({ id: "b", dmxStartAddress: 5, channelCount: 3 }),
      makeFixture({ id: "c", dmxStartAddress: 20, channelCount: 3 }),
    ];
    // Gap at 4 (1 channel) too small for 3ch, gap at 8-19 (12 channels) fits
    expect(findNextAvailableAddress(3, existing)).toBe(8);
  });

  it("returns undefined when no space available", () => {
    const existing = [makeFixture({ dmxStartAddress: 1, channelCount: 512 })];
    expect(findNextAvailableAddress(1, existing)).toBeUndefined();
  });

  it("respects afterAddress parameter", () => {
    const existing = [
      makeFixture({ id: "a", dmxStartAddress: 1, channelCount: 3 }),
    ];
    // afterAddress=10 skips the gap at 4
    expect(findNextAvailableAddress(3, existing, undefined, 10)).toBe(10);
  });

  it("scopes to universe", () => {
    const existing = [
      makeFixture({ id: "a", dmxStartAddress: 1, channelCount: 5, universeId: "uni-1" }),
    ];
    // Different universe → address 1 is free
    expect(findNextAvailableAddress(3, existing, "uni-2")).toBe(1);
  });

  it("handles unsorted fixtures", () => {
    const existing = [
      makeFixture({ id: "b", dmxStartAddress: 10, channelCount: 3 }),
      makeFixture({ id: "a", dmxStartAddress: 1, channelCount: 3 }),
    ];
    expect(findNextAvailableAddress(3, existing)).toBe(4);
  });

  it("returns undefined when remaining space at end is too small", () => {
    const existing = [makeFixture({ dmxStartAddress: 1, channelCount: 510 })];
    // Only 2 channels left (511-512), need 3
    expect(findNextAvailableAddress(3, existing)).toBeUndefined();
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

  it("warns when rangeMin is outside 0-255", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 128, rangeMin: -1 },
    ];
    const result = validateFixtureChannels(channels, 1);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings![0]).toContain("rangeMin");
    expect(result.warnings![0]).toContain("-1");
  });

  it("warns when rangeMax is outside 0-255", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 128, rangeMax: 65535 },
    ];
    const result = validateFixtureChannels(channels, 1);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings![0]).toContain("rangeMax");
    expect(result.warnings![0]).toContain("65535");
  });

  it("does not warn for valid rangeMin/rangeMax within 0-255", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0, rangeMin: 0, rangeMax: 255 },
    ];
    const result = validateFixtureChannels(channels, 1);
    expect(result.valid).toBe(true);
    expect(result.warnings).toBeUndefined();
  });
});
