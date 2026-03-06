import { describe, it, expect } from "vitest";
import { computeOverrideChannels } from "./fixture-override-service.js";
import type { FixtureConfig, FixtureChannel } from "../types/protocol.js";

function makeFixture(
  channels: FixtureChannel[],
  startAddress = 1,
  extra: Partial<FixtureConfig> = {},
): FixtureConfig {
  return {
    id: "test-fixture-id",
    name: "Test",
    mode: "test",
    dmxStartAddress: startAddress,
    channelCount: channels.length,
    channels,
    ...extra,
  };
}

describe("computeOverrideChannels", () => {
  it("applies enabled override value", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const { channels } = computeOverrideChannels(fixture, {
      "0": { value: 200, enabled: true },
    });

    expect(channels[1]).toBe(200);
  });

  it("reverts to defaultValue when override disabled (non-motor)", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 42 },
    ]);

    const { channels } = computeOverrideChannels(fixture, {
      "0": { value: 200, enabled: false },
    });

    expect(channels[1]).toBe(42);
  });

  it("clamps motor channel override to safe range", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
    ]);

    const { channels } = computeOverrideChannels(fixture, {
      "0": { value: 0, enabled: true },
    });

    expect(channels[1]).toBe(2); // motor guard: 0 → 2
  });

  it("motor channel disabled reverts to safe center", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 0 },
    ]);

    const { channels } = computeOverrideChannels(fixture, {
      "0": { value: 200, enabled: false },
    });

    expect(channels[1]).toBe(128); // defaultValue 0 → safe center 128
  });

  it("motor fine channel disabled uses defaultValue directly", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan Fine", type: "Pan", defaultValue: 0 },
    ]);

    const { channels } = computeOverrideChannels(fixture, {
      "0": { value: 200, enabled: false },
    });

    expect(channels[1]).toBe(2); // fine: defaultValue 0 clamped by motor guard
  });

  it("motor guard disabled allows full range", () => {
    const fixture = makeFixture(
      [{ offset: 0, name: "Pan", type: "Pan", defaultValue: 128 }],
      1,
      { motorGuardEnabled: false },
    );

    const { channels } = computeOverrideChannels(fixture, {
      "0": { value: 0, enabled: true },
    });

    expect(channels[1]).toBe(0);
  });

  it("respects custom motor guard buffer", () => {
    const fixture = makeFixture(
      [{ offset: 0, name: "Tilt", type: "Tilt", defaultValue: 128 }],
      1,
      { motorGuardBuffer: 10 },
    );

    const { channels } = computeOverrideChannels(fixture, {
      "0": { value: 0, enabled: true },
    });

    expect(channels[1]).toBe(5); // buffer 10 → min 5
  });

  it("skips offsets with no matching channel", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const { channels, logLines } = computeOverrideChannels(fixture, {
      "5": { value: 100, enabled: true },
    });

    expect(Object.keys(channels)).toHaveLength(0);
    expect(logLines.some((l) => l.includes("SKIP"))).toBe(true);
  });

  it("handles multiple overrides", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
    ]);

    const { channels } = computeOverrideChannels(fixture, {
      "0": { value: 100, enabled: true },
      "1": { value: 200, enabled: true },
    });

    expect(channels[1]).toBe(100);
    expect(channels[2]).toBe(200);
  });

  it("uses correct absolute DMX addresses", () => {
    const fixture = makeFixture(
      [{ offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 }],
      40,
    );

    const { channels } = computeOverrideChannels(fixture, {
      "0": { value: 255, enabled: true },
    });

    expect(channels[40]).toBe(255);
  });

  it("clamps non-motor override value to 0-255", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const { channels } = computeOverrideChannels(fixture, {
      "0": { value: 300, enabled: true },
    });

    expect(channels[1]).toBe(255);
  });

  it("protects all 7 motor types", () => {
    const types = ["Pan", "Tilt", "Focus", "Zoom", "Gobo", "Iris", "Prism"];
    for (const type of types) {
      const fixture = makeFixture([
        { offset: 0, name: type, type, defaultValue: 128 },
      ]);

      const { channels } = computeOverrideChannels(fixture, {
        "0": { value: 255, enabled: true },
      });

      expect(channels[1]).toBe(253); // motor guard clamps 255 → 253
    }
  });
});
