import type { FixtureConfig } from "../types/protocol.js";

const MIN_ADDRESS = 1;
const MAX_ADDRESS = 512;

export interface ValidationResult {
  readonly valid: boolean;
  readonly error?: string;
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
