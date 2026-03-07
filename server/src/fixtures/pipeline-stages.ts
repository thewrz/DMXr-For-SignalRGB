import type { FixtureConfig, FixtureChannel } from "../types/protocol.js";
import type { FixtureCapabilities } from "./fixture-capabilities.js";
import { MOTOR_CHANNEL_TYPES, DEFAULT_MOTOR_GUARD_BUFFER, clampMotor } from "./motor-guard.js";
import { DEFAULT_WHITE_GATE_THRESHOLD, isWhiteGateOpen } from "./channel-mapper.js";
import { resolveAddress } from "./channel-remap.js";

/**
 * Context passed through the color pipeline stages.
 * Each stage reads and returns an updated context (immutable pattern).
 */
export interface PipelineContext {
  readonly fixture: FixtureConfig;
  readonly caps: FixtureCapabilities;
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly white: number;
  readonly brightness: number;
  readonly channels: Record<number, number>;
  /** Set to true by whiteGateStage when gate is closed → short-circuit. */
  readonly gateClosed: boolean;
  /** DMX addresses managed by MovementEngine — skip these in colorMappingStage. */
  readonly movementManagedAddresses?: ReadonlySet<number>;
}

export type PipelineStage = (ctx: PipelineContext) => PipelineContext;

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * White gate check for basic strobe fixtures.
 * If the fixture is a basic strobe and the incoming color isn't near-white,
 * all channels are zeroed (except overrides) and gateClosed is set.
 */
export function whiteGateStage(ctx: PipelineContext): PipelineContext {
  if (!ctx.caps.isBasicStrobe) return ctx;

  const threshold = ctx.fixture.whiteGateThreshold ?? DEFAULT_WHITE_GATE_THRESHOLD;
  if (isWhiteGateOpen(ctx.r, ctx.g, ctx.b, threshold)) return ctx;

  const channels: Record<number, number> = {};
  for (const channel of ctx.fixture.channels) {
    const addr = resolveAddress(ctx.fixture, channel.offset);
    const override = ctx.fixture.channelOverrides?.[channel.offset];
    channels[addr] = override?.enabled ? clamp(override.value) : 0;
  }

  return { ...ctx, channels, gateClosed: true };
}

/**
 * Brightness scaling: when no dimmer channel, scale RGB by brightness.
 */
export function brightnessScaleStage(ctx: PipelineContext): PipelineContext {
  if (ctx.gateClosed) return ctx;
  if (ctx.caps.hasDimmer) return ctx;

  return {
    ...ctx,
    r: Math.round(ctx.r * ctx.brightness),
    g: Math.round(ctx.g * ctx.brightness),
    b: Math.round(ctx.b * ctx.brightness),
  };
}

/**
 * RGBW white extraction: when a white channel exists, extract the
 * common minimum from RGB into the white component.
 */
export function whiteExtractionStage(ctx: PipelineContext): PipelineContext {
  if (ctx.gateClosed) return ctx;
  if (!ctx.caps.colors.hasWhite) return ctx;

  const white = Math.min(ctx.r, ctx.g, ctx.b);
  return {
    ...ctx,
    r: ctx.r - white,
    g: ctx.g - white,
    b: ctx.b - white,
    white,
  };
}

/**
 * Core channel mapping: maps RGB/white/brightness/strobe/pan/tilt/etc
 * to DMX channel values based on channel definitions.
 */
export function colorMappingStage(ctx: PipelineContext): PipelineContext {
  if (ctx.gateClosed) return ctx;

  const channels = { ...ctx.channels };
  const motorGuardOn = ctx.fixture.motorGuardEnabled !== false;
  const motorBuffer = ctx.fixture.motorGuardBuffer ?? DEFAULT_MOTOR_GUARD_BUFFER;

  for (const channel of ctx.fixture.channels) {
    const addr = resolveAddress(ctx.fixture, channel.offset);

    // Skip Pan/Tilt channels managed by MovementEngine
    if (
      ctx.movementManagedAddresses?.has(addr) &&
      (channel.type === "Pan" || channel.type === "Tilt")
    ) {
      continue;
    }

    const override = ctx.fixture.channelOverrides?.[channel.offset];
    const isMotor = motorGuardOn && MOTOR_CHANNEL_TYPES.has(channel.type);

    if (override?.enabled) {
      channels[addr] = isMotor ? clampMotor(override.value, motorBuffer) : clamp(override.value);
    } else {
      channels[addr] = mapSingleChannel(channel, ctx, isMotor, motorBuffer);
    }
  }

  return { ...ctx, channels };
}

function mapSingleChannel(
  channel: FixtureChannel,
  ctx: PipelineContext,
  isMotor: boolean,
  motorBuffer: number,
): number {
  if (channel.type === "ColorIntensity") {
    return mapColorIntensity(channel, ctx);
  }
  if (channel.type === "Intensity") {
    return clamp(Math.round(ctx.brightness * 255));
  }
  if (channel.type === "Strobe" || channel.type === "ShutterStrobe") {
    return ctx.caps.strobeMode === "effect"
      ? 0
      : channel.defaultValue > 0
        ? channel.defaultValue
        : 255;
  }
  if (channel.type === "Pan" || channel.type === "Tilt") {
    return mapPanTilt(channel, isMotor, motorBuffer);
  }
  if (channel.type === "Focus" || channel.type === "Zoom") {
    const raw = channel.defaultValue > 0 ? channel.defaultValue : 128;
    return isMotor ? clampMotor(raw, motorBuffer) : clamp(raw);
  }
  return channel.defaultValue;
}

function mapColorIntensity(channel: FixtureChannel, ctx: PipelineContext): number {
  switch (channel.color) {
    case "Red": return clamp(ctx.r);
    case "Green": return clamp(ctx.g);
    case "Blue": return clamp(ctx.b);
    case "White": return clamp(ctx.white);
    case "Amber": return clamp(Math.round(ctx.r * 0.8 + ctx.g * 0.2));
    case "Cyan": return clamp(255 - ctx.r);
    case "Magenta": return clamp(255 - ctx.g);
    case "Yellow": return clamp(255 - ctx.b);
    case "UV": return 0;
    default: return channel.defaultValue;
  }
}

function mapPanTilt(channel: FixtureChannel, isMotor: boolean, motorBuffer: number): number {
  if (/fine/i.test(channel.name)) {
    return isMotor ? clampMotor(channel.defaultValue, motorBuffer) : clamp(channel.defaultValue);
  }
  const raw = channel.defaultValue > 0 ? channel.defaultValue : 128;
  return isMotor ? clampMotor(raw, motorBuffer) : clamp(raw);
}
