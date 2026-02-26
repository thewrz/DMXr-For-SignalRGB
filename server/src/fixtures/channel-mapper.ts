import type { FixtureConfig } from "../types/protocol.js";

/**
 * Maps RGB + brightness to DMX channel values for a fixture,
 * based on its channel definitions from OFL.
 *
 * Returns a Record<number, number> of absolute DMX address → value.
 */
export function mapColor(
  fixture: FixtureConfig,
  r: number,
  g: number,
  b: number,
  brightness: number,
): Record<number, number> {
  const result: Record<number, number> = {};
  const base = fixture.dmxStartAddress;

  const hasDimmer = fixture.channels.some((ch) => ch.type === "Intensity");

  let scaledR = r;
  let scaledG = g;
  let scaledB = b;

  if (!hasDimmer) {
    scaledR = Math.round(r * brightness);
    scaledG = Math.round(g * brightness);
    scaledB = Math.round(b * brightness);
  }

  const hasWhite = fixture.channels.some(
    (ch) => ch.type === "ColorIntensity" && ch.color === "White",
  );

  let white = 0;

  if (hasWhite) {
    white = Math.min(scaledR, scaledG, scaledB);
    scaledR = scaledR - white;
    scaledG = scaledG - white;
    scaledB = scaledB - white;
  }

  for (const channel of fixture.channels) {
    const addr = base + channel.offset;

    if (channel.type === "ColorIntensity") {
      switch (channel.color) {
        case "Red":
          result[addr] = clamp(scaledR);
          break;
        case "Green":
          result[addr] = clamp(scaledG);
          break;
        case "Blue":
          result[addr] = clamp(scaledB);
          break;
        case "White":
          result[addr] = clamp(white);
          break;
        case "Amber":
          result[addr] = clamp(Math.round((scaledR * 0.8 + scaledG * 0.2)));
          break;
        default:
          result[addr] = channel.defaultValue;
      }
    } else if (channel.type === "Intensity") {
      result[addr] = clamp(Math.round(brightness * 255));
    } else {
      result[addr] = channel.defaultValue;
    }
  }

  return result;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
