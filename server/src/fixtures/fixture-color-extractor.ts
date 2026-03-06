import type { FixtureChannel } from "../types/protocol.js";
import { resolveOffset } from "./channel-remap.js";

export interface ColorGroup {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly w: number;
}

export interface FixtureColorState {
  readonly groups: readonly ColorGroup[];
  readonly dimmer: number;
  readonly hasColor: boolean;
  readonly active: boolean;
}

const MOTOR_TYPES = new Set(["Pan", "Tilt", "Focus", "Zoom"]);

export function extractFixtureColor(
  channels: readonly FixtureChannel[],
  dmxStartAddress: number,
  channelValues: Record<number, number>,
  channelRemap?: Readonly<Record<number, number>>,
): FixtureColorState {
  let r = 0;
  let g = 0;
  let b = 0;
  let w = 0;
  let dimmer = -1;
  let hasColor = false;
  let activeNonMotor = false;

  const remapCtx = { channelRemap };
  for (const ch of channels) {
    const addr = dmxStartAddress + resolveOffset(remapCtx, ch.offset);
    const val = channelValues[addr] ?? 0;

    if (!MOTOR_TYPES.has(ch.type) && val > 0) {
      activeNonMotor = true;
    }

    if (ch.type === "ColorIntensity") {
      hasColor = true;
      switch (ch.color) {
        case "Red":
          r = val;
          break;
        case "Green":
          g = val;
          break;
        case "Blue":
          b = val;
          break;
        case "White":
          w = val;
          break;
      }
    } else if (ch.type === "Intensity") {
      dimmer = val;
    }
  }

  if (!hasColor) {
    // Grayscale from max non-motor value
    let maxVal = 0;
    for (const ch of channels) {
      if (!MOTOR_TYPES.has(ch.type)) {
        const val = channelValues[dmxStartAddress + resolveOffset(remapCtx, ch.offset)] ?? 0;
        if (val > maxVal) maxVal = val;
      }
    }
    return {
      groups: [{ r: maxVal, g: maxVal, b: maxVal, w: 0 }],
      dimmer,
      hasColor: false,
      active: activeNonMotor,
    };
  }

  return {
    groups: [{ r, g, b, w }],
    dimmer,
    hasColor: true,
    active: activeNonMotor,
  };
}
