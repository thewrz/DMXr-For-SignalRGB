import type { FixtureConfig, FixtureChannel } from "../types/protocol.js";

const MIN_ADDRESS = 1;
const MAX_ADDRESS = 512;

export interface ValidationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly warnings?: readonly string[];
}

const KNOWN_CHANNEL_TYPES = new Set([
  "ColorIntensity",
  "Intensity",
  "Strobe",
  "ShutterStrobe",
  "Pan",
  "Tilt",
  "Focus",
  "Zoom",
  "Gobo",
  "Iris",
  "Prism",
  "ColorWheel",
  "NoFunction",
  "Generic",
]);

export function validateFixtureChannels(
  channels: readonly FixtureChannel[],
  expectedCount: number,
): ValidationResult {
  if (channels.length !== expectedCount) {
    return {
      valid: false,
      error: `channelCount (${expectedCount}) does not match channels array length (${channels.length})`,
    };
  }

  for (const ch of channels) {
    if (ch.defaultValue < 0 || ch.defaultValue > 255) {
      return {
        valid: false,
        error: `Channel "${ch.name}" has defaultValue ${ch.defaultValue} outside 0-255`,
      };
    }
  }

  const warnings: string[] = [];
  for (const ch of channels) {
    if (!KNOWN_CHANNEL_TYPES.has(ch.type)) {
      warnings.push(`Unknown channel type "${ch.type}" on channel "${ch.name}"`);
    }
  }

  return {
    valid: true,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export function validateFixtureAddress(
  startAddress: number,
  channelCount: number,
  existingFixtures: readonly FixtureConfig[],
  excludeId?: string,
): ValidationResult {
  if (
    !Number.isInteger(startAddress) ||
    startAddress < MIN_ADDRESS
  ) {
    return { valid: false, error: `Start address must be >= ${MIN_ADDRESS}` };
  }

  const endAddress = startAddress + channelCount - 1;

  if (endAddress > MAX_ADDRESS) {
    return {
      valid: false,
      error: `Fixture extends beyond channel ${MAX_ADDRESS} (needs ${startAddress}-${endAddress})`,
    };
  }

  if (channelCount < 1) {
    return { valid: false, error: "Channel count must be >= 1" };
  }

  for (const existing of existingFixtures) {
    if (excludeId !== undefined && existing.id === excludeId) {
      continue;
    }

    const existingEnd = existing.dmxStartAddress + existing.channelCount - 1;
    const overlaps =
      startAddress <= existingEnd && endAddress >= existing.dmxStartAddress;

    if (overlaps) {
      return {
        valid: false,
        error: `Overlaps with "${existing.name}" (DMX ${existing.dmxStartAddress}-${existingEnd})`,
      };
    }
  }

  return { valid: true };
}
