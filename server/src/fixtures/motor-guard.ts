import type { FixtureConfig } from "../types/protocol.js";
import { resolveAddress } from "./channel-remap.js";

/**
 * Unified motor guard constants and helpers.
 *
 * Motor channels (Pan, Tilt, Focus, Zoom, Gobo, Iris, Prism) can jam
 * cheap fixture motors when DMX sends extreme values (0 or 255) that
 * push the mechanism to its mechanical limits. The motor guard clamps
 * these channels to a safe range.
 */

/** All channel types considered "motor" channels — single source of truth. */
export const MOTOR_CHANNEL_TYPES = new Set([
  "Pan",
  "Tilt",
  "Focus",
  "Zoom",
  "Gobo",
  "Iris",
  "Prism",
]);

/** Default buffer: 4 DMX values total (2 from each end → range 2-253). */
export const DEFAULT_MOTOR_GUARD_BUFFER = 4;

/** Safe center value for motor channels with defaultValue 0. */
export const SAFE_CENTER_POSITION = 128;

/** Motor-safe clamp: prevents DMX extremes that can jam cheap fixture
 *  motors at mechanical limits. Buffer of 4 → clamps to 2-253. */
export function clampMotor(value: number, buffer = DEFAULT_MOTOR_GUARD_BUFFER): number {
  const min = Math.floor(buffer / 2);
  const max = 255 - Math.ceil(buffer / 2);
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** Check whether a channel type is a motor channel, respecting the
 *  per-fixture motorGuardEnabled flag (defaults to true). */
export function isMotorChannel(type: string, motorGuardEnabled?: boolean): boolean {
  const enabled = motorGuardEnabled !== false;
  return enabled && MOTOR_CHANNEL_TYPES.has(type);
}

/**
 * Compute safe motor positions for all fixtures.
 * Returns a Record of DMX address → safe value for every motor channel.
 * Used at startup to register with the universe manager so blackout/whiteout
 * restores motors to center instead of slamming to 0 or 255.
 */
export function computeSafePositions(
  fixtures: readonly FixtureConfig[],
): Record<number, number> {
  const positions: Record<number, number> = {};

  for (const fixture of fixtures) {
    for (const ch of fixture.channels) {
      if (MOTOR_CHANNEL_TYPES.has(ch.type)) {
        const addr = resolveAddress(fixture, ch.offset);
        const override = fixture.channelOverrides?.[ch.offset];
        positions[addr] = override?.enabled
          ? override.value
          : (ch.defaultValue > 0 ? ch.defaultValue : SAFE_CENTER_POSITION);
      }
    }
  }

  return positions;
}
