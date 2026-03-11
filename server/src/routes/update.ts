import type { FastifyInstance } from "fastify";
import type {
  FixtureUpdatePayload,
  FixtureUpdateResponse,
  ColorUpdatePayload,
} from "../types/protocol.js";
import type { UniverseManager } from "../dmx/universe-manager.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import { processColorBatch } from "../fixtures/color-pipeline.js";

const updateSchema = {
  body: {
    type: "object" as const,
    required: ["fixture", "channels"],
    properties: {
      fixture: { type: "string" as const, minLength: 1 },
      channels: {
        type: "object" as const,
        additionalProperties: { type: "number" as const },
      },
    },
  },
};

const colorUpdateSchema = {
  body: {
    type: "object" as const,
    required: ["fixtures"],
    properties: {
      fixtures: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["id", "r", "g", "b", "brightness"],
          properties: {
            id: { type: "string" as const, minLength: 1 },
            r: { type: "integer" as const, minimum: 0, maximum: 255 },
            g: { type: "integer" as const, minimum: 0, maximum: 255 },
            b: { type: "integer" as const, minimum: 0, maximum: 255 },
            brightness: { type: "number" as const, minimum: 0, maximum: 1 },
          },
        },
      },
    },
  },
};

interface UpdateDeps {
  readonly manager: UniverseManager;
  readonly fixtureStore?: FixtureStore;
}

export function registerUpdateRoute(
  app: FastifyInstance,
  deps: UpdateDeps,
): void {
  app.post<{ Body: FixtureUpdatePayload }>(
    "/update",
    { schema: updateSchema, config: { rateLimit: { max: 600, timeWindow: "1 minute" } } },
    async (request): Promise<FixtureUpdateResponse & { blackoutActive?: boolean }> => {
      const { fixture, channels } = request.body;
      const blackoutActive = deps.manager.isBlackoutActive();
      const channelsUpdated = deps.manager.applyFixtureUpdate({
        fixture,
        channels,
      });

      request.log.info(
        { fixture, channelsUpdated },
        `raw update: "${fixture}" ${channelsUpdated} channels`,
      );

      return {
        success: channelsUpdated > 0,
        fixture,
        channelsUpdated,
        ...(blackoutActive ? { blackoutActive } : {}),
      };
    },
  );

  app.post<{ Body: ColorUpdatePayload }>(
    "/update/colors",
    { schema: colorUpdateSchema, config: { rateLimit: { max: 6000, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (deps.fixtureStore === undefined) {
        return reply.status(500).send({ error: "Fixture store not available" });
      }

      if (request.body.fixtures.length > 100) {
        return reply.status(400).send({
          error: `Color update contains ${request.body.fixtures.length} fixtures, maximum is 100`,
        });
      }

      const blackoutActive = deps.manager.isBlackoutActive();
      const result = processColorBatch(
        request.body.fixtures,
        deps.fixtureStore,
        deps.manager,
      );

      request.log.info(
        { fixturesMatched: result.fixturesMatched, channelsUpdated: result.channelsUpdated },
        `color update: ${result.fixturesMatched} fixtures, ${result.channelsUpdated} channels`,
      );

      return {
        success: result.channelsUpdated > 0,
        fixturesUpdated: result.fixturesMatched,
        channelsUpdated: result.channelsUpdated,
        ...(blackoutActive ? { blackoutActive } : {}),
      };
    },
  );
}
