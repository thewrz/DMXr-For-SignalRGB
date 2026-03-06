import { describe, it, expect } from "vitest";
import { extractFixtureColor } from "./fixture-color-extractor.js";
import type { FixtureChannel } from "../types/protocol.js";

function ch(offset: number, name: string, type: string, color?: string): FixtureChannel {
  return { offset, name, type, color, defaultValue: 0 };
}

describe("extractFixtureColor", () => {
  it("returns correct color values for an RGB fixture", () => {
    const channels: FixtureChannel[] = [
      ch(0, "Red", "ColorIntensity", "Red"),
      ch(1, "Green", "ColorIntensity", "Green"),
      ch(2, "Blue", "ColorIntensity", "Blue"),
    ];
    const values: Record<number, number> = { 10: 255, 11: 128, 12: 64 };

    const result = extractFixtureColor(channels, 10, values);

    expect(result.groups).toEqual([{ r: 255, g: 128, b: 64, w: 0 }]);
    expect(result.hasColor).toBe(true);
    expect(result.active).toBe(true);
  });

  it("returns white in group for RGBW fixture", () => {
    const channels: FixtureChannel[] = [
      ch(0, "Red", "ColorIntensity", "Red"),
      ch(1, "Green", "ColorIntensity", "Green"),
      ch(2, "Blue", "ColorIntensity", "Blue"),
      ch(3, "White", "ColorIntensity", "White"),
    ];
    const values: Record<number, number> = { 1: 100, 2: 50, 3: 75, 4: 180 };

    const result = extractFixtureColor(channels, 1, values);

    expect(result.groups[0].w).toBe(180);
    expect(result.groups[0].r).toBe(100);
  });

  it("returns dimmer value when fixture has Intensity channel", () => {
    const channels: FixtureChannel[] = [
      ch(0, "Dimmer", "Intensity"),
      ch(1, "Red", "ColorIntensity", "Red"),
      ch(2, "Green", "ColorIntensity", "Green"),
      ch(3, "Blue", "ColorIntensity", "Blue"),
    ];
    const values: Record<number, number> = { 1: 200, 2: 255, 3: 128, 4: 64 };

    const result = extractFixtureColor(channels, 1, values);

    expect(result.dimmer).toBe(200);
  });

  it("returns hasColor:false and grayscale for non-color fixture", () => {
    const channels: FixtureChannel[] = [
      ch(0, "Dimmer", "Intensity"),
      ch(1, "Strobe", "Strobe"),
    ];
    const values: Record<number, number> = { 5: 180, 6: 0 };

    const result = extractFixtureColor(channels, 5, values);

    expect(result.hasColor).toBe(false);
    expect(result.groups).toEqual([{ r: 180, g: 180, b: 180, w: 0 }]);
  });

  it("returns active:false when all values are zero", () => {
    const channels: FixtureChannel[] = [
      ch(0, "Red", "ColorIntensity", "Red"),
      ch(1, "Green", "ColorIntensity", "Green"),
      ch(2, "Blue", "ColorIntensity", "Blue"),
    ];
    const values: Record<number, number> = {};

    const result = extractFixtureColor(channels, 1, values);

    expect(result.active).toBe(false);
    expect(result.groups).toEqual([{ r: 0, g: 0, b: 0, w: 0 }]);
  });

  it("defaults missing channel values to 0", () => {
    const channels: FixtureChannel[] = [
      ch(0, "Red", "ColorIntensity", "Red"),
      ch(1, "Green", "ColorIntensity", "Green"),
      ch(2, "Blue", "ColorIntensity", "Blue"),
    ];
    // Only green has a value
    const values: Record<number, number> = { 2: 128 };

    const result = extractFixtureColor(channels, 1, values);

    expect(result.groups[0].r).toBe(0);
    expect(result.groups[0].g).toBe(128);
    expect(result.groups[0].b).toBe(0);
  });

  it("excludes motor channels (Pan/Tilt) from active detection", () => {
    const channels: FixtureChannel[] = [
      ch(0, "Pan", "Pan"),
      ch(1, "Tilt", "Tilt"),
      ch(2, "Red", "ColorIntensity", "Red"),
      ch(3, "Green", "ColorIntensity", "Green"),
      ch(4, "Blue", "ColorIntensity", "Blue"),
    ];
    // Only Pan and Tilt have values; color channels are zero
    const values: Record<number, number> = { 1: 128, 2: 200 };

    const result = extractFixtureColor(channels, 1, values);

    expect(result.active).toBe(false);
  });

  it("handles Amber/UV-only fixture gracefully", () => {
    const channels: FixtureChannel[] = [
      ch(0, "UV", "ColorIntensity", "UV"),
      ch(1, "Amber", "ColorIntensity", "Amber"),
    ];
    const values: Record<number, number> = { 1: 200, 2: 150 };

    const result = extractFixtureColor(channels, 1, values);

    expect(result.hasColor).toBe(true);
    expect(result.active).toBe(true);
    // No crash, group has defaults for missing RGB
    expect(result.groups[0].r).toBe(0);
    expect(result.groups[0].g).toBe(0);
    expect(result.groups[0].b).toBe(0);
  });

  it("returns dimmer -1 when no Intensity channel exists", () => {
    const channels: FixtureChannel[] = [
      ch(0, "Red", "ColorIntensity", "Red"),
      ch(1, "Green", "ColorIntensity", "Green"),
      ch(2, "Blue", "ColorIntensity", "Blue"),
    ];

    const result = extractFixtureColor(channels, 1, {});

    expect(result.dimmer).toBe(-1);
  });
});
