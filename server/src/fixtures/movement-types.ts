/** Movement configuration for a fixture's pan/tilt motors. */
export interface MovementConfig {
  readonly enabled: boolean;
  readonly maxVelocity: number;       // DMX units/sec (8-bit scale), default 50
  readonly maxAcceleration: number;   // DMX units/sec^2, default 100
  readonly smoothingCurve: "linear" | "ease-in-out" | "s-curve";
  readonly panRange: { readonly min: number; readonly max: number };
  readonly tiltRange: { readonly min: number; readonly max: number };
  readonly use16bit: boolean;         // auto-detected from fixture channels
  readonly homePosition: { readonly pan: number; readonly tilt: number };
  readonly preset: "moving-head" | "scanner" | "laser" | "custom";
}

/** Target position for a movement command. */
export interface MovementTarget {
  readonly pan?: number;    // 0-65535 (16-bit) or 0-255 (8-bit)
  readonly tilt?: number;
  readonly speed?: number;  // 0-1 multiplier override
}

/** Internal state of a fixture's movement interpolation. */
export interface MovementState {
  readonly currentPan: number;    // internal position (16-bit resolution always)
  readonly currentTilt: number;
  readonly targetPan: number;
  readonly targetTilt: number;
  readonly velocityPan: number;   // current velocity in 16-bit units/sec
  readonly velocityTilt: number;
  readonly lastUpdateTime: number;
  readonly isMoving: boolean;
}

/** DMX output values for pan/tilt channels. */
export interface PanTiltOutput {
  readonly panCoarse: number;     // 0-255
  readonly panFine: number;       // 0-255 (0 if no fine channel)
  readonly tiltCoarse: number;
  readonly tiltFine: number;
}

/** Default movement config for moving heads. */
export function defaultMovementConfig(): MovementConfig {
  return {
    enabled: true,
    maxVelocity: 50,
    maxAcceleration: 100,
    smoothingCurve: "ease-in-out",
    panRange: { min: 0, max: 255 },
    tiltRange: { min: 0, max: 255 },
    use16bit: false,
    homePosition: { pan: 128, tilt: 128 },
    preset: "moving-head",
  };
}

/** Laser preset: high velocity, linear interpolation, no ramping. */
export function laserPresetConfig(): MovementConfig {
  return {
    enabled: true,
    maxVelocity: 255,
    maxAcceleration: 1000,
    smoothingCurve: "linear",
    panRange: { min: 0, max: 255 },
    tiltRange: { min: 0, max: 255 },
    use16bit: false,
    homePosition: { pan: 128, tilt: 128 },
    preset: "laser",
  };
}
