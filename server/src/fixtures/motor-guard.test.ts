import { describe, it, expect } from "vitest";
import {
  MOTOR_CHANNEL_TYPES,
  DEFAULT_MOTOR_GUARD_BUFFER,
  SAFE_CENTER_POSITION,
  clampMotor,
  isMotorChannel,
  computeSafePositions,
} from "./motor-guard.js";
import type { FixtureConfig, FixtureChannel } from "../types/protocol.js";

function makeFixture(
  channels: FixtureChannel[],
  startAddress = 1,
  overrides?: Record<number, { value: number; enabled: boolean }>,
): FixtureConfig {
  return {
    id: "test-fixture",
    name: "Test",
    mode: "test",
    dmxStartAddress: startAddress,
    channelCount: channels.length,
    channels,
    ...(overrides ? { channelOverrides: overrides } : {}),
  };
}

describe("MOTOR_CHANNEL_TYPES", () => {
  it("contains all 7 motor types", () => {
    expect(MOTOR_CHANNEL_TYPES.size).toBe(7);
    for (const type of ["Pan", "Tilt", "Focus", "Zoom", "Gobo", "Iris", "Prism"]) {
      expect(MOTOR_CHANNEL_TYPES.has(type)).toBe(true);
    }
  });

  it("does not contain non-motor types", () => {
    expect(MOTOR_CHANNEL_TYPES.has("ColorIntensity")).toBe(false);
    expect(MOTOR_CHANNEL_TYPES.has("Intensity")).toBe(false);
    expect(MOTOR_CHANNEL_TYPES.has("Strobe")).toBe(false);
  });
});

describe("DEFAULT_MOTOR_GUARD_BUFFER", () => {
  it("is 4", () => {
    expect(DEFAULT_MOTOR_GUARD_BUFFER).toBe(4);
  });
});

describe("SAFE_CENTER_POSITION", () => {
  it("is 128", () => {
    expect(SAFE_CENTER_POSITION).toBe(128);
  });
});

describe("clampMotor", () => {
  it("clamps 0 → 2 with default buffer", () => {
    expect(clampMotor(0)).toBe(2);
  });

  it("clamps 255 → 253 with default buffer", () => {
    expect(clampMotor(255)).toBe(253);
  });

  it("passes through midrange values", () => {
    expect(clampMotor(128)).toBe(128);
  });

  it("respects custom buffer", () => {
    expect(clampMotor(0, 10)).toBe(5);
    expect(clampMotor(255, 10)).toBe(250);
  });

  it("rounds fractional values", () => {
    expect(clampMotor(2.7)).toBe(3);
  });
});

describe("isMotorChannel", () => {
  it("returns true for motor types when enabled", () => {
    expect(isMotorChannel("Pan")).toBe(true);
    expect(isMotorChannel("Gobo")).toBe(true);
    expect(isMotorChannel("Prism")).toBe(true);
  });

  it("returns true when motorGuardEnabled is undefined (default true)", () => {
    expect(isMotorChannel("Pan", undefined)).toBe(true);
  });

  it("returns false when motorGuardEnabled is false", () => {
    expect(isMotorChannel("Pan", false)).toBe(false);
  });

  it("returns false for non-motor types", () => {
    expect(isMotorChannel("ColorIntensity")).toBe(false);
    expect(isMotorChannel("Intensity")).toBe(false);
  });
});

describe("computeSafePositions", () => {
  it("returns center (128) for motor channels with defaultValue 0", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 0 },
      { offset: 1, name: "Tilt", type: "Tilt", defaultValue: 0 },
    ]);

    const result = computeSafePositions([fixture]);

    expect(result[1]).toBe(128);
    expect(result[2]).toBe(128);
  });

  it("uses defaultValue when > 0", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 64 },
    ]);

    const result = computeSafePositions([fixture]);

    expect(result[1]).toBe(64);
  });

  it("uses override value when enabled", () => {
    const fixture = makeFixture(
      [{ offset: 0, name: "Pan", type: "Pan", defaultValue: 128 }],
      1,
      { 0: { value: 200, enabled: true } },
    );

    const result = computeSafePositions([fixture]);

    expect(result[1]).toBe(200);
  });

  it("ignores override when disabled", () => {
    const fixture = makeFixture(
      [{ offset: 0, name: "Pan", type: "Pan", defaultValue: 64 }],
      1,
      { 0: { value: 200, enabled: false } },
    );

    const result = computeSafePositions([fixture]);

    expect(result[1]).toBe(64);
  });

  it("skips non-motor channels", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", defaultValue: 0 },
      { offset: 1, name: "Pan", type: "Pan", defaultValue: 128 },
    ]);

    const result = computeSafePositions([fixture]);

    expect(result[1]).toBeUndefined();
    expect(result[2]).toBe(128);
  });

  it("includes all 7 motor types", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
      { offset: 1, name: "Tilt", type: "Tilt", defaultValue: 128 },
      { offset: 2, name: "Focus", type: "Focus", defaultValue: 128 },
      { offset: 3, name: "Zoom", type: "Zoom", defaultValue: 128 },
      { offset: 4, name: "Gobo", type: "Gobo", defaultValue: 10 },
      { offset: 5, name: "Iris", type: "Iris", defaultValue: 128 },
      { offset: 6, name: "Prism", type: "Prism", defaultValue: 0 },
    ];
    const fixture = makeFixture(channels);

    const result = computeSafePositions([fixture]);

    expect(Object.keys(result)).toHaveLength(7);
    expect(result[7]).toBe(128); // Prism defaultValue 0 → 128
  });

  it("handles multiple fixtures with correct addresses", () => {
    const fixture1 = makeFixture(
      [{ offset: 0, name: "Pan", type: "Pan", defaultValue: 64 }],
      1,
    );
    const fixture2 = makeFixture(
      [{ offset: 0, name: "Pan", type: "Pan", defaultValue: 100 }],
      40,
    );

    const result = computeSafePositions([fixture1, fixture2]);

    expect(result[1]).toBe(64);
    expect(result[40]).toBe(100);
  });

  it("returns empty for fixtures with no motor channels", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", defaultValue: 0 },
    ]);

    const result = computeSafePositions([fixture]);

    expect(Object.keys(result)).toHaveLength(0);
  });
});
