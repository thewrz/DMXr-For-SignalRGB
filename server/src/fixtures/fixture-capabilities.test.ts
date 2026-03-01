import { describe, it, expect } from "vitest";
import {
  analyzeFixture,
  defaultValueForChannel,
} from "./fixture-capabilities.js";
import type { FixtureChannel } from "../types/protocol.js";

function ch(
  offset: number,
  type: string,
  color?: string,
): FixtureChannel {
  return {
    offset,
    name: color ?? type,
    type,
    ...(color ? { color } : {}),
    defaultValue: 0,
  };
}

describe("analyzeFixture", () => {
  it("RGB-only (no dimmer) → hasDimmer false, strobeMode none", () => {
    const caps = analyzeFixture([
      ch(0, "ColorIntensity", "Red"),
      ch(1, "ColorIntensity", "Green"),
      ch(2, "ColorIntensity", "Blue"),
    ]);

    expect(caps.hasDimmer).toBe(false);
    expect(caps.strobeMode).toBe("none");
    expect(caps.colors.hasRed).toBe(true);
    expect(caps.colors.hasGreen).toBe(true);
    expect(caps.colors.hasBlue).toBe(true);
  });

  it("RGBW (no dimmer) → hasWhite true", () => {
    const caps = analyzeFixture([
      ch(0, "ColorIntensity", "Red"),
      ch(1, "ColorIntensity", "Green"),
      ch(2, "ColorIntensity", "Blue"),
      ch(3, "ColorIntensity", "White"),
    ]);

    expect(caps.colors.hasWhite).toBe(true);
    expect(caps.hasDimmer).toBe(false);
  });

  it("Dimmer + RGB + Strobe (PAR can) → strobeMode effect", () => {
    const caps = analyzeFixture([
      ch(0, "Intensity"),
      ch(1, "ColorIntensity", "Red"),
      ch(2, "ColorIntensity", "Green"),
      ch(3, "ColorIntensity", "Blue"),
      ch(4, "Strobe"),
    ]);

    expect(caps.hasDimmer).toBe(true);
    expect(caps.strobeMode).toBe("effect");
  });

  it("No dimmer + ShutterStrobe + Pan + Tilt (moving head) → shutter mode", () => {
    const caps = analyzeFixture([
      ch(0, "ShutterStrobe"),
      ch(1, "ColorIntensity", "Red"),
      ch(2, "ColorIntensity", "Green"),
      ch(3, "ColorIntensity", "Blue"),
      ch(4, "Pan"),
      ch(5, "Tilt"),
    ]);

    expect(caps.hasDimmer).toBe(false);
    expect(caps.strobeMode).toBe("shutter");
    expect(caps.hasPan).toBe(true);
    expect(caps.hasTilt).toBe(true);
  });

  it("CMY fixture → cyan/magenta/yellow true, RGB false", () => {
    const caps = analyzeFixture([
      ch(0, "Intensity"),
      ch(1, "ColorIntensity", "Cyan"),
      ch(2, "ColorIntensity", "Magenta"),
      ch(3, "ColorIntensity", "Yellow"),
    ]);

    expect(caps.colors.hasCyan).toBe(true);
    expect(caps.colors.hasMagenta).toBe(true);
    expect(caps.colors.hasYellow).toBe(true);
    expect(caps.colors.hasRed).toBe(false);
    expect(caps.colors.hasGreen).toBe(false);
    expect(caps.colors.hasBlue).toBe(false);
  });

  it("no strobe channel → strobeMode none", () => {
    const caps = analyzeFixture([
      ch(0, "Intensity"),
      ch(1, "ColorIntensity", "Red"),
    ]);

    expect(caps.strobeMode).toBe("none");
  });

  it("channelsByType groups channels correctly", () => {
    const channels: FixtureChannel[] = [
      ch(0, "Intensity"),
      ch(1, "ColorIntensity", "Red"),
      ch(2, "ColorIntensity", "Green"),
      ch(3, "ColorIntensity", "Blue"),
      ch(4, "Strobe"),
    ];
    const caps = analyzeFixture(channels);

    expect(caps.channelsByType.get("Intensity")).toHaveLength(1);
    expect(caps.channelsByType.get("ColorIntensity")).toHaveLength(3);
    expect(caps.channelsByType.get("Strobe")).toHaveLength(1);
    expect(caps.channelsByType.get("Pan")).toBeUndefined();
  });

  it("empty channel list → all false/none/empty", () => {
    const caps = analyzeFixture([]);

    expect(caps.hasDimmer).toBe(false);
    expect(caps.strobeMode).toBe("none");
    expect(caps.hasPan).toBe(false);
    expect(caps.hasTilt).toBe(false);
    expect(caps.colors.hasRed).toBe(false);
    expect(caps.colors.hasWhite).toBe(false);
    expect(caps.channelsByType.size).toBe(0);
  });

  it("Amber + UV → hasAmber and hasUV true", () => {
    const caps = analyzeFixture([
      ch(0, "ColorIntensity", "Red"),
      ch(1, "ColorIntensity", "Green"),
      ch(2, "ColorIntensity", "Blue"),
      ch(3, "ColorIntensity", "Amber"),
      ch(4, "ColorIntensity", "UV"),
    ]);

    expect(caps.colors.hasAmber).toBe(true);
    expect(caps.colors.hasUV).toBe(true);
  });
});

describe("defaultValueForChannel", () => {
  it("Strobe + shutter → 255 (open)", () => {
    expect(defaultValueForChannel("Strobe", "shutter")).toBe(255);
  });

  it("Strobe + effect → 0 (no strobe)", () => {
    expect(defaultValueForChannel("Strobe", "effect")).toBe(0);
  });

  it("Strobe + none → 0", () => {
    expect(defaultValueForChannel("Strobe", "none")).toBe(0);
  });

  it("Pan → 128 (center)", () => {
    expect(defaultValueForChannel("Pan", "none")).toBe(128);
  });

  it("Tilt → 128 (center)", () => {
    expect(defaultValueForChannel("Tilt", "effect")).toBe(128);
  });

  it("ColorIntensity → 0", () => {
    expect(defaultValueForChannel("ColorIntensity", "none")).toBe(0);
  });

  it("Generic → 0", () => {
    expect(defaultValueForChannel("Generic", "shutter")).toBe(0);
  });

  it("Pan Fine → 0 (not 128)", () => {
    expect(defaultValueForChannel("Pan", "none", "Pan Fine")).toBe(0);
  });

  it("Tilt Fine → 0 (not 128)", () => {
    expect(defaultValueForChannel("Tilt", "effect", "Tilt Fine")).toBe(0);
  });

  it("Pan coarse (no name) → 128", () => {
    expect(defaultValueForChannel("Pan", "none")).toBe(128);
  });

  it("Pan coarse (explicit name) → 128", () => {
    expect(defaultValueForChannel("Pan", "none", "Pan")).toBe(128);
  });
});
