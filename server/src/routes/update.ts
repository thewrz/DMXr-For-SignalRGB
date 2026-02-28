import type { FastifyInstance } from "fastify";
import type {
  FixtureUpdatePayload,
  FixtureUpdateResponse,
  ColorUpdatePayload,
} from "../types/protocol.js";
import type { UniverseManager } from "../dmx/universe-manager.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import { mapColor } from "../fixtures/channel-mapper.js";

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
    { schema: updateSchema },
    async (request): Promise<FixtureUpdateResponse> => {
      const { fixture, channels } = request.body;
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
      };
    },
  );

  app.post<{ Body: ColorUpdatePayload }>(
    "/update/colors",
    { schema: colorUpdateSchema },
    async (request, reply) => {
      if (deps.fixtureStore === undefined) {
        return reply.status(500).send({ error: "Fixture store not available" });
      }

      let totalChannels = 0;
      let fixturesMatched = 0;
      const allUpdates: Record<number, number> = {};

      for (const entry of request.body.fixtures) {
        const fixture = deps.fixtureStore.getById(entry.id);

        if (fixture === undefined) {
          continue;
        }

        fixturesMatched++;

        const channels = mapColor(
          fixture,
          entry.r,
          entry.g,
          entry.b,
          entry.brightness,
        );

        for (const [addr, val] of Object.entries(channels)) {
          allUpdates[Number(addr)] = val;
        }

        totalChannels += Object.keys(channels).length;
      }

      let channelsUpdated = 0;

      if (totalChannels > 0) {
        channelsUpdated = deps.manager.applyFixtureUpdate({
          fixture: "color-batch",
          channels: allUpdates,
        });
      }

      request.log.info(
        { fixturesMatched, channelsUpdated },
        `color update: ${fixturesMatched} fixtures, ${channelsUpdated} channels`,
      );

      return {
        success: channelsUpdated > 0,
        fixturesUpdated: fixturesMatched,
        channelsUpdated,
      };
    },
  );
}
