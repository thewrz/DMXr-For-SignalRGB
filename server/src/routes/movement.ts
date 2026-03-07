import type { FastifyInstance } from "fastify";
import type { MovementEngine } from "../fixtures/movement-interpolator.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { MovementConfig } from "../fixtures/movement-types.js";
import { analyzeFixture } from "../fixtures/fixture-capabilities.js";

interface MovementRouteDeps {
  readonly movementEngine: MovementEngine;
  readonly fixtureStore: FixtureStore;
}

export function registerMovementRoutes(
  app: FastifyInstance,
  deps: MovementRouteDeps,
): void {
  app.get<{ Params: { id: string } }>(
    "/fixtures/:id/movement",
    async (request, reply) => {
      const fixture = deps.fixtureStore.getById(request.params.id);
      if (!fixture) {
        return reply.status(404).send({ success: false, error: "Fixture not found" });
      }

      const caps = analyzeFixture(fixture.channels);
      const config = deps.movementEngine.getConfig(request.params.id) ?? null;
      const state = deps.movementEngine.getState(request.params.id) ?? null;

      return {
        config,
        state,
        hasPan: caps.hasPan,
        hasTilt: caps.hasTilt,
      };
    },
  );

  app.patch<{ Params: { id: string }; Body: Partial<MovementConfig> }>(
    "/fixtures/:id/movement",
    async (request, reply) => {
      const fixture = deps.fixtureStore.getById(request.params.id);
      if (!fixture) {
        return reply.status(404).send({ success: false, error: "Fixture not found" });
      }

      const caps = analyzeFixture(fixture.channels);
      if (!caps.hasPan && !caps.hasTilt) {
        return reply.status(400).send({
          success: false,
          error: "Fixture has no Pan or Tilt channels",
        });
      }

      const existing = deps.movementEngine.getConfig(request.params.id);
      const merged: MovementConfig = {
        enabled: true,
        maxVelocity: 50,
        maxAcceleration: 100,
        smoothingCurve: "ease-in-out",
        panRange: { min: 0, max: 255 },
        tiltRange: { min: 0, max: 255 },
        use16bit: caps.hasPanFine || caps.hasTiltFine,
        homePosition: { pan: 128, tilt: 128 },
        preset: "moving-head",
        ...existing,
        ...request.body,
      };

      deps.movementEngine.setConfig(request.params.id, merged);
      deps.fixtureStore.update(request.params.id, { movementConfig: merged });
      deps.fixtureStore.scheduleSave();

      return merged;
    },
  );

  app.post<{ Params: { id: string }; Body: { pan?: number; tilt?: number; speed?: number } }>(
    "/fixtures/:id/movement/target",
    async (request, reply) => {
      const fixture = deps.fixtureStore.getById(request.params.id);
      if (!fixture) {
        return reply.status(404).send({ success: false, error: "Fixture not found" });
      }

      deps.movementEngine.setTarget(request.params.id, request.body);
      return { success: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/fixtures/:id/movement/home",
    async (request, reply) => {
      const fixture = deps.fixtureStore.getById(request.params.id);
      if (!fixture) {
        return reply.status(404).send({ success: false, error: "Fixture not found" });
      }

      deps.movementEngine.reset(request.params.id);
      return { success: true };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/fixtures/:id/movement/stop",
    async (request, reply) => {
      const fixture = deps.fixtureStore.getById(request.params.id);
      if (!fixture) {
        return reply.status(404).send({ success: false, error: "Fixture not found" });
      }

      deps.movementEngine.stop(request.params.id);
      return { success: true };
    },
  );
}
