import { describe, it, expect } from "vitest";
import { classifyFixture } from "./classify-fixture.js";

describe("classifyFixture", () => {
  // Moving Head: has Pan(3) AND Tilt(4)
  it("classifies Pan + Tilt as Moving Head", () => {
    expect(classifyFixture([1, 3, 4, 14, 15, 16])).toBe("Moving Head");
  });

  it("classifies Pan + Tilt + Gobo as Moving Head (priority)", () => {
    expect(classifyFixture([1, 3, 4, 8, 14, 15, 16])).toBe("Moving Head");
  });

  it("classifies Pan + Tilt + Prism as Moving Head", () => {
    expect(classifyFixture([3, 4, 7])).toBe("Moving Head");
  });

  // Scanner: Pan XOR Tilt (only one)
  it("classifies Pan without Tilt as Scanner", () => {
    expect(classifyFixture([1, 3, 14, 15, 16])).toBe("Scanner");
  });

  it("classifies Tilt without Pan as Scanner", () => {
    expect(classifyFixture([1, 4, 14, 15, 16])).toBe("Scanner");
  });

  // Effect: Gobo(8,9) or Prism(7), no Pan/Tilt
  it("classifies Gobo without Pan/Tilt as Effect", () => {
    expect(classifyFixture([1, 8, 14, 15, 16])).toBe("Effect");
  });

  it("classifies Rotating Gobo as Effect", () => {
    expect(classifyFixture([1, 9])).toBe("Effect");
  });

  it("classifies Prism without Pan/Tilt as Effect", () => {
    expect(classifyFixture([1, 7])).toBe("Effect");
  });

  // Strobe: has Strobe(41/64) but no color and no Pan/Tilt
  it("classifies Strobe-only fixture as Strobe", () => {
    expect(classifyFixture([1, 41])).toBe("Strobe");
  });

  it("classifies ShutterStrobe-only fixture as Strobe", () => {
    expect(classifyFixture([1, 64])).toBe("Strobe");
  });

  it("does NOT classify as Strobe when has RGB", () => {
    expect(classifyFixture([1, 41, 14, 15, 16])).toBe("Color Changer");
  });

  it("does NOT classify as Strobe when has Pan/Tilt", () => {
    expect(classifyFixture([1, 3, 4, 41])).toBe("Moving Head");
  });

  // Color Changer: has color channels, no Pan/Tilt
  it("classifies RGB channels as Color Changer", () => {
    expect(classifyFixture([1, 14, 15, 16])).toBe("Color Changer");
  });

  it("classifies RGBW as Color Changer", () => {
    expect(classifyFixture([1, 14, 15, 16, 87])).toBe("Color Changer");
  });

  it("classifies ColorWheel as Color Changer", () => {
    expect(classifyFixture([1, 2])).toBe("Color Changer");
  });

  it("classifies Amber-only as Color Changer", () => {
    expect(classifyFixture([105])).toBe("Color Changer");
  });

  it("classifies UV-only as Color Changer", () => {
    expect(classifyFixture([106])).toBe("Color Changer");
  });

  it("classifies CMY as Color Changer", () => {
    expect(classifyFixture([11, 12, 13])).toBe("Color Changer");
  });

  // Dimmer: only Intensity(1) and/or Generic types
  it("classifies Intensity-only as Dimmer", () => {
    expect(classifyFixture([1])).toBe("Dimmer");
  });

  it("classifies Intensity + Generic as Dimmer", () => {
    expect(classifyFixture([1, 17, 20])).toBe("Dimmer");
  });

  it("classifies Generic-only as Dimmer", () => {
    expect(classifyFixture([17, 82, 85])).toBe("Dimmer");
  });

  // Other: empty or unrecognized
  it("classifies empty attrs as Other", () => {
    expect(classifyFixture([])).toBe("Other");
  });

  // Edge cases
  it("handles readonly array", () => {
    const attrs: readonly number[] = [3, 4, 14, 15, 16];
    expect(classifyFixture(attrs)).toBe("Moving Head");
  });

  it("handles duplicate attr types", () => {
    expect(classifyFixture([14, 14, 15, 15, 16, 16])).toBe("Color Changer");
  });
});
