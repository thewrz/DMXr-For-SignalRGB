import { describe, it, expect } from "vitest";
import { calibrationStage } from "./calibration-stage.js";
import type { PipelineContext } from "./pipeline-stages.js";
import { analyzeFixture } from "./fixture-capabilities.js";
import type { FixtureConfig, FixtureChannel, ColorCalibration } from "../types/protocol.js";

const rgbChannels: FixtureChannel[] = [
  { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
  { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
  { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
];

function makeCtx(
  r: number,
  g: number,
  b: number,
  extra: Partial<FixtureConfig> = {},
  overrides: Partial<PipelineContext> = {},
): PipelineContext {
  const fixture: FixtureConfig = {
    id: "test",
    name: "Test",
    mode: "test",
    dmxStartAddress: 1,
    channelCount: rgbChannels.length,
    channels: rgbChannels,
    ...extra,
  };
  return {
    fixture,
    caps: analyzeFixture(rgbChannels),
    r,
    g,
    b,
    white: 0,
    brightness: 1.0,
    channels: {},
    gateClosed: false,
    ...overrides,
  };
}

function cal(
  gain: { r: number; g: number; b: number },
  offset: { r: number; g: number; b: number },
): ColorCalibration {
  return { gain, offset };
}

describe("calibrationStage", () => {
  it("passes through when no colorCalibration config", () => {
    const ctx = makeCtx(100, 150, 200);
    const result = calibrationStage(ctx);

    expect(result.r).toBe(100);
    expect(result.g).toBe(150);
    expect(result.b).toBe(200);
  });

  it("passes through when gateClosed", () => {
    const ctx = makeCtx(100, 150, 200, {
      colorCalibration: cal({ r: 2, g: 2, b: 2 }, { r: 0, g: 0, b: 0 }),
    }, { gateClosed: true });
    const result = calibrationStage(ctx);

    expect(result.r).toBe(100);
    expect(result.g).toBe(150);
    expect(result.b).toBe(200);
  });

  it("applies gain multiplier", () => {
    const ctx = makeCtx(100, 200, 100, {
      colorCalibration: cal({ r: 1.5, g: 0.5, b: 1.0 }, { r: 0, g: 0, b: 0 }),
    });
    const result = calibrationStage(ctx);

    expect(result.r).toBe(150);
    expect(result.g).toBe(100);
    expect(result.b).toBe(100);
  });

  it("applies offset addition", () => {
    const ctx = makeCtx(100, 100, 100, {
      colorCalibration: cal({ r: 1.0, g: 1.0, b: 1.0 }, { r: 10, g: -20, b: 0 }),
    });
    const result = calibrationStage(ctx);

    expect(result.r).toBe(110);
    expect(result.g).toBe(80);
    expect(result.b).toBe(100);
  });

  it("applies gain then offset (gain * value + offset)", () => {
    const ctx = makeCtx(100, 100, 100, {
      colorCalibration: cal({ r: 2.0, g: 2.0, b: 2.0 }, { r: 10, g: 10, b: 10 }),
    });
    const result = calibrationStage(ctx);

    expect(result.r).toBe(210);
    expect(result.g).toBe(210);
    expect(result.b).toBe(210);
  });

  it("clamps high values to 255", () => {
    const ctx = makeCtx(200, 200, 200, {
      colorCalibration: cal({ r: 2.0, g: 2.0, b: 2.0 }, { r: 0, g: 0, b: 0 }),
    });
    const result = calibrationStage(ctx);

    expect(result.r).toBe(255);
    expect(result.g).toBe(255);
    expect(result.b).toBe(255);
  });

  it("clamps low values to 0", () => {
    const ctx = makeCtx(50, 50, 50, {
      colorCalibration: cal({ r: 1.0, g: 1.0, b: 1.0 }, { r: -100, g: -100, b: -100 }),
    });
    const result = calibrationStage(ctx);

    expect(result.r).toBe(0);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
  });

  it("identity calibration produces no change", () => {
    const ctx = makeCtx(128, 64, 200, {
      colorCalibration: cal({ r: 1.0, g: 1.0, b: 1.0 }, { r: 0, g: 0, b: 0 }),
    });
    const result = calibrationStage(ctx);

    expect(result.r).toBe(128);
    expect(result.g).toBe(64);
    expect(result.b).toBe(200);
  });

  it("rounds to nearest integer", () => {
    // 101 * 1.5 = 151.5 → Math.round(151.5) = 152
    const ctx = makeCtx(101, 101, 101, {
      colorCalibration: cal({ r: 1.5, g: 1.5, b: 1.5 }, { r: 0, g: 0, b: 0 }),
    });
    const result = calibrationStage(ctx);

    expect(result.r).toBe(152);
    expect(result.g).toBe(152);
    expect(result.b).toBe(152);
  });
});
