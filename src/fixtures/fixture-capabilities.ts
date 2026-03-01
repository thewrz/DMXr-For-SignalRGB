import type { FixtureChannel } from "../types/protocol.js";

export type StrobeMode = "none" | "effect" | "shutter";

export interface ColorCapabilities {
  readonly hasRed: boolean;
  readonly hasGreen: boolean;
  readonly hasBlue: boolean;
  readonly hasWhite: boolean;
  readonly hasAmber: boolean;
  readonly hasCyan: boolean;
  readonly hasMagenta: boolean;
  readonly hasYellow: boolean;
  readonly hasUV: boolean;
}

export interface FixtureCapabilities {
  readonly hasDimmer: boolean;
  readonly colors: ColorCapabilities;
  readonly strobeMode: StrobeMode;
  readonly hasPan: boolean;
  readonly hasTilt: boolean;
  readonly channelsByType: ReadonlyMap<string, readonly FixtureChannel[]>;
}

/**
 * Analyze a fixture's channel list and return its capability profile.
 * Pure function — same channels always produce the same result.
 */
export function analyzeFixture(
  channels: readonly FixtureChannel[],
): FixtureCapabilities {
  let hasDimmer = false;
  let hasStrobe = false;
  let hasPan = false;
  let hasTilt = false;

  const colorFlags: Record<string, boolean> = {};
  const byType = new Map<string, readonly FixtureChannel[]>();

  for (const ch of channels) {
    const existing = byType.get(ch.type) ?? [];
    byType.set(ch.type, [...existing, ch]);

    // Detect capabilities
    switch (ch.type) {
      case "Intensity":
        hasDimmer = true;
        break;
      case "Strobe":
      case "ShutterStrobe":
        hasStrobe = true;
        break;
      case "Pan":
        hasPan = true;
        break;
      case "Tilt":
        hasTilt = true;
        break;
      case "ColorIntensity":
        if (ch.color) {
          colorFlags[ch.color] = true;
        }
        break;
    }
  }

  const strobeMode: StrobeMode = hasStrobe
    ? hasDimmer
      ? "effect"
      : "shutter"
    : "none";

  return {
    hasDimmer,
    colors: {
      hasRed: colorFlags["Red"] === true,
      hasGreen: colorFlags["Green"] === true,
      hasBlue: colorFlags["Blue"] === true,
      hasWhite: colorFlags["White"] === true,
      hasAmber: colorFlags["Amber"] === true,
      hasCyan: colorFlags["Cyan"] === true,
      hasMagenta: colorFlags["Magenta"] === true,
      hasYellow: colorFlags["Yellow"] === true,
      hasUV: colorFlags["UV"] === true,
    },
    strobeMode,
    hasPan,
    hasTilt,
    channelsByType: byType,
  };
}

/**
 * Centralized default value logic for a channel type given the fixture's strobe mode.
 *
 * - Strobe/ShutterStrobe + shutter mode → 255 (open shutter for light output)
 * - Strobe/ShutterStrobe + effect mode → 0 (no strobe effect)
 * - Pan/Tilt → 128 (center)
 * - Everything else → 0
 */
export function defaultValueForChannel(
  type: string,
  strobeMode: StrobeMode,
  name?: string,
): number {
  if (type === "Strobe" || type === "ShutterStrobe") {
    return strobeMode === "shutter" ? 255 : 0;
  }
  if (type === "Pan" || type === "Tilt") {
    return /fine/i.test(name ?? "") ? 0 : 128;
  }
  return 0;
}
