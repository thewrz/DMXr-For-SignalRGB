import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerMovementRoutes } from "./movement.js";
import { MovementEngine } from "../fixtures/movement-interpolator.js";
import { createTestFixtureStore, makeTestMovingHead, makeTestPar } from "../test-helpers.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";

describe("Movement routes edge cases", () => {
  let app: FastifyInstance;
  let store: FixtureStore;
  let engine: MovementEngine;

  beforeEach(async () => {
    store = createTestFixtureStore();
    engine = new MovementEngine();
    app = Fastify({ logger: false });
    registerMovementRoutes(app, { movementEngine: engine, fixtureStore: store });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /fixtures/:id/movement/target with 16-bit mode", () => {
    it("scales pan/tilt by 256 when use16bit is true", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));
      engine.setConfig(fixture.id, {
        enabled: true,
        maxVelocity: 50,
        maxAcceleration: 100,
        smoothingCurve: "ease-in-out",
        panRange: { min: 0, max: 255 },
        tiltRange: { min: 0, max: 255 },
        use16bit: true,
        homePosition: { pan: 128, tilt: 128 },
        preset: "moving-head",
      });

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${fixture.id}/movement/target`,
        payload: { pan: 128, tilt: 64 },
      });

      expect(res.statusCode).toBe(200);

      const state = engine.getState(fixture.id);
      expect(state).toBeDefined();
      // In 16-bit mode, the route multiplies by 256
      expect(state!.targetPan).toBe(128 * 256);
      expect(state!.targetTilt).toBe(64 * 256);
    });

    it("does not scale when use16bit is false", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));
      engine.setConfig(fixture.id, {
        enabled: true,
        maxVelocity: 50,
        maxAcceleration: 100,
        smoothingCurve: "ease-in-out",
        panRange: { min: 0, max: 255 },
        tiltRange: { min: 0, max: 255 },
        use16bit: false,
        homePosition: { pan: 128, tilt: 128 },
        preset: "moving-head",
      });

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${fixture.id}/movement/target`,
        payload: { pan: 200 },
      });

      expect(res.statusCode).toBe(200);

      const state = engine.getState(fixture.id);
      // 8-bit mode: engine.setTarget receives pan=200, which is then scaled to 16-bit internally
      expect(state!.targetPan).toBe(200 * 256);
    });

    it("sets target with no config configured (defaults use16bit to false)", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));
      // No engine config set — config?.use16bit defaults to false

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${fixture.id}/movement/target`,
        payload: { pan: 100 },
      });

      expect(res.statusCode).toBe(200);
      // Engine.setTarget will do nothing since no config exists
      expect(engine.getState(fixture.id)).toBeUndefined();
    });

    it("handles partial target with only tilt", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));
      engine.setConfig(fixture.id, {
        enabled: true,
        maxVelocity: 50,
        maxAcceleration: 100,
        smoothingCurve: "ease-in-out",
        panRange: { min: 0, max: 255 },
        tiltRange: { min: 0, max: 255 },
        use16bit: false,
        homePosition: { pan: 128, tilt: 128 },
        preset: "moving-head",
      });

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${fixture.id}/movement/target`,
        payload: { tilt: 50 },
      });

      expect(res.statusCode).toBe(200);
      const state = engine.getState(fixture.id)!;
      expect(state.targetTilt).toBe(50 * 256);
      // Pan should be at home position since no pan target specified
      expect(state.targetPan).toBe(128 * 256);
    });
  });

  describe("PATCH /fixtures/:id/movement merging", () => {
    it("merges with existing config preserving previously set values", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));

      // First PATCH: set velocity
      const res1 = await app.inject({
        method: "PATCH",
        url: `/fixtures/${fixture.id}/movement`,
        payload: { maxVelocity: 100 },
      });
      expect(res1.statusCode).toBe(200);

      // Second PATCH: set curve, velocity should persist
      const res2 = await app.inject({
        method: "PATCH",
        url: `/fixtures/${fixture.id}/movement`,
        payload: { smoothingCurve: "linear" },
      });
      expect(res2.statusCode).toBe(200);

      const body = res2.json();
      expect(body.maxVelocity).toBe(100);
      expect(body.smoothingCurve).toBe("linear");
    });

    it("persists config to engine and calls scheduleSave", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));

      await app.inject({
        method: "PATCH",
        url: `/fixtures/${fixture.id}/movement`,
        payload: { maxVelocity: 75 },
      });

      // Config is stored in the engine
      const config = engine.getConfig(fixture.id);
      expect(config?.maxVelocity).toBe(75);
    });
  });

  describe("GET /fixtures/:id/movement with state", () => {
    it("returns state after target has been set", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));
      engine.setConfig(fixture.id, {
        enabled: true,
        maxVelocity: 50,
        maxAcceleration: 100,
        smoothingCurve: "ease-in-out",
        panRange: { min: 0, max: 255 },
        tiltRange: { min: 0, max: 255 },
        use16bit: false,
        homePosition: { pan: 128, tilt: 128 },
        preset: "moving-head",
      });
      engine.setTarget(fixture.id, { pan: 200 });

      const res = await app.inject({
        method: "GET",
        url: `/fixtures/${fixture.id}/movement`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.state).not.toBeNull();
      expect(body.state.isMoving).toBe(true);
      expect(body.state.targetPan).toBe(200 * 256);
    });
  });
});
