import { describe, it, expect } from "vitest";
import { mapColor } from "./channel-mapper.js";
import type { FixtureConfig, FixtureChannel } from "../types/protocol.js";

function makeFixture(
  channels: FixtureChannel[],
  startAddress = 1,
): FixtureConfig {
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

  it("uses defaultValue for non-color generic channels", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan/Tilt Speed", type: "Generic", defaultValue: 128 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 2, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 3, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 128, 64, 1.0);

    expect(result[1]).toBe(128); // generic uses defaultValue
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

  it("defaults Pan to 128 (center) when defaultValue is 0", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 0 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(128);
  });

  it("defaults Tilt to 128 (center) when defaultValue is 0", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Tilt", type: "Tilt", defaultValue: 0 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(128);
  });

  it("uses Pan defaultValue when > 0", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 64 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(64);
  });

  it("defaults Pan Fine to 0 (not 128)", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 0 },
      { offset: 1, name: "Pan Fine", type: "Pan", defaultValue: 0 },
      { offset: 2, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(128); // coarse Pan centers
    expect(result[2]).toBe(0);   // fine Pan stays at 0
  });

  it("defaults Tilt Fine to 0 (not 128)", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Tilt", type: "Tilt", defaultValue: 0 },
      { offset: 1, name: "Tilt Fine", type: "Tilt", defaultValue: 0 },
      { offset: 2, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(128); // coarse Tilt centers
    expect(result[2]).toBe(0);   // fine Tilt stays at 0
  });

  it("uses Pan Fine defaultValue when explicitly set", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 0 },
      { offset: 1, name: "Pan Fine", type: "Pan", defaultValue: 42 },
      { offset: 2, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[2]).toBe(42); // explicit fine value honored
  });

  it("handles lowercase 'fine' in channel name", () => {
    const fixture = makeFixture([
      { offset: 0, name: "Pan fine", type: "Pan", defaultValue: 0 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ]);

    const result = mapColor(fixture, 255, 0, 0, 1.0);

    expect(result[1]).toBe(0); // fine channel, not center
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
});
