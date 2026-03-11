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

describe("colorMappingStage: color intensity variants", () => {
  it("maps Amber as 80% Red + 20% Green", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Amber", type: "ColorIntensity", color: "Amber", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 200, 100, 50, 1.0);
    const result = colorMappingStage(ctx);

    // Amber = round(200*0.8 + 100*0.2) = round(160+20) = 180
    expect(result.channels[1]).toBe(180);
  });

  it("maps Cyan as 255 - Red", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Cyan", type: "ColorIntensity", color: "Cyan", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 100, 150, 200, 1.0);
    const result = colorMappingStage(ctx);

    expect(result.channels[1]).toBe(155); // 255 - 100
  });

  it("maps Magenta as 255 - Green", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Magenta", type: "ColorIntensity", color: "Magenta", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 100, 50, 200, 1.0);
    const result = colorMappingStage(ctx);

    expect(result.channels[1]).toBe(205); // 255 - 50
  });

  it("maps Yellow as 255 - Blue", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Yellow", type: "ColorIntensity", color: "Yellow", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 100, 150, 30, 1.0);
    const result = colorMappingStage(ctx);

    expect(result.channels[1]).toBe(225); // 255 - 30
  });

  it("maps UV to 0", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "UV", type: "ColorIntensity", color: "UV", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 255, 255, 255, 1.0);
    const result = colorMappingStage(ctx);

    expect(result.channels[1]).toBe(0);
  });

  it("maps White from ctx.white", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "White", type: "ColorIntensity", color: "White", defaultValue: 0 },
    ];
    const ctx: PipelineContext = { ...makeCtx(channels, 100, 100, 100, 1.0), white: 75 };
    const result = colorMappingStage(ctx);

    expect(result.channels[1]).toBe(75);
  });

  it("maps unknown color to defaultValue", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Lime", type: "ColorIntensity", color: "Lime", defaultValue: 42 },
    ];
    const ctx = makeCtx(channels, 255, 255, 255, 1.0);
    const result = colorMappingStage(ctx);

    expect(result.channels[1]).toBe(42);
  });
});

describe("colorMappingStage: strobe channel behavior", () => {
  it("outputs 0 for Strobe when strobeMode is effect", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
      { offset: 1, name: "Strobe", type: "Strobe", defaultValue: 128 },
      { offset: 2, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 255, 0, 0, 1.0);
    const result = colorMappingStage(ctx);

    expect(result.channels[2]).toBe(0); // strobe = 0 in effect mode
  });

  it("outputs defaultValue for Strobe when strobeMode is shutter and defaultValue > 0", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Shutter", type: "ShutterStrobe", defaultValue: 200 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 255, 0, 0, 1.0);
    const result = colorMappingStage(ctx);

    // shutter mode, defaultValue > 0, so uses defaultValue
    expect(result.channels[1]).toBe(200);
  });

  it("outputs 255 for ShutterStrobe when strobeMode is shutter and defaultValue is 0", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Shutter", type: "ShutterStrobe", defaultValue: 0 },
      { offset: 1, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 255, 0, 0, 1.0);
    const result = colorMappingStage(ctx);

    // shutter mode, defaultValue=0, so fallback to 255
    expect(result.channels[1]).toBe(255);
  });
});

describe("colorMappingStage: Focus and Zoom channels", () => {
  it("maps Focus with motor guard to clamped default", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Focus", type: "Focus", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 0, 0, 0, 1.0);
    const result = colorMappingStage(ctx);

    // defaultValue=0, so raw = 128 (center). motor guard clamps 128 to 128 (within 2-253)
    expect(result.channels[1]).toBe(128);
  });

  it("maps Zoom with motor guard to clamped default", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Zoom", type: "Zoom", defaultValue: 200 },
    ];
    const ctx = makeCtx(channels, 0, 0, 0, 1.0);
    const result = colorMappingStage(ctx);

    // defaultValue > 0, motor guard clamps 200 to 200 (within 2-253)
    expect(result.channels[1]).toBe(200);
  });

  it("maps Focus without motor guard using plain clamp", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Focus", type: "Focus", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 0, 0, 0, 1.0, { motorGuardEnabled: false });
    const result = colorMappingStage(ctx);

    // motorGuardEnabled=false, defaultValue=0, so raw=128
    expect(result.channels[1]).toBe(128);
  });
});

describe("colorMappingStage: Pan Fine channel", () => {
  it("maps Pan Fine to defaultValue (not center) when name contains 'fine'", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
      { offset: 1, name: "Pan Fine", type: "Pan", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 0, 0, 0, 1.0);
    const result = colorMappingStage(ctx);

    // Pan coarse: defaultValue=128, motor guard clamps to 128
    expect(result.channels[1]).toBe(128);
    // Pan Fine: /fine/i test passes, so uses defaultValue with motor guard
    // defaultValue=0, motor guard clamps 0 to 2
    expect(result.channels[2]).toBe(2);
  });

  it("maps Tilt Fine to defaultValue with motor guard", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Tilt", type: "Tilt", defaultValue: 128 },
      { offset: 1, name: "Tilt fine", type: "Tilt", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 0, 0, 0, 1.0);
    const result = colorMappingStage(ctx);

    expect(result.channels[1]).toBe(128);
    // Tilt fine: motor guard clamps defaultValue 0 to 2
    expect(result.channels[2]).toBe(2);
  });
});

describe("colorMappingStage: disabled override", () => {
  it("uses normal mapping when override is disabled", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 200, 0, 0, 1.0, {
      channelOverrides: { 0: { value: 42, enabled: false } },
    });
    const result = colorMappingStage(ctx);

    expect(result.channels[1]).toBe(200); // Normal R mapping, not override
  });
});

describe("colorMappingStage: motor guard override", () => {
  it("applies motor guard to Pan override value", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
    ];
    const ctx = makeCtx(channels, 0, 0, 0, 1.0, {
      channelOverrides: { 0: { value: 0, enabled: true } },
    });
    const result = colorMappingStage(ctx);

    // Motor guard should clamp 0 to 2 (buffer=4, min=2)
    expect(result.channels[1]).toBe(2);
  });

  it("does not apply motor guard to non-motor override", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 100, 0, 0, 1.0, {
      channelOverrides: { 0: { value: 0, enabled: true } },
    });
    const result = colorMappingStage(ctx);

    // No motor guard on ColorIntensity, so override value 0 is used as-is
    expect(result.channels[1]).toBe(0);
  });
});

describe("colorMappingStage: channel remap interaction", () => {
  it("writes to remapped DMX address", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ];
    // Swap Green and Blue: logical offset 1 -> physical offset 2, logical offset 2 -> physical offset 1
    const ctx = makeCtx(channels, 255, 128, 64, 1.0, {
      channelRemap: { 1: 2, 2: 1 },
    });
    const result = colorMappingStage(ctx);

    // dmxStartAddress=1
    // Red: offset 0 -> no remap -> address 1
    expect(result.channels[1]).toBe(255);
    // Green: offset 1 -> remapped to offset 2 -> address 3
    expect(result.channels[3]).toBe(128);
    // Blue: offset 2 -> remapped to offset 1 -> address 2
    expect(result.channels[2]).toBe(64);
  });
});

describe("brightnessScaleStage edge cases", () => {
  it("scales to 0 when brightness is 0", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 255, 128, 64, 0);
    const result = brightnessScaleStage(ctx);

    expect(result.r).toBe(0);
    expect(result.g).toBe(0);
    expect(result.b).toBe(0);
  });

  it("does not change when brightness is 1", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 200, 100, 50, 1.0);
    const result = brightnessScaleStage(ctx);

    expect(result.r).toBe(200);
    expect(result.g).toBe(100);
    expect(result.b).toBe(50);
  });
});

describe("whiteExtractionStage edge cases", () => {
  it("extracts 0 white from pure red", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "White", type: "ColorIntensity", color: "White", defaultValue: 0 },
    ];
    const ctx = makeCtx(channels, 255, 0, 0, 1.0);
    const result = whiteExtractionStage(ctx);

    expect(result.white).toBe(0);
    expect(result.r).toBe(255);
  });

  it("passes through when gate is closed", () => {
    const channels: FixtureChannel[] = [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "White", type: "ColorIntensity", color: "White", defaultValue: 0 },
    ];
    const ctx: PipelineContext = { ...makeCtx(channels, 100, 100, 100, 1.0), gateClosed: true };
    const result = whiteExtractionStage(ctx);

    expect(result.white).toBe(0); // unchanged
    expect(result.r).toBe(100); // unchanged
  });
});

describe("whiteGateStage edge cases", () => {
  const strobeChannels: FixtureChannel[] = [
    { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
    { offset: 1, name: "Strobe", type: "Strobe", defaultValue: 0 },
  ];

  it("closes gate for pure black on basic strobe", () => {
    const ctx = makeCtx(strobeChannels, 0, 0, 0, 1.0);
    const result = whiteGateStage(ctx);

    expect(result.gateClosed).toBe(true);
  });

  it("keeps gate open for pure white (255,255,255)", () => {
    const ctx = makeCtx(strobeChannels, 255, 255, 255, 1.0);
    const result = whiteGateStage(ctx);

    expect(result.gateClosed).toBe(false);
  });

  it("zeros all channels when gate closes (without overrides)", () => {
    const ctx = makeCtx(strobeChannels, 255, 0, 0, 1.0);
    const result = whiteGateStage(ctx);

    expect(result.gateClosed).toBe(true);
    // All channels should be zeroed
    for (const ch of strobeChannels) {
      const addr = ctx.fixture.dmxStartAddress + ch.offset;
      expect(result.channels[addr]).toBe(0);
    }
  });
});
