import type { FixtureConfig, ChannelOverride } from "../types/protocol.js";
import {
  MOTOR_CHANNEL_TYPES,
  DEFAULT_MOTOR_GUARD_BUFFER,
  SAFE_CENTER_POSITION,
  clampMotor,
} from "./motor-guard.js";
import { shortId } from "../utils/format.js";
import { resolveAddress } from "./channel-remap.js";

export interface OverrideResult {
  readonly channels: Record<number, number>;
  readonly logLines: readonly string[];
}

/**
 * Compute DMX channel values for a set of override changes.
 * Pure function — no side effects, fully testable without HTTP context.
 *
 * For each override entry:
 * - If enabled: clamps to motor-safe range if applicable, then applies value
 * - If disabled on a motor channel: reverts to safe default (center or fine)
 * - If disabled on a non-motor channel: reverts to channel defaultValue
 */
export function computeOverrideChannels(
  fixture: FixtureConfig,
  overrides: Readonly<Record<string, ChannelOverride>>,
): OverrideResult {
  const base = fixture.dmxStartAddress;
  const channels: Record<number, number> = {};
  const logLines: string[] = [
    `PATCH override "${fixture.name}" (id=${shortId(fixture.id)} base=${base}):`,
  ];

  const motorGuardOn = fixture.motorGuardEnabled !== false;
  const motorBuffer = fixture.motorGuardBuffer ?? DEFAULT_MOTOR_GUARD_BUFFER;

  for (const [offsetStr, override] of Object.entries(overrides)) {
    const offset = Number(offsetStr);
    const channel = fixture.channels.find((ch) => ch.offset === offset);
    if (!channel) {
      logLines.push(`  [${offset}] SKIP — no matching channel definition`);
      continue;
    }

    const isMotor = motorGuardOn && MOTOR_CHANNEL_TYPES.has(channel.type);

    let value: number;
    if (override.enabled) {
      value = isMotor ? clampMotor(override.value, motorBuffer) : clamp(override.value);
    } else if (isMotor) {
      // Auto mode on motor channels: use safe center (128) if
      // defaultValue is 0 — same logic as mapColor to prevent
      // motors from slamming to mechanical limits.
      const isFine = /fine/i.test(channel.name);
      const raw = isFine ? channel.defaultValue : (channel.defaultValue > 0 ? channel.defaultValue : SAFE_CENTER_POSITION);
      value = clampMotor(raw, motorBuffer);
    } else {
      value = clamp(channel.defaultValue);
    }
    const addr = resolveAddress(fixture, offset);
    channels[addr] = value;

    const remapTag = addr !== base + offset ? ` remap→DMX${addr}` : "";
    logLines.push(
      `  [${offset}${remapTag}] DMX${addr} ${channel.name.padEnd(16)} ` +
      `type=${channel.type.padEnd(15)} enabled=${override.enabled} ` +
      `value=${override.value} → DMX=${value}`,
    );
  }

  return { channels, logLines };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
