import { describe, it, expect } from "vitest";
import { mapColor, isWhiteGateOpen, DEFAULT_WHITE_GATE_THRESHOLD, getFixtureDefaults } from "./channel-mapper.js";
import type { FixtureConfig, FixtureChannel, ChannelOverride } from "../types/protocol.js";

interface MutableFixture extends Omit<FixtureConfig, "channelOverrides" | "whiteGateThreshold" | "motorGuardEnabled" | "motorGuardBuffer"> {
  channelOverrides?: Record<number, ChannelOverride>;
  whiteGateThreshold?: number;
  motorGuardEnabled?: boolean;
  motorGuardBuffer?: number;
}

function makeFixture(
  channels: FixtureChannel[],
  startAddress = 1,
): MutableFixture {
  return {
    id: "test-fixture",
    name: "Test",
    oflKey: "test/test",
    oflFixtureName: "Test",
    mode: "test",
    dmxStartAddress: startAddress,
    channelCount: channels.length,
    channels,
  };
}

describe("mapColor", () => {
  it("maps RGB to 3-channel fixture", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 128, 64, 1.0);

    expect(result[1]).toBe(255);
    expect(result[2]).toBe(128);
    expect(result[3]).toBe(64);
  });

  it("scales RGB by brightness when no dimmer channel", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 200, 100, 50, 0.5);

    expect(result[1]).toBe(100);
    expect(result[2]).toBe(50);
    expect(result[3]).toBe(25);
  });

  it("uses dimmer channel for brightness when available", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 2, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 3, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 128, 64, 0.5);

    expect(result[1]).toBe(128); // dimmer = 0.5 * 255
    expect(result[2]).toBe(255); // RGB not scaled
    expect(result[3]).toBe(128);
    expect(result[4]).toBe(64);
  });

  it("extracts white when white channel exists", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
      { offset: 3, name: "White", type: "ColorIntensity", color: "White", defaultValue: 0 },
    ]);

    // Pure white → all extracted to white channel
    const result = mapColor(fixture, 100, 100, 100, 1.0);

    expect(result[1]).toBe(0);   // Red - white
    expect(result[2]).toBe(0);   // Green - white
    expect(result[3]).toBe(0);   // Blue - white
    expect(result[4]).toBe(100); // White
  });

  it("partially extracts white", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
      { offset: 3, name: "White", type: "ColorIntensity", color: "White", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 128, 64, 1.0);

    expect(result[4]).toBe(64);        // White = min(255, 128, 64)
    expect(result[1]).toBe(255 - 64);  // R - white
    expect(result[2]).toBe(128 - 64);  // G - white
    expect(result[3]).toBe(0);         // B - white
  });

  it("sets strobe to 255 (shutter open) when fixture has NO dimmer", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Strobe", type: "ShutterStrobe", defaultValue: 0 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 2, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 3, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 128, 64, 1.0);

    expect(result[1]).toBe(255); // no dimmer → shutter must open for light
  });

  it("sets strobe to 0 (no strobe effect) when fixture HAS dimmer", () => {
    // PAR can: dimmer controls brightness, strobe is just an effect
    const fixture = makeFixture([
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 2, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 3, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
      { offset: 4, name: "Strobe", type: "Strobe", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 128, 64, 1.0);

    expect(result[5]).toBe(0); // has dimmer → strobe is effect only, 0 = no strobe
  });

  it("sets ShutterStrobe to 0 when fixture HAS dimmer", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
      { offset: 1, name: "Shutter", type: "ShutterStrobe", defaultValue: 0 },
      { offset: 2, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[2]).toBe(0); // has dimmer → no strobe
  });

  it("includes generic channels with their defaultValue in color output", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan/Tilt Speed", type: "Generic", defaultValue: 128 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 2, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 3, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 128, 64, 1.0);

    expect(result[1]).toBe(128); // generic gets defaultValue
    expect(result[2]).toBe(255);
  });

  it("uses correct absolute DMX addresses", () => {
    const fixture = makeFixture(
      [
        { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
        { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
        { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
      ],
      10,
    );

    const result = mapColor(fixture, 255, 128, 64, 1.0);

    expect(result[10]).toBe(255);
    expect(result[11]).toBe(128);
    expect(result[12]).toBe(64);
  });

  it("clamps output values to 0-255", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 300, 0, 0, 1.0);

    expect(result[1]).toBe(255);
  });

  it("handles zero brightness", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 255, 255, 0);

    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
    expect(result[3]).toBe(0);
  });

  it("uses strobe defaultValue when > 0 (no dimmer fixture)", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Strobe", type: "Strobe", defaultValue: 32 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(32); // no dimmer, explicit defaultValue honored
  });

  it("falls back to 255 for strobe when defaultValue is 0 (no dimmer fixture)", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Strobe", type: "ShutterStrobe", defaultValue: 0 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(255); // no dimmer, defaultValue=0 → open shutter (255)
  });

  it("includes Pan with defaultValue in color output", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(128); // pan center
    expect(result[2]).toBe(255); // red still mapped
  });

  it("includes Tilt with defaultValue in color output", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Tilt", type: "Tilt", defaultValue: 128 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(128); // tilt center
    expect(result[2]).toBe(255);
  });

  it("falls back to 128 for Pan coarse when defaultValue is 0", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 0 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(128); // 128 fallback for coarse pan
  });

  it("uses defaultValue for Pan Fine (no 128 fallback)", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan Fine", type: "Pan", defaultValue: 0 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(2); // fine channel: defaultValue 0 → motor-safe clamp min (buffer=4, min=2)
  });

  it("includes Pan in color output when override is enabled", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);
    fixture.channelOverrides = { 0: { value: 64, enabled: true } };

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(64);  // override applied
    expect(result[2]).toBe(255);
  });

  it("motor guard clamps Pan/Tilt override to 2-253 by default", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
      { offset: 1, name: "Tilt", type: "Tilt", defaultValue: 128 },
    ]);
    fixture.channelOverrides = {
      0: { value: 0, enabled: true },
      1: { value: 255, enabled: true },
    };

    const result = mapColor(fixture, 0, 0, 0, 1.0);

    expect(result[1]).toBe(2);   // Pan clamped from 0 → 2
    expect(result[2]).toBe(253); // Tilt clamped from 255 → 253
  });

  it("motor guard can be disabled per fixture", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
    ]);
    fixture.motorGuardEnabled = false;
    fixture.channelOverrides = { 0: { value: 0, enabled: true } };

    const result = mapColor(fixture, 0, 0, 0, 1.0);

    expect(result[1]).toBe(0); // no motor guard → full range
  });

  it("motor guard respects custom buffer size", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Tilt", type: "Tilt", defaultValue: 128 },
    ]);
    fixture.motorGuardBuffer = 10;
    fixture.channelOverrides = { 0: { value: 0, enabled: true } };

    const result = mapColor(fixture, 0, 0, 0, 1.0);

    expect(result[1]).toBe(5); // buffer=10 → min=5, max=250
  });

  it("maps Cyan as subtractive (255 - Red)", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Cyan", type: "ColorIntensity", color: "Cyan", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 100, 200, 150, 1.0);

    expect(result[1]).toBe(155); // 255 - 100
  });

  it("maps Magenta as subtractive (255 - Green)", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Magenta", type: "ColorIntensity", color: "Magenta", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 200, 80, 100, 1.0);

    expect(result[1]).toBe(175); // 255 - 80
  });

  it("maps Yellow as subtractive (255 - Blue)", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Yellow", type: "ColorIntensity", color: "Yellow", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 200, 100, 50, 1.0);

    expect(result[1]).toBe(205); // 255 - 50
  });

  it("sets UV to 0 (not representable in RGB)", () => {
    const fixture = makeFixture([
      { offset: 0, name: "UV", type: "ColorIntensity", color: "UV", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 255, 255, 1.0);

    expect(result[1]).toBe(0);
  });

  // White-gate tests for basic strobe fixtures
  it("basic strobe + white (255,255,255) → normal output (gate open)", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
      { offset: 1, name: "Strobe", type: "Strobe", defaultValue: 0 },
      { offset: 2, name: "Mode", type: "Generic", defaultValue: 128 },
    ]);

    const result = mapColor(fixture, 255, 255, 255, 1.0);

    expect(result[1]).toBe(255); // dimmer on
    expect(result[2]).toBe(0);   // strobe = effect mode → 0
    expect(result[3]).toBe(128); // generic gets defaultValue
  });

  it("basic strobe + near-white (245,250,248) → normal output", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
      { offset: 1, name: "Strobe", type: "Strobe", defaultValue: 0 },
      { offset: 2, name: "Mode", type: "Generic", defaultValue: 128 },
    ]);

    const result = mapColor(fixture, 245, 250, 248, 1.0);

    expect(result[1]).toBe(255); // dimmer still full
  });

  it("basic strobe + red (255,0,0) → ALL channels 0", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
      { offset: 1, name: "Strobe", type: "Strobe", defaultValue: 0 },
      { offset: 2, name: "Mode", type: "Generic", defaultValue: 128 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
    expect(result[3]).toBe(0);
  });

  it("basic strobe + dim white (200,200,200) → ALL channels 0", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
      { offset: 1, name: "Strobe", type: "Strobe", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 200, 200, 200, 1.0);

    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
  });

  it("basic strobe boundary: (240,240,240) → open", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
      { offset: 1, name: "Strobe", type: "Strobe", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 240, 240, 240, 1.0);

    expect(result[1]).toBe(255); // dimmer on (gate open)
  });

  it("basic strobe boundary: (240,239,240) → closed", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
      { offset: 1, name: "Strobe", type: "Strobe", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 240, 239, 240, 1.0);

    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
  });

  it("PAR with strobe + RGB channels → not gated (not basic strobe)", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 2, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 3, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
      { offset: 4, name: "Strobe", type: "Strobe", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(255); // dimmer = brightness * 255 = 255
    expect(result[2]).toBe(255); // red on
  });

  it("RGB-only fixture → not gated", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(255); // red on (not gated)
  });

  // Channel override tests
  it("override enabled on Red → override value used", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ]);
    fixture.channelOverrides = { 0: { value: 42, enabled: true } };

    const result = mapColor(fixture, 255, 128, 64, 1.0);

    expect(result[1]).toBe(42);  // overridden
    expect(result[2]).toBe(128); // normal
    expect(result[3]).toBe(64);  // normal
  });

  it("override disabled → normal mapping", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);
    fixture.channelOverrides = { 0: { value: 42, enabled: false } };

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(255);
  });

  it("override on Generic channel → override value used", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Mode", type: "Generic", defaultValue: 128 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);
    fixture.channelOverrides = { 0: { value: 200, enabled: true } };

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(200);
  });

  it("override on strobe channel when gate closed → override still applied", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
      { offset: 1, name: "Strobe", type: "Strobe", defaultValue: 0 },
      { offset: 2, name: "Mode", type: "Generic", defaultValue: 128 },
    ]);
    fixture.channelOverrides = { 1: { value: 100, enabled: true } };

    // Red → gate closed for basic strobe, but override wins
    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(0);   // dimmer: gate closed, no override → 0
    expect(result[2]).toBe(100); // strobe: override wins even with gate closed
    expect(result[3]).toBe(0);   // generic: gate closed, no override → 0
  });

  it("no overrides field → unchanged behavior", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(255);
  });

  it("override value clamped to 0-255", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);
    fixture.channelOverrides = { 0: { value: 300, enabled: true } };

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(255); // clamped from 300
  });

  it("custom whiteGateThreshold=200 on basic strobe → gate opens at (210,210,210)", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
      { offset: 1, name: "Strobe", type: "Strobe", defaultValue: 0 },
    ]);
    fixture.whiteGateThreshold = 200;

    const result = mapColor(fixture, 210, 210, 210, 1.0);

    expect(result[1]).toBe(255); // dimmer on (gate open at 200 threshold)
  });
});

describe("isWhiteGateOpen", () => {
  it("returns true when all >= threshold", () => {
    expect(isWhiteGateOpen(255, 255, 255, 240)).toBe(true);
  });

  it("returns true at exact threshold", () => {
    expect(isWhiteGateOpen(240, 240, 240, 240)).toBe(true);
  });

  it("returns false when one below threshold", () => {
    expect(isWhiteGateOpen(240, 239, 240, 240)).toBe(false);
  });

  it("returns false for pure red", () => {
    expect(isWhiteGateOpen(255, 0, 0, 240)).toBe(false);
  });

  it("DEFAULT_WHITE_GATE_THRESHOLD is 240", () => {
    expect(DEFAULT_WHITE_GATE_THRESHOLD).toBe(240);
  });
});

describe("mapColor with colorCalibration", () => {
  it("calibration applied before white extraction produces correct RGBW", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
      { offset: 3, name: "White", type: "ColorIntensity", color: "White", defaultValue: 0 },
    ]);
    // Red LED runs hot → reduce gain to 0.5
    // Input: (200, 100, 100) → after calibration: (100, 100, 100)
    // White extraction: min(100,100,100) = 100 → R=0, G=0, B=0, W=100
    (fixture as Record<string, unknown>).colorCalibration = {
      gain: { r: 0.5, g: 1.0, b: 1.0 },
      offset: { r: 0, g: 0, b: 0 },
    };

    const result = mapColor(fixture, 200, 100, 100, 1.0);

    expect(result[4]).toBe(100); // white = min(100,100,100)
    expect(result[1]).toBe(0);   // R after white extraction
    expect(result[2]).toBe(0);   // G after white extraction
    expect(result[3]).toBe(0);   // B after white extraction
  });
});

describe("getFixtureDefaults", () => {
  it("returns defaultValue for all channels", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 2, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 3, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ]);

    const result = getFixtureDefaults(fixture);

    expect(result[1]).toBe(0);
    expect(result[2]).toBe(0);
    expect(result[3]).toBe(0);
    expect(result[4]).toBe(0);
  });

  it("includes pan/tilt with their default values", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
      { offset: 1, name: "Tilt", type: "Tilt", defaultValue: 128 },
      { offset: 2, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const result = getFixtureDefaults(fixture);

    expect(result[1]).toBe(128); // pan center
    expect(result[2]).toBe(128); // tilt center
    expect(result[3]).toBe(0);   // red default
  });

  it("applies override value when override is enabled", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);
    fixture.channelOverrides = { 0: { value: 200, enabled: true } };

    const result = getFixtureDefaults(fixture);

    expect(result[1]).toBe(200); // override value
    expect(result[2]).toBe(0);   // no override, defaultValue
  });

  it("uses defaultValue when override is disabled", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
    ]);
    fixture.channelOverrides = { 0: { value: 200, enabled: false } };

    const result = getFixtureDefaults(fixture);

    expect(result[1]).toBe(128); // override disabled, uses defaultValue
  });

  it("clamps override values to 0-255", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
    ]);
    fixture.channelOverrides = { 0: { value: 300, enabled: true } };

    const result = getFixtureDefaults(fixture);

    expect(result[1]).toBe(253); // clamped from 300 → motor-safe max (buffer=4, max=253)
  });

  it("uses correct absolute DMX addresses", () => {
    const fixture = makeFixture(
      [
        { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
        { offset: 1, name: "Tilt", type: "Tilt", defaultValue: 128 },
      ],
      40,
    );

    const result = getFixtureDefaults(fixture);

    expect(result[40]).toBe(128);
    expect(result[41]).toBe(128);
  });
});
