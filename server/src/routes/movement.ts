import type { FastifyInstance } from "fastify";
import type { MovementEngine } from "../fixtures/movement-interpolator.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { MovementConfig } from "../fixtures/movement-types.js";
import { analyzeFixture } from "../fixtures/fixture-capabilities.js";

interface MovementRouteDeps {
  readonly movementEngine: MovementEngine;
  readonly fixtureStore: FixtureStore;
}

const rangeSchema = {
  type: "object" as const,
  properties: {
    min: { type: "integer" as const, minimum: 0, maximum: 255 },
    max: { type: "integer" as const, minimum: 0, maximum: 255 },
  },
  required: ["min" as const, "max" as const],
  additionalProperties: false,
};

const movementConfigSchema = {
  schema: {
    body: {
      type: "object" as const,
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean" as const },
        maxVelocity: { type: "number" as const, minimum: 0, maximum: 1000 },
        maxAcceleration: { type: "number" as const, minimum: 0, maximum: 10000 },
        smoothingCurve: { type: "string" as const, enum: ["linear", "ease-in-out", "s-curve"] },
        panRange: rangeSchema,
        tiltRange: rangeSchema,
        use16bit: { type: "boolean" as const },
        homePosition: {
          type: "object" as const,
          properties: {
            pan: { type: "integer" as const, minimum: 0, maximum: 255 },
            tilt: { type: "integer" as const, minimum: 0, maximum: 255 },
          },
          required: ["pan" as const, "tilt" as const],
          additionalProperties: false,
        },
        preset: { type: "string" as const, enum: ["moving-head", "scanner", "laser", "custom"] },
      },
    },
  },
};

const movementTargetSchema = {
  schema: {
    body: {
      type: "object" as const,
      additionalProperties: false,
      properties: {
        pan: { type: "number" as const, minimum: 0, maximum: 255 },
        tilt: { type: "number" as const, minimum: 0, maximum: 255 },
        speed: { type: "number" as const, minimum: 0, maximum: 1 },
      },
    },
  },
};

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
    movementConfigSchema,
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
    movementTargetSchema,
    async (request, reply) => {
      const fixture = deps.fixtureStore.getById(request.params.id);
      if (!fixture) {
        return reply.status(404).send({ success: false, error: "Fixture not found" });
      }

      const config = deps.movementEngine.getConfig(request.params.id);
      const use16bit = config?.use16bit ?? false;
      const target = {
        pan: request.body.pan !== undefined
          ? (use16bit ? request.body.pan * 256 : request.body.pan)
          : undefined,
        tilt: request.body.tilt !== undefined
          ? (use16bit ? request.body.tilt * 256 : request.body.tilt)
          : undefined,
        speed: request.body.speed,
      };

      deps.movementEngine.setTarget(request.params.id, target);
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
