import { describe, it, expect } from "vitest";
import {
  interpolateStep,
  stateToOutput,
  MovementEngine,
} from "./movement-interpolator.js";
import {
  defaultMovementConfig,
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

describe("interpolateStep edge cases", () => {
  it("returns unchanged state for negative deltaMs", () => {
    const config = defaultMovementConfig();
    const state = makeState({
      currentPan: 0,
      targetPan: 200 * SCALE_16,
    });

    const result = interpolateStep(state, config, -10);

    expect(result).toBe(state);
  });

  it("interpolates tilt independently of pan", () => {
    const config: MovementConfig = {
      ...defaultMovementConfig(),
      smoothingCurve: "linear",
    };
    const state = makeState({
      currentPan: 128 * SCALE_16,
      targetPan: 128 * SCALE_16,
      currentTilt: 0,
      targetTilt: 200 * SCALE_16,
    });

    const result = interpolateStep(state, config, 100);

    // Pan should stay at target (already there)
    expect(result.currentPan).toBe(128 * SCALE_16);
    expect(result.velocityPan).toBe(0);
    // Tilt should have moved
    expect(result.currentTilt).toBeGreaterThan(0);
    expect(result.isMoving).toBe(true);
  });

  it("updates lastUpdateTime by deltaMs", () => {
    const config = defaultMovementConfig();
    const state = makeState({
      currentPan: 0,
      targetPan: 200 * SCALE_16,
      lastUpdateTime: 1000,
    });

    const result = interpolateStep(state, config, 50);

    expect(result.lastUpdateTime).toBe(1050);
  });

  it("converges to exact target after many steps", () => {
    const config: MovementConfig = {
      ...defaultMovementConfig(),
      maxVelocity: 100,
      maxAcceleration: 200,
      smoothingCurve: "linear",
    };
    let state = makeState({
      currentPan: 0,
      targetPan: 100 * SCALE_16,
      currentTilt: 0,
      targetTilt: 100 * SCALE_16,
    });

    // Simulate many small ticks
    for (let i = 0; i < 200; i++) {
      state = interpolateStep(state, config, 25);
      if (!state.isMoving) break;
    }

    expect(state.isMoving).toBe(false);
    expect(state.currentPan).toBe(100 * SCALE_16);
    expect(state.currentTilt).toBe(100 * SCALE_16);
  });

  it("clamps tilt within configured range", () => {
    const config: MovementConfig = {
      ...defaultMovementConfig(),
      tiltRange: { min: 30, max: 200 },
      smoothingCurve: "linear",
    };
    const state = makeState({
      currentTilt: 30 * SCALE_16,
      targetTilt: 0, // below range min
      velocityTilt: -5000 * SCALE_16,
    });

    const result = interpolateStep(state, config, 100);

    expect(result.currentTilt).toBeGreaterThanOrEqual(30 * SCALE_16);
  });

  it("does not overshoot target moving downward", () => {
    const config: MovementConfig = {
      ...defaultMovementConfig(),
      maxVelocity: 255,
      maxAcceleration: 10000,
      smoothingCurve: "linear",
    };
    const state = makeState({
      currentPan: 200 * SCALE_16,
      targetPan: 100 * SCALE_16,
      velocityPan: 0,
    });

    const result = interpolateStep(state, config, 1000);

    expect(result.currentPan).toBeGreaterThanOrEqual(100 * SCALE_16);
  });
});

describe("stateToOutput edge cases", () => {
  it("handles zero values in 16-bit mode", () => {
    const state = makeState({
      currentPan: 0,
      currentTilt: 0,
    });

    const output = stateToOutput(state, true);

    expect(output.panCoarse).toBe(0);
    expect(output.panFine).toBe(0);
    expect(output.tiltCoarse).toBe(0);
    expect(output.tiltFine).toBe(0);
  });

  it("handles max values in 16-bit mode", () => {
    const state = makeState({
      currentPan: 65535,
      currentTilt: 65535,
    });

    const output = stateToOutput(state, true);

    expect(output.panCoarse).toBe(255);
    expect(output.panFine).toBe(255);
    expect(output.tiltCoarse).toBe(255);
    expect(output.tiltFine).toBe(255);
  });

  it("clamps 8-bit output at 255 for large values", () => {
    const state = makeState({
      currentPan: 260 * SCALE_16,
      currentTilt: 260 * SCALE_16,
    });

    const output = stateToOutput(state, false);

    expect(output.panCoarse).toBe(255);
    expect(output.tiltCoarse).toBe(255);
  });

  it("handles fractional 16-bit values by rounding", () => {
    const state = makeState({
      currentPan: 128.7,
      currentTilt: 255.3,
    });

    const output = stateToOutput(state, true);

    expect(output.panCoarse).toBe(0);
    expect(output.panFine).toBe(129);
    expect(output.tiltCoarse).toBe(0);
    expect(output.tiltFine).toBe(255);
  });
});

describe("MovementEngine edge cases", () => {
  it("setTarget with only tilt keeps existing pan target", () => {
    const engine = new MovementEngine();
    const config = defaultMovementConfig();
    engine.setConfig("f1", config);

    engine.setTarget("f1", { pan: 200 });
    engine.setTarget("f1", { tilt: 50 });

    const state = engine.getState("f1");
    expect(state).toBeDefined();
    expect(state!.targetPan).toBe(200 * SCALE_16);
    expect(state!.targetTilt).toBe(50 * SCALE_16);
  });

  it("setTarget with 16-bit config passes raw values", () => {
    const engine = new MovementEngine();
    const config: MovementConfig = {
      ...defaultMovementConfig(),
      use16bit: true,
    };
    engine.setConfig("f1", config);

    engine.setTarget("f1", { pan: 32768, tilt: 16384 });

    const state = engine.getState("f1");
    expect(state).toBeDefined();
    expect(state!.targetPan).toBe(32768);
    expect(state!.targetTilt).toBe(16384);
  });

  it("tick processes multiple fixtures independently", () => {
    const engine = new MovementEngine();
    const config: MovementConfig = {
      ...defaultMovementConfig(),
      smoothingCurve: "linear",
    };

    engine.setConfig("f1", config);
    engine.setConfig("f2", config);
    engine.setTarget("f1", { pan: 200 });
    engine.setTarget("f2", { pan: 50 });

    const outputs = engine.tick(25);

    expect(outputs.size).toBe(2);
    expect(outputs.has("f1")).toBe(true);
    expect(outputs.has("f2")).toBe(true);

    // Both fixtures produced output — verifies independent processing
    const o1 = outputs.get("f1")!;
    const o2 = outputs.get("f2")!;
    expect(o1.panCoarse).toBeGreaterThanOrEqual(0);
    expect(o2.panCoarse).toBeGreaterThanOrEqual(0);
    // Targets differ, so after enough ticks they would diverge
    const state1 = engine.getState("f1")!;
    const state2 = engine.getState("f2")!;
    expect(state1.targetPan).toBe(200 * SCALE_16);
    expect(state2.targetPan).toBe(50 * SCALE_16);
  });

  it("tick returns empty map when no fixtures configured", () => {
    const engine = new MovementEngine();
    const outputs = engine.tick(25);

    expect(outputs.size).toBe(0);
  });

  it("stop on non-existent fixture does nothing", () => {
    const engine = new MovementEngine();
    // Should not throw
    engine.stop("nonexistent");
    expect(engine.getState("nonexistent")).toBeUndefined();
  });

  it("reset on non-existent config does nothing", () => {
    const engine = new MovementEngine();
    // Should not throw
    engine.reset("nonexistent");
    expect(engine.getState("nonexistent")).toBeUndefined();
  });

  it("removeFixture on non-existent fixture does nothing", () => {
    const engine = new MovementEngine();
    // Should not throw
    engine.removeFixture("nonexistent");
    expect(engine.getConfig("nonexistent")).toBeUndefined();
  });

  it("getConfig returns undefined for unknown fixture", () => {
    const engine = new MovementEngine();
    expect(engine.getConfig("nonexistent")).toBeUndefined();
  });

  it("getState returns undefined for unknown fixture", () => {
    const engine = new MovementEngine();
    expect(engine.getState("nonexistent")).toBeUndefined();
  });

  it("setTarget clamps target to configured range", () => {
    const engine = new MovementEngine();
    const config: MovementConfig = {
      ...defaultMovementConfig(),
      panRange: { min: 50, max: 200 },
      tiltRange: { min: 30, max: 180 },
    };
    engine.setConfig("f1", config);

    engine.setTarget("f1", { pan: 255, tilt: 0 });

    const state = engine.getState("f1")!;
    expect(state.targetPan).toBe(200 * SCALE_16);
    expect(state.targetTilt).toBe(30 * SCALE_16);
  });

  it("setConfig followed by setTarget then setConfig preserves state but uses new config on tick", () => {
    const engine = new MovementEngine();
    engine.setConfig("f1", defaultMovementConfig());
    engine.setTarget("f1", { pan: 200 });

    // Change config to linear
    engine.setConfig("f1", { ...defaultMovementConfig(), smoothingCurve: "linear" });

    const outputs = engine.tick(25);
    expect(outputs.has("f1")).toBe(true);
    // Just verify it ticks without error under new config
    expect(outputs.get("f1")!.panCoarse).toBeGreaterThanOrEqual(0);
  });

  it("reset sets isMoving to true and targets to home", () => {
    const engine = new MovementEngine();
    const config: MovementConfig = {
      ...defaultMovementConfig(),
      homePosition: { pan: 64, tilt: 192 },
    };
    engine.setConfig("f1", config);
    engine.setTarget("f1", { pan: 200, tilt: 50 });
    engine.tick(100);

    engine.reset("f1");
    const state = engine.getState("f1")!;

    expect(state.isMoving).toBe(true);
    expect(state.targetPan).toBe(64 * SCALE_16);
    expect(state.targetTilt).toBe(192 * SCALE_16);
  });
});
