import type {
  MovementConfig,
  MovementTarget,
  MovementState,
  PanTiltOutput,
} from "./movement-types.js";

/** 16-bit scale factor: 1 8-bit unit = 256 16-bit units. */
const SCALE_16 = 256;

/** Deadband for arrival detection in 16-bit units (~1 8-bit unit). */
const DEADBAND = SCALE_16;

/**
 * Apply smoothing curve to a normalized progress value (0-1).
 * Returns a shaped 0-1 value.
 */
function applyCurve(
  progress: number,
  curve: MovementConfig["smoothingCurve"],
): number {
  switch (curve) {
    case "linear":
      return progress;
    case "ease-in-out":
      // Cubic ease-in-out
      return progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    case "s-curve":
      // Sigmoid-like: 6t^5 - 15t^4 + 10t^3 (smoothstep)
      return progress * progress * progress * (progress * (progress * 6 - 15) + 10);
  }
}

/**
 * Interpolate a single axis toward its target.
 * Returns [newPosition, newVelocity].
 */
function interpolateAxis(
  current: number,
  target: number,
  velocity: number,
  maxVelocity16: number,
  maxAccel16: number,
  deltaSec: number,
  speedMultiplier: number,
  curve: MovementConfig["smoothingCurve"],
): [number, number] {
  const delta = target - current;
  const absDelta = Math.abs(delta);

  if (absDelta < DEADBAND) {
    return [target, 0];
  }

  const direction = Math.sign(delta);
  const effectiveMaxVel = maxVelocity16 * speedMultiplier;

  // Compute progress toward target (0 = far, 1 = arrived)
  // Use distance-based progress for curve shaping
  const totalDistance = absDelta + Math.abs(velocity) * deltaSec;
  const progress = totalDistance > 0 ? 1 - (absDelta / Math.max(totalDistance, absDelta)) : 1;

  // Apply curve to get velocity scaling factor
  const curveScale = curve === "linear" ? 1 : applyCurve(Math.min(1, absDelta / (effectiveMaxVel * 0.5 + 1)), curve);
  const desiredSpeed = effectiveMaxVel * curveScale;

  // Compute desired velocity
  const desiredVelocity = direction * desiredSpeed;

  // Apply acceleration limiting
  const velocityDelta = desiredVelocity - velocity;
  const maxVelChange = maxAccel16 * deltaSec;
  const clampedDelta = Math.abs(velocityDelta) <= maxVelChange
    ? velocityDelta
    : Math.sign(velocityDelta) * maxVelChange;

  let newVelocity = velocity + clampedDelta;

  // Clamp velocity magnitude
  if (Math.abs(newVelocity) > effectiveMaxVel) {
    newVelocity = Math.sign(newVelocity) * effectiveMaxVel;
  }

  // Compute new position
  let newPosition = current + newVelocity * deltaSec;

  // Don't overshoot
  if ((direction > 0 && newPosition > target) || (direction < 0 && newPosition < target)) {
    newPosition = target;
    newVelocity = 0;
  }

  return [newPosition, newVelocity];
}

/**
 * Clamp a 16-bit position to the configured range (in 8-bit units, scaled to 16-bit).
 */
function clampRange(value: number, range: { readonly min: number; readonly max: number }): number {
  const min16 = range.min * SCALE_16;
  const max16 = range.max * SCALE_16;
  return Math.max(min16, Math.min(max16, value));
}

/**
 * Pure function: compute the next movement state given current state, config, and time delta.
 */
export function interpolateStep(
  state: MovementState,
  config: MovementConfig,
  deltaMs: number,
): MovementState {
  if (!state.isMoving) return state;

  const deltaSec = deltaMs / 1000;
  if (deltaSec <= 0) return state;

  // Scale 8-bit config values to 16-bit for internal math
  const maxVelocity16 = config.maxVelocity * SCALE_16;
  const maxAccel16 = config.maxAcceleration * SCALE_16;
  const speedMultiplier = 1; // target-level speed is applied in setTarget

  const [newPan, newVelPan] = interpolateAxis(
    state.currentPan,
    state.targetPan,
    state.velocityPan,
    maxVelocity16,
    maxAccel16,
    deltaSec,
    speedMultiplier,
    config.smoothingCurve,
  );

  const [newTilt, newVelTilt] = interpolateAxis(
    state.currentTilt,
    state.targetTilt,
    state.velocityTilt,
    maxVelocity16,
    maxAccel16,
    deltaSec,
    speedMultiplier,
    config.smoothingCurve,
  );

  const clampedPan = clampRange(newPan, config.panRange);
  const clampedTilt = clampRange(newTilt, config.tiltRange);

  const panArrived = Math.abs(clampedPan - state.targetPan) < DEADBAND;
  const tiltArrived = Math.abs(clampedTilt - state.targetTilt) < DEADBAND;
  const isMoving = !(panArrived && tiltArrived);

  return {
    currentPan: panArrived ? state.targetPan : clampedPan,
    currentTilt: tiltArrived ? state.targetTilt : clampedTilt,
    targetPan: state.targetPan,
    targetTilt: state.targetTilt,
    velocityPan: panArrived ? 0 : newVelPan,
    velocityTilt: tiltArrived ? 0 : newVelTilt,
    lastUpdateTime: state.lastUpdateTime + deltaMs,
    isMoving,
  };
}

/**
 * Convert internal 16-bit state to DMX output values.
 */
export function stateToOutput(state: MovementState, use16bit: boolean): PanTiltOutput {
  const panTotal = Math.round(Math.max(0, Math.min(65535, state.currentPan)));
  const tiltTotal = Math.round(Math.max(0, Math.min(65535, state.currentTilt)));

  if (use16bit) {
    return {
      panCoarse: (panTotal >> 8) & 0xFF,
      panFine: panTotal & 0xFF,
      tiltCoarse: (tiltTotal >> 8) & 0xFF,
      tiltFine: tiltTotal & 0xFF,
    };
  }

  return {
    panCoarse: Math.min(255, Math.round(panTotal / SCALE_16)),
    panFine: 0,
    tiltCoarse: Math.min(255, Math.round(tiltTotal / SCALE_16)),
    tiltFine: 0,
  };
}

/**
 * Convert an 8-bit value to internal 16-bit representation.
 */
function to16bit(value8: number): number {
  return value8 * SCALE_16;
}

/**
 * MovementEngine: manages movement state for multiple fixtures.
 * Accepts targets and produces interpolated pan/tilt outputs each tick.
 */
export class MovementEngine {
  private readonly states = new Map<string, MovementState>();
  private readonly configs = new Map<string, MovementConfig>();

  setTarget(fixtureId: string, target: MovementTarget): void {
    const config = this.configs.get(fixtureId);
    if (!config || !config.enabled) return;

    const existing = this.states.get(fixtureId);
    const currentPan = existing?.currentPan ?? to16bit(config.homePosition.pan);
    const currentTilt = existing?.currentTilt ?? to16bit(config.homePosition.tilt);

    const targetPan = target.pan !== undefined
      ? (config.use16bit ? target.pan : to16bit(target.pan))
      : (existing?.targetPan ?? currentPan);

    const targetTilt = target.tilt !== undefined
      ? (config.use16bit ? target.tilt : to16bit(target.tilt))
      : (existing?.targetTilt ?? currentTilt);

    this.states.set(fixtureId, {
      currentPan,
      currentTilt,
      targetPan: clampRange(targetPan, config.panRange),
      targetTilt: clampRange(targetTilt, config.tiltRange),
      velocityPan: existing?.velocityPan ?? 0,
      velocityTilt: existing?.velocityTilt ?? 0,
      lastUpdateTime: existing?.lastUpdateTime ?? Date.now(),
      isMoving: true,
    });
  }

  setConfig(fixtureId: string, config: MovementConfig): void {
    this.configs.set(fixtureId, config);
  }

  getConfig(fixtureId: string): MovementConfig | undefined {
    return this.configs.get(fixtureId);
  }

  tick(deltaMs: number): Map<string, PanTiltOutput> {
    const outputs = new Map<string, PanTiltOutput>();

    for (const [id, state] of this.states) {
      const config = this.configs.get(id);
      if (!config || !config.enabled) continue;

      const newState = interpolateStep(state, config, deltaMs);
      this.states.set(id, newState);
      outputs.set(id, stateToOutput(newState, config.use16bit));
    }

    return outputs;
  }

  getState(fixtureId: string): MovementState | undefined {
    return this.states.get(fixtureId);
  }

  removeFixture(fixtureId: string): void {
    this.states.delete(fixtureId);
    this.configs.delete(fixtureId);
  }

  reset(fixtureId: string): void {
    const config = this.configs.get(fixtureId);
    if (!config) return;

    const homePan = to16bit(config.homePosition.pan);
    const homeTilt = to16bit(config.homePosition.tilt);

    const existing = this.states.get(fixtureId);

    this.states.set(fixtureId, {
      currentPan: existing?.currentPan ?? homePan,
      currentTilt: existing?.currentTilt ?? homeTilt,
      targetPan: homePan,
      targetTilt: homeTilt,
      velocityPan: existing?.velocityPan ?? 0,
      velocityTilt: existing?.velocityTilt ?? 0,
      lastUpdateTime: existing?.lastUpdateTime ?? Date.now(),
      isMoving: true,
    });
  }

  stop(fixtureId: string): void {
    const state = this.states.get(fixtureId);
    if (!state) return;

    this.states.set(fixtureId, {
      ...state,
      targetPan: state.currentPan,
      targetTilt: state.currentTilt,
      velocityPan: 0,
      velocityTilt: 0,
      isMoving: false,
    });
  }
}
