import type { FixtureConfig } from "../types/protocol.js";
import { analyzeFixture } from "./fixture-capabilities.js";
import { pipeLog, shouldSample } from "../logging/pipeline-logger.js";

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
  const result: Record<number, number> = {};
  const base = fixture.dmxStartAddress;
  const caps = analyzeFixture(fixture.channels);
  const motorGuardOn = fixture.motorGuardEnabled !== false; // default true
  const motorBuffer = fixture.motorGuardBuffer ?? DEFAULT_MOTOR_GUARD_BUFFER;
  const trace = shouldSample(`mapColor:${fixture.id}`);
  const reasons: string[] = [];

  if (trace) {
    reasons.push(
      `mapColor "${fixture.name}" (id=${fixture.id.slice(0, 8)} base=${base}) ` +
      `rgb=(${r},${g},${b}) br=${brightness.toFixed(2)}`,
    );
    reasons.push(
      `  caps: dimmer=${caps.hasDimmer} strobe=${caps.strobeMode} ` +
      `basicStrobe=${caps.isBasicStrobe} pan=${caps.hasPan} tilt=${caps.hasTilt} ` +
      `white=${caps.colors.hasWhite}`,
    );
  }

  if (caps.isBasicStrobe) {
    const threshold = fixture.whiteGateThreshold ?? DEFAULT_WHITE_GATE_THRESHOLD;
    if (!isWhiteGateOpen(r, g, b, threshold)) {
      if (trace) reasons.push("  WHITE GATE CLOSED — all channels zeroed");
      for (const channel of fixture.channels) {
        const addr = base + channel.offset;
        const override = fixture.channelOverrides?.[channel.offset];
        result[addr] = override?.enabled ? clamp(override.value) : 0;
      }
      if (trace) logTrace(reasons, result, fixture, base);
      return result;
    }
  }

  let scaledR = r;
  let scaledG = g;
  let scaledB = b;

  if (!caps.hasDimmer) {
    scaledR = Math.round(r * brightness);
    scaledG = Math.round(g * brightness);
    scaledB = Math.round(b * brightness);
    if (trace) {
      reasons.push(
        `  no dimmer → brightness-scaled rgb=(${scaledR},${scaledG},${scaledB})`,
      );
    }
  }

  let white = 0;

  if (caps.colors.hasWhite) {
    white = Math.min(scaledR, scaledG, scaledB);
    scaledR = scaledR - white;
    scaledG = scaledG - white;
    scaledB = scaledB - white;
    if (trace) {
      reasons.push(
        `  white extraction: w=${white} → rgb=(${scaledR},${scaledG},${scaledB})`,
      );
    }
  }

  for (const channel of fixture.channels) {
    const addr = base + channel.offset;
    const override = fixture.channelOverrides?.[channel.offset];
    let reason = "";

    const isMotor = motorGuardOn && MOTOR_CHANNEL_TYPES.has(channel.type);

    if (override?.enabled) {
      result[addr] = isMotor ? clampMotor(override.value, motorBuffer) : clamp(override.value);
      reason = `OVERRIDE(${override.value}${isMotor ? ",motor-safe" : ""})`;
    } else if (channel.type === "ColorIntensity") {
      switch (channel.color) {
        case "Red":
          result[addr] = clamp(scaledR);
          reason = `color:Red(${scaledR})`;
          break;
        case "Green":
          result[addr] = clamp(scaledG);
          reason = `color:Green(${scaledG})`;
          break;
        case "Blue":
          result[addr] = clamp(scaledB);
          reason = `color:Blue(${scaledB})`;
          break;
        case "White":
          result[addr] = clamp(white);
          reason = `color:White(${white})`;
          break;
        case "Amber":
          result[addr] = clamp(Math.round(scaledR * 0.8 + scaledG * 0.2));
          reason = "color:Amber";
          break;
        case "Cyan":
          result[addr] = clamp(255 - scaledR);
          reason = "color:Cyan";
          break;
        case "Magenta":
          result[addr] = clamp(255 - scaledG);
          reason = "color:Magenta";
          break;
        case "Yellow":
          result[addr] = clamp(255 - scaledB);
          reason = "color:Yellow";
          break;
        case "UV":
          result[addr] = 0;
          reason = "color:UV(off)";
          break;
        default:
          result[addr] = channel.defaultValue;
          reason = `color:unknown(default=${channel.defaultValue})`;
      }
    } else if (channel.type === "Intensity") {
      result[addr] = clamp(Math.round(brightness * 255));
      reason = `dimmer(br=${brightness})`;
    } else if (
      channel.type === "Strobe" ||
      channel.type === "ShutterStrobe"
    ) {
      result[addr] =
        caps.strobeMode === "effect"
          ? 0
          : channel.defaultValue > 0
            ? channel.defaultValue
            : 255;
      reason = `strobe(mode=${caps.strobeMode},default=${channel.defaultValue})`;
    } else if (channel.type === "Pan" || channel.type === "Tilt") {
      if (/fine/i.test(channel.name)) {
        const raw = channel.defaultValue;
        result[addr] = isMotor ? clampMotor(raw, motorBuffer) : clamp(raw);
        reason = `${channel.type}Fine(default=${raw}${isMotor ? ",motor-safe" : ""})`;
      } else {
        const raw = channel.defaultValue > 0 ? channel.defaultValue : 128;
        result[addr] = isMotor ? clampMotor(raw, motorBuffer) : clamp(raw);
        reason = `${channel.type}Coarse(default=${channel.defaultValue}→${result[addr]}${isMotor ? ",motor-safe" : ""})`;
      }
    } else if (channel.type === "Focus" || channel.type === "Zoom") {
      const raw = channel.defaultValue > 0 ? channel.defaultValue : 128;
      result[addr] = isMotor ? clampMotor(raw, motorBuffer) : clamp(raw);
      reason = `${channel.type}(default=${channel.defaultValue}${isMotor ? ",motor-safe" : ""})`;
    } else {
      result[addr] = channel.defaultValue;
      reason = `generic(default=${channel.defaultValue})`;
    }

    if (trace) {
      const ovState = override
        ? `ovr=${override.enabled ? "ON" : "off"}(${override.value})`
        : "ovr=none";
      reasons.push(
        `  [${channel.offset}] DMX${addr} ${channel.name.padEnd(16)} ` +
        `type=${channel.type.padEnd(15)} ${ovState.padEnd(16)} → ${String(result[addr]).padStart(3)} (${reason})`,
      );
    }
  }

  if (trace) logTrace(reasons, result, fixture, base);

  return result;
}

function logTrace(
  reasons: readonly string[],
  result: Record<number, number>,
  fixture: FixtureConfig,
  base: number,
): void {
  const addrs = Object.keys(result).map(Number).sort((a, b) => a - b);
  const summary = addrs.map((a) => `${a}:${result[a]}`).join(" ");
  pipeLog("verbose", reasons.join("\n") + `\n  RESULT: ${summary}`);
}

/**
 * Returns default DMX values for ALL channels of a fixture.
 * Used at startup to initialize all channels before color frames arrive.
 */
export function getFixtureDefaults(fixture: FixtureConfig): Record<number, number> {
  const result: Record<number, number> = {};
  const base = fixture.dmxStartAddress;
  const lines: string[] = [
    `getFixtureDefaults "${fixture.name}" (id=${fixture.id.slice(0, 8)} base=${base}):`,
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

const DEFAULT_MOTOR_GUARD_BUFFER = 4;

/** Motor-safe clamp: prevents DMX extremes that can jam cheap fixture
 *  motors at mechanical limits. Buffer of 4 → clamps to 2-253. */
function clampMotor(value: number, buffer = DEFAULT_MOTOR_GUARD_BUFFER): number {
  const min = Math.floor(buffer / 2);
  const max = 255 - Math.ceil(buffer / 2);
  return Math.max(min, Math.min(max, Math.round(value)));
}

const MOTOR_CHANNEL_TYPES = new Set(["Pan", "Tilt", "Focus", "Zoom"]);
