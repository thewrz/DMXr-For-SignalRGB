import type { FixtureConfig } from "../types/protocol.js";

/**
 * Channel remap: pure address-translation layer.
 *
 * Cheap DMX fixtures often have Green/Blue swapped vs their OFL definition.
 * Rather than creating a new fixture definition, users provide a channelRemap
 * mapping logical offsets → physical offsets. When no remap exists, the
 * functions are identity operations (zero overhead in the hot path).
 */

/**
 * Resolve a logical channel offset to its physical offset.
 * Returns the remapped offset if one exists, otherwise the original.
 */
export function resolveOffset(
  fixture: Pick<FixtureConfig, "channelRemap">,
  logicalOffset: number,
): number {
  const remap = fixture.channelRemap;
  if (!remap) return logicalOffset;
  const mapped = remap[logicalOffset];
  return mapped !== undefined ? mapped : logicalOffset;
}

/**
 * Resolve a logical channel offset to its absolute DMX address,
 * applying any channel remap.
 */
export function resolveAddress(
  fixture: Pick<FixtureConfig, "dmxStartAddress" | "channelRemap">,
  logicalOffset: number,
): number {
  return fixture.dmxStartAddress + resolveOffset(fixture, logicalOffset);
}

export interface RemapValidation {
  readonly valid: boolean;
  readonly error?: string;
}

/**
 * Validate a channelRemap object against fixture channel count.
 * Checks: offsets in range, no negative values, no duplicate targets (collisions).
 */
export function validateChannelRemap(
  remap: Readonly<Record<number, number>> | undefined,
  channelCount: number,
): RemapValidation {
  if (remap === undefined || Object.keys(remap).length === 0) {
    return { valid: true };
  }

  const seenTargets = new Set<number>();

  for (const [sourceStr, target] of Object.entries(remap)) {
    const source = Number(sourceStr);

    if (!Number.isInteger(source) || source < 0 || source >= channelCount) {
      return {
        valid: false,
        error: `Source offset ${source} is out of range (0-${channelCount - 1})`,
      };
    }

    if (!Number.isInteger(target) || target < 0 || target >= channelCount) {
      return {
        valid: false,
        error: `Target offset ${target} is out of range (0-${channelCount - 1})`,
      };
    }

    if (seenTargets.has(target)) {
      return {
        valid: false,
        error: `Duplicate target offset ${target} — two channels cannot map to the same physical address`,
      };
    }
    seenTargets.add(target);
  }

  return { valid: true };
}
