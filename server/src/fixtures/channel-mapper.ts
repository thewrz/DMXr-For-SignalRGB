import type { FixtureConfig } from "../types/protocol.js";
import { analyzeFixture } from "./fixture-capabilities.js";
import { pipeLog, shouldSample } from "../logging/pipeline-logger.js";
import { MOTOR_CHANNEL_TYPES, DEFAULT_MOTOR_GUARD_BUFFER, clampMotor } from "./motor-guard.js";
import { shortId } from "../utils/format.js";
import {
  whiteGateStage,
  brightnessScaleStage,
  whiteExtractionStage,
  colorMappingStage,
  type PipelineContext,
} from "./pipeline-stages.js";

export const DEFAULT_WHITE_GATE_THRESHOLD = 240;

export function isWhiteGateOpen(
  r: number,
  g: number,
  b: number,
  threshold: number,
): boolean {
  return r >= threshold && g >= threshold && b >= threshold;
}

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
  const base = fixture.dmxStartAddress;
  const caps = analyzeFixture(fixture.channels);
  const trace = shouldSample(`mapColor:${fixture.id}`);

  if (trace) {
    pipeLog("verbose",
      `mapColor "${fixture.name}" (id=${shortId(fixture.id)} base=${base}) ` +
      `rgb=(${r},${g},${b}) br=${brightness.toFixed(2)}\n` +
      `  caps: dimmer=${caps.hasDimmer} strobe=${caps.strobeMode} ` +
      `basicStrobe=${caps.isBasicStrobe} pan=${caps.hasPan} tilt=${caps.hasTilt} ` +
      `white=${caps.colors.hasWhite}`,
    );
  }

  const initial: PipelineContext = {
    fixture,
    caps,
    r,
    g,
    b,
    white: 0,
    brightness,
    channels: {},
    gateClosed: false,
  };

  // Run the pipeline stages in sequence
  const result = colorMappingStage(
    whiteExtractionStage(
      brightnessScaleStage(
        whiteGateStage(initial),
      ),
    ),
  );

  if (trace) {
    logTraceResult(result.channels, fixture, base);
  }

  return result.channels;
}

function logTraceResult(
  result: Record<number, number>,
  fixture: FixtureConfig,
  base: number,
): void {
  const addrs = Object.keys(result).map(Number).sort((a, b) => a - b);
  const summary = addrs.map((a) => `${a}:${result[a]}`).join(" ");
  const lines: string[] = [];
  for (const channel of fixture.channels) {
    const addr = base + channel.offset;
    const override = fixture.channelOverrides?.[channel.offset];
    const ovState = override
      ? `ovr=${override.enabled ? "ON" : "off"}(${override.value})`
      : "ovr=none";
    lines.push(
      `  [${channel.offset}] DMX${addr} ${channel.name.padEnd(16)} ` +
      `type=${channel.type.padEnd(15)} ${ovState.padEnd(16)} → ${String(result[addr] ?? 0).padStart(3)}`,
    );
  }
  pipeLog("verbose", lines.join("\n") + `\n  RESULT: ${summary}`);
}

/**
 * Returns default DMX values for ALL channels of a fixture.
 * Used at startup to initialize all channels before color frames arrive.
 */
export function getFixtureDefaults(fixture: FixtureConfig): Record<number, number> {
  const result: Record<number, number> = {};
  const base = fixture.dmxStartAddress;
  const lines: string[] = [
    `getFixtureDefaults "${fixture.name}" (id=${shortId(fixture.id)} base=${base}):`,
  ];

  const motorGuardOn = fixture.motorGuardEnabled !== false;
  const motorBuffer = fixture.motorGuardBuffer ?? DEFAULT_MOTOR_GUARD_BUFFER;

  for (const channel of fixture.channels) {
    const override = fixture.channelOverrides?.[channel.offset];
    const isMotor = motorGuardOn && MOTOR_CHANNEL_TYPES.has(channel.type);
    const doClamp = isMotor
      ? (v: number) => clampMotor(v, motorBuffer)
      : clamp;
    const value = override?.enabled
      ? doClamp(override.value)
      : doClamp(channel.defaultValue);
    result[base + channel.offset] = value;

    const src = override?.enabled
      ? `OVERRIDE(${override.value}${isMotor ? ",motor-safe" : ""})`
      : `default(${channel.defaultValue}${isMotor ? ",motor-safe" : ""})`;
    lines.push(
      `  [${channel.offset}] DMX${base + channel.offset} ${channel.name.padEnd(16)} ` +
      `type=${channel.type.padEnd(15)} → ${String(value).padStart(3)} (${src})`,
    );
  }

  pipeLog("info", lines.join("\n"));

  return result;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
