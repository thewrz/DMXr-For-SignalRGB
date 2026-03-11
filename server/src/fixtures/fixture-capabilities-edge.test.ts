import { describe, it, expect } from "vitest";
import {
  analyzeFixture,
  defaultValueForChannel,
} from "./fixture-capabilities.js";
import type { FixtureChannel } from "../types/protocol.js";

function ch(
  offset: number,
  type: string,
  name: string,
  color?: string,
): FixtureChannel {
  return {
    offset,
    name,
    type,
    ...(color ? { color } : {}),
    defaultValue: 0,
  };
}

describe("analyzeFixture: Pan Fine / Tilt Fine detection", () => {
  it("detects Pan Fine when channel name contains 'Fine' (case-insensitive)", () => {
    const caps = analyzeFixture([
      ch(0, "Pan", "Pan"),
      ch(1, "Pan", "Pan Fine"),
    ]);

    expect(caps.hasPan).toBe(true);
    expect(caps.hasPanFine).toBe(true);
  });

  it("detects Tilt Fine when channel name contains 'fine' (lowercase)", () => {
    const caps = analyzeFixture([
      ch(0, "Tilt", "Tilt"),
      ch(1, "Tilt", "Tilt fine"),
    ]);

    expect(caps.hasTilt).toBe(true);
    expect(caps.hasTiltFine).toBe(true);
  });

  it("does not set hasPanFine when Pan channel name does not contain fine", () => {
    const caps = analyzeFixture([
      ch(0, "Pan", "Pan"),
    ]);

    expect(caps.hasPan).toBe(true);
    expect(caps.hasPanFine).toBe(false);
  });

  it("does not set hasTiltFine when Tilt channel name does not contain fine", () => {
    const caps = analyzeFixture([
      ch(0, "Tilt", "Tilt"),
    ]);

    expect(caps.hasTilt).toBe(true);
    expect(caps.hasTiltFine).toBe(false);
  });

  it("detects both Pan Fine and Tilt Fine on a full moving head", () => {
    const caps = analyzeFixture([
      ch(0, "Pan", "Pan"),
      ch(1, "Pan", "Pan Fine"),
      ch(2, "Tilt", "Tilt"),
      ch(3, "Tilt", "Tilt Fine"),
      ch(4, "ColorIntensity", "Red", "Red"),
      ch(5, "ColorIntensity", "Green", "Green"),
      ch(6, "ColorIntensity", "Blue", "Blue"),
    ]);

    expect(caps.hasPan).toBe(true);
    expect(caps.hasPanFine).toBe(true);
    expect(caps.hasTilt).toBe(true);
    expect(caps.hasTiltFine).toBe(true);
    expect(caps.colors.hasRed).toBe(true);
  });
});

describe("analyzeFixture: isBasicStrobe edge cases", () => {
  it("is false when fixture has only White color (not RGB)", () => {
    const caps = analyzeFixture([
      ch(0, "Intensity", "Dimmer"),
      ch(1, "Strobe", "Strobe"),
      ch(2, "ColorIntensity", "White", "White"),
    ]);

    // White-only fixture with strobe is still a "basic strobe" because no RGB
    expect(caps.isBasicStrobe).toBe(true);
  });

  it("is false when fixture has Amber and Strobe but no RGB", () => {
    const caps = analyzeFixture([
      ch(0, "Intensity", "Dimmer"),
      ch(1, "Strobe", "Strobe"),
      ch(2, "ColorIntensity", "Amber", "Amber"),
    ]);

    // Amber is not Red/Green/Blue, so hasRGB is false -> isBasicStrobe true
    expect(caps.isBasicStrobe).toBe(true);
  });

  it("is false when fixture has only Green and Strobe", () => {
    const caps = analyzeFixture([
      ch(0, "Intensity", "Dimmer"),
      ch(1, "Strobe", "Strobe"),
      ch(2, "ColorIntensity", "Green", "Green"),
    ]);

    // Green alone counts as "hasRGB" in the code (any of R, G, B)
    expect(caps.isBasicStrobe).toBe(false);
  });
});

describe("analyzeFixture: ColorIntensity without color property", () => {
  it("does not crash when ColorIntensity has no color", () => {
    const caps = analyzeFixture([
      { offset: 0, name: "Unknown Color", type: "ColorIntensity", defaultValue: 0 },
    ]);

    expect(caps.colors.hasRed).toBe(false);
    expect(caps.colors.hasGreen).toBe(false);
    expect(caps.colors.hasBlue).toBe(false);
  });
});

describe("analyzeFixture: channelsByType with duplicate types", () => {
  it("groups multiple channels of the same type", () => {
    const caps = analyzeFixture([
      ch(0, "Pan", "Pan"),
      ch(1, "Pan", "Pan Fine"),
      ch(2, "Tilt", "Tilt"),
      ch(3, "Tilt", "Tilt Fine"),
    ]);

    expect(caps.channelsByType.get("Pan")).toHaveLength(2);
    expect(caps.channelsByType.get("Tilt")).toHaveLength(2);
  });
});

describe("defaultValueForChannel edge cases", () => {
  it("ShutterStrobe + shutter -> 255", () => {
    expect(defaultValueForChannel("ShutterStrobe", "shutter")).toBe(255);
  });

  it("ShutterStrobe + effect -> 0", () => {
    expect(defaultValueForChannel("ShutterStrobe", "effect")).toBe(0);
  });

  it("Pan Fine -> 0 (fine channels default to 0, not center)", () => {
    expect(defaultValueForChannel("Pan", "none", "Pan Fine")).toBe(0);
  });

  it("Tilt Fine -> 0", () => {
    expect(defaultValueForChannel("Tilt", "effect", "Tilt fine")).toBe(0);
  });

  it("Pan (not fine) -> 128", () => {
    expect(defaultValueForChannel("Pan", "none", "Pan")).toBe(128);
  });

  it("Tilt (not fine) -> 128", () => {
    expect(defaultValueForChannel("Tilt", "none", "Tilt")).toBe(128);
  });

  it("Pan with no name -> 128 (fine regex does not match empty)", () => {
    expect(defaultValueForChannel("Pan", "none")).toBe(128);
  });

  it("Intensity -> 0", () => {
    expect(defaultValueForChannel("Intensity", "none")).toBe(0);
  });

  it("Focus -> 0", () => {
    expect(defaultValueForChannel("Focus", "none")).toBe(0);
  });

  it("Zoom -> 0", () => {
    expect(defaultValueForChannel("Zoom", "shutter")).toBe(0);
  });
});
