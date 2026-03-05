import type { ValidationResult } from "./fixture-validator.js";
import { validateFixtureChannels } from "./fixture-validator.js";
import type { CreateUserFixtureRequest, UpdateUserFixtureRequest } from "./user-fixture-types.js";

export function validateUserFixtureTemplate(
  request: CreateUserFixtureRequest | UpdateUserFixtureRequest,
): ValidationResult {
  const name = "name" in request ? request.name : undefined;
  if (name !== undefined && name.trim().length === 0) {
    return { valid: false, error: "Fixture name is required" };
  }

  const manufacturer = "manufacturer" in request ? request.manufacturer : undefined;
  if (manufacturer !== undefined && manufacturer.trim().length === 0) {
    return { valid: false, error: "Manufacturer is required" };
  }

  const modes = request.modes;
  if (modes !== undefined) {
    if (modes.length === 0) {
      return { valid: false, error: "At least one mode is required" };
    }

    const modeNames = new Set<string>();
    for (const mode of modes) {
      if (mode.name.trim().length === 0) {
        return { valid: false, error: "Mode name is required" };
      }

      if (modeNames.has(mode.name)) {
        return { valid: false, error: `Duplicate mode name: "${mode.name}"` };
      }
      modeNames.add(mode.name);

      if (mode.channels.length === 0) {
        return { valid: false, error: `Mode "${mode.name}" must have at least one channel` };
      }

      // Check duplicate offsets
      const offsets = new Set<number>();
      for (const ch of mode.channels) {
        if (offsets.has(ch.offset)) {
          return {
            valid: false,
            error: `Duplicate channel offset ${ch.offset} in mode "${mode.name}"`,
          };
        }
        offsets.add(ch.offset);
      }

      // Delegate to existing channel validator
      const channelResult = validateFixtureChannels(mode.channels, mode.channels.length);
      if (!channelResult.valid) {
        return channelResult;
      }
    }
  }

  return { valid: true };
}
