import { describe, it, expect } from "vitest";
import {
  whiteGateStage,
  brightnessScaleStage,
  whiteExtractionStage,
  colorMappingStage,
  type PipelineContext,
} from "./pipeline-stages.js";
import { analyzeFixture } from "./fixture-capabilities.js";
import type { FixtureConfig, FixtureChannel } from "../types/protocol.js";

function makeCtx(
  channels: FixtureChannel[],
  r: number,
  g: number,
  b: number,
  brightness = 1.0,
  extra: Partial<FixtureConfig> = {},
): PipelineContext {
  const fixture: FixtureConfig = {
    id: "test",
    name: "Test",
    mode: "test",
    dmxStartAddress: 1,
    channelCount: channels.length,
    channels,
    ...extra,
  };
  return {
    fixture,
    caps: analyzeFixture(channels),
    r,
    g,
    b,
    white: 0,
    brightness,
    channels: {},
    gateClosed: false,
  };
}

describe("whiteGateStage", () => {
  const strobeChannels: FixtureChannel[] = [
    { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
    { offset: 1, name: "Strobe", type: "Strobe", defaultValue: 0 },
  ];

  it("closes gate for non-white color on basic strobe", () => {
    const ctx = makeCtx(strobeChannels, 255, 0, 0, 1.0);
    const result = whiteGateStage(ctx);

    expect(result.gateClosed).toBe(true);
    expect(result.channels[1]).toBe(0);
    expect(result.channels[2]).toBe(0);
  });

  it("keeps gate open for near-white on basic strobe", () => {
    const ctx = makeCtx(strobeChannels, 245, 250, 248, 1.0);
    const result = whiteGateStage(ctx);

    expect(result.gateClosed).toBe(false);
  });

  it("does not gate non-strobe fixtures", () => {
    const rgbChannels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
    ];
    const ctx = makeCtx(rgbChannels, 255, 0, 0, 1.0);
    const result = whiteGateStage(ctx);

    expect(result.gateClosed).toBe(false);
  });

  it("respects custom threshold", () => {
    const ctx = makeCtx(strobeChannels, 210, 210, 210, 1.0, { whiteGateThreshold: 200 });
    const result = whiteGateStage(ctx);

    expect(result.gateClosed).toBe(false);
  });

  it("applies overrides even when gate is closed", () => {
    const ctx = makeCtx(strobeChannels, 255, 0, 0, 1.0, {
      channelOverrides: { 1: { value: 100, enabled: true } },
    });
    const result = whiteGateStage(ctx);

    expect(result.gateClosed).toBe(true);
    expect(result.channels[2]).toBe(100); // override wins
  });
});

describe("brightnessScaleStage", () => {
  it("scales RGB when no dimmer", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 200, 100, 50, 0.5);
    const result = brightnessScaleStage(ctx);

    expect(result.r).toBe(100);
    expect(result.g).toBe(50);
    expect(result.b).toBe(25);
  });

  it("does not scale when dimmer exists", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 200, 100, 50, 0.5);
    const result = brightnessScaleStage(ctx);

    expect(result.r).toBe(200);
    expect(result.g).toBe(100);
    expect(result.b).toBe(50);
  });

  it("passes through when gate is closed", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ];
    const ctx: PipelineContext = { ...makeCtx(channels, 200, 100, 50, 0.5), gateClosed: true };
    const result = brightnessScaleStage(ctx);

    expect(result.r).toBe(200); // unchanged
  });
});

describe("whiteExtractionStage", () => {
  it("extracts white component when white channel exists", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
      { offset: 3, name: "White", type: "ColorIntensity", color: "White", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 100, 100, 100, 1.0);
    const result = whiteExtractionStage(ctx);

    expect(result.white).toBe(100);
    expect(result.r).toBe(0);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
  });

  it("partially extracts white", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 3, name: "White", type: "ColorIntensity", color: "White", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 255, 128, 64, 1.0);
    const result = whiteExtractionStage(ctx);

    expect(result.white).toBe(64);
    expect(result.r).toBe(191);
  });

  it("does nothing without white channel", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 100, 100, 100, 1.0);
    const result = whiteExtractionStage(ctx);

    expect(result.white).toBe(0);
    expect(result.r).toBe(100);
  });
});

describe("colorMappingStage", () => {
  it("maps RGB channels", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 255, 128, 64, 1.0);
    const result = colorMappingStage(ctx);

    expect(result.channels[1]).toBe(255);
    expect(result.channels[2]).toBe(128);
    expect(result.channels[3]).toBe(64);
  });

  it("maps dimmer channel from brightness", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 0, 0, 0, 0.5);
    const result = colorMappingStage(ctx);

    expect(result.channels[1]).toBe(128);
  });

  it("applies motor guard to Pan", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 0, 0, 0, 1.0);
    const result = colorMappingStage(ctx);

    expect(result.channels[1]).toBe(128); // defaultValue 0 → 128 center, then motor clamp = 128
  });

  it("applies override over normal mapping", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 255, 0, 0, 1.0, {
      channelOverrides: { 0: { value: 42, enabled: true } },
    });
    const result = colorMappingStage(ctx);

    expect(result.channels[1]).toBe(42);
  });

  it("skips when gate is closed", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ];
    const ctx: PipelineContext = { ...makeCtx(channels, 255, 0, 0, 1.0), gateClosed: true };
    const result = colorMappingStage(ctx);

    expect(Object.keys(result.channels)).toHaveLength(0);
  });

  it("maps generic channels to defaultValue", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Mode", type: "Generic", defaultValue: 128 },
    ];
    const ctx = makeCtx(channels, 0, 0, 0, 1.0);
    const result = colorMappingStage(ctx);

    expect(result.channels[1]).toBe(128);
  });

  it("skips Pan/Tilt when address is in movementManagedAddresses", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Pan", type: "Pan", defaultValue: 128 },
      { offset: 2, name: "Tilt", type: "Tilt", defaultValue: 128 },
    ];
    const managedAddresses = new Set([2, 3]); // dmxStartAddress=1, so Pan=2, Tilt=3
    const ctx: PipelineContext = {
      ...makeCtx(channels, 255, 0, 0, 1.0),
      movementManagedAddresses: managedAddresses,
    };
    const result = colorMappingStage(ctx);

    expect(result.channels[1]).toBe(255); // Red still mapped
    expect(result.channels[2]).toBeUndefined(); // Pan skipped
    expect(result.channels[3]).toBeUndefined(); // Tilt skipped
  });

  it("writes Pan/Tilt normally when no movementManagedAddresses", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
      { offset: 1, name: "Tilt", type: "Tilt", defaultValue: 128 },
    ];
    const ctx = makeCtx(channels, 0, 0, 0, 1.0);
    const result = colorMappingStage(ctx);

    expect(result.channels[1]).toBeDefined();
    expect(result.channels[2]).toBeDefined();
  });
});
