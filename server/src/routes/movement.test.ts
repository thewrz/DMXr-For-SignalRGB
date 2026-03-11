import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerMovementRoutes } from "./movement.js";
import { MovementEngine } from "../fixtures/movement-interpolator.js";
import { defaultMovementConfig } from "../fixtures/movement-types.js";
import { createTestFixtureStore, makeTestMovingHead, makeTestPar } from "../test-helpers.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";

const defaultConfig = defaultMovementConfig();

describe("Movement routes", () => {
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

  describe("GET /fixtures/:id/movement", () => {
    it("returns config and state for a mover fixture", async () => {
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
        method: "GET",
        url: `/fixtures/${fixture.id}/movement`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.hasPan).toBe(true);
      expect(body.hasTilt).toBe(true);
      expect(body.config).not.toBeNull();
      expect(body.config.maxVelocity).toBe(50);
    });

    it("returns null config for non-mover fixture", async () => {
      const fixture = store.add(makeTestPar({ dmxStartAddress: 1 }));

      const res = await app.inject({
        method: "GET",
        url: `/fixtures/${fixture.id}/movement`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.hasPan).toBe(false);
      expect(body.hasTilt).toBe(false);
      expect(body.config).toBeNull();
      expect(body.state).toBeNull();
    });

    it("returns 404 for unknown fixture", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/fixtures/nonexistent/movement",
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PATCH /fixtures/:id/movement", () => {
    it("updates config for a mover fixture", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));

      const res = await app.inject({
        method: "PATCH",
        url: `/fixtures/${fixture.id}/movement`,
        payload: { maxVelocity: 100, smoothingCurve: "linear" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.maxVelocity).toBe(100);
      expect(body.smoothingCurve).toBe("linear");
      expect(body.enabled).toBe(true);

      const stored = engine.getConfig(fixture.id);
      expect(stored?.maxVelocity).toBe(100);
    });

    it("returns 404 for unknown fixture", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/fixtures/nonexistent/movement",
        payload: { maxVelocity: 100 },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 for fixture without pan/tilt", async () => {
      const fixture = store.add(makeTestPar({ dmxStartAddress: 1 }));

      const res = await app.inject({
        method: "PATCH",
        url: `/fixtures/${fixture.id}/movement`,
        payload: { maxVelocity: 100 },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("Pan or Tilt");
    });
  });

  describe("POST /fixtures/:id/movement/target", () => {
    it("sets a target position", async () => {
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
        payload: { pan: 200, tilt: 100 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      const state = engine.getState(fixture.id);
      expect(state).not.toBeUndefined();
      expect(state!.isMoving).toBe(true);
    });

    it("returns 404 for unknown fixture", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/nonexistent/movement/target",
        payload: { pan: 128 },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /fixtures/:id/movement/home", () => {
    it("resets to home position", async () => {
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
      engine.setTarget(fixture.id, { pan: 200, tilt: 200 });

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${fixture.id}/movement/home`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      const state = engine.getState(fixture.id);
      expect(state).not.toBeUndefined();
      // Target should be home position (128 * 256 = 32768)
      expect(state!.targetPan).toBe(128 * 256);
      expect(state!.targetTilt).toBe(128 * 256);
    });

    it("returns 404 for unknown fixture", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/nonexistent/movement/home",
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PATCH /fixtures/:id/movement input validation", () => {
    it("rejects maxVelocity of type string", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));
      const res = await app.inject({
        method: "PATCH",
        url: `/fixtures/${fixture.id}/movement`,
        payload: { maxVelocity: "fast" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects negative maxVelocity", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));
      const res = await app.inject({
        method: "PATCH",
        url: `/fixtures/${fixture.id}/movement`,
        payload: { maxVelocity: -10 },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects invalid smoothingCurve", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));
      const res = await app.inject({
        method: "PATCH",
        url: `/fixtures/${fixture.id}/movement`,
        payload: { smoothingCurve: "cubic-bezier" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects invalid preset", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));
      const res = await app.inject({
        method: "PATCH",
        url: `/fixtures/${fixture.id}/movement`,
        payload: { preset: "disco-ball" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("strips unknown properties silently", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));
      const res = await app.inject({
        method: "PATCH",
        url: `/fixtures/${fixture.id}/movement`,
        payload: { hackField: true, maxVelocity: 80 },
      });
      // Fastify strips unknown props rather than rejecting — verify valid fields still work
      expect(res.statusCode).toBe(200);
      expect(res.json().maxVelocity).toBe(80);
    });

    it("rejects maxVelocity above 1000", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));
      const res = await app.inject({
        method: "PATCH",
        url: `/fixtures/${fixture.id}/movement`,
        payload: { maxVelocity: 9999 },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /fixtures/:id/movement/target input validation", () => {
    it("rejects non-numeric pan", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));
      engine.setConfig(fixture.id, {
        ...defaultConfig,
      });
      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${fixture.id}/movement/target`,
        payload: { pan: "left" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects pan above 255", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));
      engine.setConfig(fixture.id, {
        ...defaultConfig,
      });
      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${fixture.id}/movement/target`,
        payload: { pan: 999 },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects speed above 1", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));
      engine.setConfig(fixture.id, {
        ...defaultConfig,
      });
      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${fixture.id}/movement/target`,
        payload: { pan: 128, speed: 5 },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects negative pan", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));
      engine.setConfig(fixture.id, {
        ...defaultConfig,
      });
      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${fixture.id}/movement/target`,
        payload: { pan: -1 },
      });
      expect(res.statusCode).toBe(400);
    });

    it("strips unknown properties silently", async () => {
      const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));
      engine.setConfig(fixture.id, {
        ...defaultConfig,
      });
      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${fixture.id}/movement/target`,
        payload: { pan: 128, inject: true },
      });
      // Fastify strips unknown props — valid fields still processed
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });

  describe("POST /fixtures/:id/movement/stop", () => {
    it("freezes at current position", async () => {
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
      engine.setTarget(fixture.id, { pan: 200, tilt: 200 });

      const res = await app.inject({
        method: "POST",
        url: `/fixtures/${fixture.id}/movement/stop`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      const state = engine.getState(fixture.id);
      expect(state).not.toBeUndefined();
      expect(state!.isMoving).toBe(false);
    });

    it("returns 404 for unknown fixture", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/fixtures/nonexistent/movement/stop",
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
