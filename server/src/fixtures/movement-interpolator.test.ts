import { describe, it, expect } from "vitest";
import {
  interpolateStep,
  stateToOutput,
  MovementEngine,
} from "./movement-interpolator.js";
import {
  defaultMovementConfig,
  laserPresetConfig,
  type MovementConfig,
  type MovementState,
} from "./movement-types.js";

const SCALE_16 = 256;

function makeState(overrides: Partial<MovementState> = {}): MovementState {
  return {
    currentPan: 128 * SCALE_16,
    currentTilt: 128 * SCALE_16,
    targetPan: 128 * SCALE_16,
    targetTilt: 128 * SCALE_16,
    velocityPan: 0,
    velocityTilt: 0,
    lastUpdateTime: 0,
    isMoving: true,
    ...overrides,
  };
}

describe("interpolateStep", () => {
  it("moves position toward target with linear curve", () => {
    const config: MovementConfig = { ...defaultMovementConfig(), smoothingCurve: "linear" };
    const state = makeState({
      currentPan: 0,
      targetPan: 200 * SCALE_16,
    });

    const result = interpolateStep(state, config, 100);

    expect(result.currentPan).toBeGreaterThan(0);
    expect(result.currentPan).toBeLessThan(200 * SCALE_16);
    expect(result.isMoving).toBe(true);
  });

  it("moves position toward target with ease-in-out curve", () => {
    const config: MovementConfig = { ...defaultMovementConfig(), smoothingCurve: "ease-in-out" };
    const state = makeState({
      currentPan: 0,
      targetPan: 200 * SCALE_16,
    });

    const result = interpolateStep(state, config, 100);

    expect(result.currentPan).toBeGreaterThan(0);
    expect(result.isMoving).toBe(true);
  });

  it("moves position toward target with s-curve", () => {
    const config: MovementConfig = { ...defaultMovementConfig(), smoothingCurve: "s-curve" };
    const state = makeState({
      currentPan: 0,
      targetPan: 200 * SCALE_16,
    });

    const result = interpolateStep(state, config, 100);

    expect(result.currentPan).toBeGreaterThan(0);
    expect(result.isMoving).toBe(true);
  });

  it("clamps velocity at maxVelocity", () => {
    const config: MovementConfig = {
      ...defaultMovementConfig(),
      maxVelocity: 10,
      maxAcceleration: 10000,
      smoothingCurve: "linear",
    };
    const state = makeState({
      currentPan: 0,
      targetPan: 255 * SCALE_16,
    });

    // With very high acceleration, velocity should still cap at maxVelocity
    const result = interpolateStep(state, config, 1000);

    // At max velocity of 10 units/sec for 1 second = 10 * 256 = 2560 units max
    expect(result.currentPan).toBeLessThanOrEqual(10 * SCALE_16 + 1);
  });

  it("applies acceleration limiting", () => {
    const config: MovementConfig = {
      ...defaultMovementConfig(),
      maxVelocity: 255,
      maxAcceleration: 10,
      smoothingCurve: "linear",
    };
    const state = makeState({
      currentPan: 0,
      targetPan: 255 * SCALE_16,
      velocityPan: 0,
    });

    // Low acceleration means slow speed ramp-up
    const result = interpolateStep(state, config, 100);

    // After 100ms with accel=10*256 units/s^2:
    // velocity change = 10*256 * 0.1 = 256 units/sec
    // position change = 256 * 0.1 = ~25.6 units
    expect(result.currentPan).toBeLessThan(100 * SCALE_16);
    expect(result.velocityPan).toBeGreaterThan(0);
  });

  it("detects arrival and sets isMoving to false", () => {
    const config = defaultMovementConfig();
    const state = makeState({
      currentPan: 128 * SCALE_16 - 100,  // within deadband (256 units)
      currentTilt: 128 * SCALE_16,
      targetPan: 128 * SCALE_16,
      targetTilt: 128 * SCALE_16,
    });

    const result = interpolateStep(state, config, 25);

    expect(result.isMoving).toBe(false);
    expect(result.currentPan).toBe(128 * SCALE_16);
    expect(result.velocityPan).toBe(0);
  });

  it("clamps pan/tilt within configured range", () => {
    const config: MovementConfig = {
      ...defaultMovementConfig(),
      panRange: { min: 50, max: 200 },
      smoothingCurve: "linear",
    };
    const state = makeState({
      currentPan: 50 * SCALE_16,
      targetPan: 0,  // below range min
      velocityPan: -5000 * SCALE_16,  // large negative velocity
    });

    const result = interpolateStep(state, config, 100);

    expect(result.currentPan).toBeGreaterThanOrEqual(50 * SCALE_16);
  });

  it("returns unchanged state when not moving", () => {
    const config = defaultMovementConfig();
    const state = makeState({ isMoving: false });

    const result = interpolateStep(state, config, 25);

    expect(result).toBe(state);
  });

  it("returns unchanged state when deltaMs is 0", () => {
    const config = defaultMovementConfig();
    const state = makeState();

    const result = interpolateStep(state, config, 0);

    expect(result).toBe(state);
  });
});

describe("stateToOutput", () => {
  it("converts 16-bit state to coarse/fine output", () => {
    const state = makeState({
      currentPan: 0x8040,  // coarse=128, fine=64
      currentTilt: 0x4080,  // coarse=64, fine=128
    });

    const output = stateToOutput(state, true);

    expect(output.panCoarse).toBe(0x80);
    expect(output.panFine).toBe(0x40);
    expect(output.tiltCoarse).toBe(0x40);
    expect(output.tiltFine).toBe(0x80);
  });

  it("converts to 8-bit output (fine = 0)", () => {
    const state = makeState({
      currentPan: 128 * SCALE_16,
      currentTilt: 64 * SCALE_16,
    });

    const output = stateToOutput(state, false);

    expect(output.panCoarse).toBe(128);
    expect(output.panFine).toBe(0);
    expect(output.tiltCoarse).toBe(64);
    expect(output.tiltFine).toBe(0);
  });

  it("clamps output to valid range", () => {
    const state = makeState({
      currentPan: -100,
      currentTilt: 70000,
    });

    const output = stateToOutput(state, true);

    expect(output.panCoarse).toBe(0);
    expect(output.panFine).toBe(0);
    expect(output.tiltCoarse).toBe(255);
    expect(output.tiltFine).toBe(255);
  });
});

describe("MovementEngine", () => {
  it("setTarget and tick produce output", () => {
    const engine = new MovementEngine();
    const config: MovementConfig = {
      ...defaultMovementConfig(),
      smoothingCurve: "linear",
    };

    engine.setConfig("f1", config);
    engine.setTarget("f1", { pan: 200 });

    const outputs = engine.tick(25);

    expect(outputs.has("f1")).toBe(true);
    const output = outputs.get("f1")!;
    expect(output.panCoarse).toBeGreaterThanOrEqual(0);
    expect(output.panCoarse).toBeLessThanOrEqual(255);
  });

  it("getState returns current state", () => {
    const engine = new MovementEngine();
    engine.setConfig("f1", defaultMovementConfig());
    engine.setTarget("f1", { pan: 200 });

    const state = engine.getState("f1");

    expect(state).toBeDefined();
    expect(state!.targetPan).toBe(200 * SCALE_16);
    expect(state!.isMoving).toBe(true);
  });

  it("reset returns to home position", () => {
    const engine = new MovementEngine();
    const config = defaultMovementConfig();
    engine.setConfig("f1", config);
    engine.setTarget("f1", { pan: 200, tilt: 50 });

    // Run a few ticks to move away
    engine.tick(100);

    engine.reset("f1");
    const state = engine.getState("f1");

    expect(state!.targetPan).toBe(128 * SCALE_16);
    expect(state!.targetTilt).toBe(128 * SCALE_16);
    expect(state!.isMoving).toBe(true);
  });

  it("stop freezes at current position", () => {
    const engine = new MovementEngine();
    engine.setConfig("f1", { ...defaultMovementConfig(), smoothingCurve: "linear" });
    engine.setTarget("f1", { pan: 200 });

    engine.tick(100);
    const stateBeforeStop = engine.getState("f1")!;

    engine.stop("f1");
    const stateAfterStop = engine.getState("f1")!;

    expect(stateAfterStop.isMoving).toBe(false);
    expect(stateAfterStop.targetPan).toBe(stateBeforeStop.currentPan);
    expect(stateAfterStop.velocityPan).toBe(0);
  });

  it("removeFixture cleans up state and config", () => {
    const engine = new MovementEngine();
    engine.setConfig("f1", defaultMovementConfig());
    engine.setTarget("f1", { pan: 200 });

    engine.removeFixture("f1");

    expect(engine.getState("f1")).toBeUndefined();
    expect(engine.getConfig("f1")).toBeUndefined();
  });

  it("ignores setTarget when no config exists", () => {
    const engine = new MovementEngine();
    engine.setTarget("f1", { pan: 200 });

    expect(engine.getState("f1")).toBeUndefined();
  });

  it("ignores setTarget when config is disabled", () => {
    const engine = new MovementEngine();
    engine.setConfig("f1", { ...defaultMovementConfig(), enabled: false });
    engine.setTarget("f1", { pan: 200 });

    expect(engine.getState("f1")).toBeUndefined();
  });

  it("tick skips disabled fixtures", () => {
    const engine = new MovementEngine();
    engine.setConfig("f1", defaultMovementConfig());
    engine.setTarget("f1", { pan: 200 });

    // Disable config
    engine.setConfig("f1", { ...defaultMovementConfig(), enabled: false });
    const outputs = engine.tick(25);

    expect(outputs.size).toBe(0);
  });

  it("getConfig returns config for fixture", () => {
    const engine = new MovementEngine();
    const config = laserPresetConfig();
    engine.setConfig("f1", config);

    expect(engine.getConfig("f1")).toEqual(config);
  });
});

describe("defaultMovementConfig", () => {
  it("returns valid default config", () => {
    const config = defaultMovementConfig();
    expect(config.enabled).toBe(true);
    expect(config.maxVelocity).toBe(50);
    expect(config.maxAcceleration).toBe(100);
    expect(config.smoothingCurve).toBe("ease-in-out");
    expect(config.homePosition).toEqual({ pan: 128, tilt: 128 });
    expect(config.preset).toBe("moving-head");
  });
});

describe("laserPresetConfig", () => {
  it("returns high-velocity linear config", () => {
    const config = laserPresetConfig();
    expect(config.maxVelocity).toBe(255);
    expect(config.smoothingCurve).toBe("linear");
    expect(config.preset).toBe("laser");
  });
});

describe("applyCurve default case", () => {
  it("does not produce NaN for unknown smoothing curve", () => {
    const config = {
      ...defaultMovementConfig(),
      smoothingCurve: "bogus" as MovementConfig["smoothingCurve"],
    };
    const state = makeState({
      currentPan: 0,
      targetPan: 200 * SCALE_16,
    });

    const result = interpolateStep(state, config, 100);

    expect(Number.isNaN(result.currentPan)).toBe(false);
    expect(result.currentPan).toBeGreaterThanOrEqual(0);
  });
});

describe("speed multiplier", () => {
  it("speed=0.25 causes slower movement than speed=1", () => {
    const config = { ...defaultMovementConfig(), smoothingCurve: "linear" as const };
    const engine = new MovementEngine();

    engine.setConfig("fast", config);
    engine.setConfig("slow", config);

    engine.setTarget("fast", { pan: 255 });
    engine.setTarget("slow", { pan: 255, speed: 0.25 });

    engine.tick(200);

    const fastState = engine.getState("fast")!;
    const slowState = engine.getState("slow")!;

    expect(slowState.currentPan).toBeLessThan(fastState.currentPan);
  });

  it("speed is clamped to [0.01, 1]", () => {
    const config = { ...defaultMovementConfig(), smoothingCurve: "linear" as const };
    const engine = new MovementEngine();

    engine.setConfig("f1", config);
    engine.setTarget("f1", { pan: 200, speed: 0 });

    const state = engine.getState("f1")!;
    expect(state.speedMultiplier).toBe(0.01); // clamped, not 0
  });

  it("speed persists across setTarget calls without speed", () => {
    const config = { ...defaultMovementConfig(), smoothingCurve: "linear" as const };
    const engine = new MovementEngine();

    engine.setConfig("f1", config);
    engine.setTarget("f1", { pan: 100, speed: 0.5 });
    engine.setTarget("f1", { pan: 200 }); // no speed → keeps 0.5

    const state = engine.getState("f1")!;
    expect(state.speedMultiplier).toBe(0.5);
  });
});

describe("is16bit target flag", () => {
  it("does not double-scale 16-bit UDP values on 8-bit fixture", () => {
    const engine = new MovementEngine();
    engine.setConfig("mover", {
      ...defaultMovementConfig(),
      use16bit: false,
    });

    // Simulate UDP: value is already 16-bit (32768 = center position)
    engine.setTarget("mover", { pan: 32768, is16bit: true });

    const state = engine.getState("mover");
    expect(state!.targetPan).toBeLessThanOrEqual(65535);
    expect(state!.targetPan).toBe(32768);
  });

  it("still scales 8-bit values when is16bit is not set", () => {
    const engine = new MovementEngine();
    engine.setConfig("mover", {
      ...defaultMovementConfig(),
      use16bit: false,
    });

    engine.setTarget("mover", { pan: 128 });

    const state = engine.getState("mover");
    expect(state!.targetPan).toBe(128 * SCALE_16);
  });
});
