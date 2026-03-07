import type { FastifyInstance } from "fastify";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { GroupStore } from "../fixtures/group-store.js";
import type { AddFixtureRequest } from "../types/protocol.js";
import { findNextAvailableAddress } from "../fixtures/fixture-validator.js";
import { successResponse, errorResponse } from "./response-helpers.js";

export interface FixtureBatchRouteDeps {
  readonly fixtureStore: FixtureStore;
  readonly groupStore: GroupStore;
}

const batchDeleteSchema = {
  body: {
    type: "object" as const,
    required: ["ids"],
    properties: {
      ids: {
        type: "array" as const,
        items: { type: "string" as const },
        maxItems: 64,
        minItems: 1,
      },
    },
  },
};

const batchDuplicateSchema = {
  body: {
    type: "object" as const,
    required: ["ids"],
    properties: {
      ids: {
        type: "array" as const,
        items: { type: "string" as const },
        maxItems: 32,
        minItems: 1,
      },
      universeId: { type: "string" as const },
    },
  },
};

export function registerFixtureBatchRoutes(
  app: FastifyInstance,
  deps: FixtureBatchRouteDeps,
): void {
  app.delete<{ Body: { ids: string[] } }>(
    "/fixtures/batch",
    { schema: batchDeleteSchema },
    async (request, reply) => {
      const { ids } = request.body;

      const unknown = ids.filter(
        (id) => deps.fixtureStore.getById(id) === undefined,
      );
      if (unknown.length > 0) {
        return reply
          .status(400)
          .send(errorResponse(`Unknown fixture IDs: ${unknown.join(", ")}`));
      }

      for (const id of ids) {
        deps.groupStore.removeFixtureFromAll(id);
      }

      const deleted = deps.fixtureStore.removeBatch(ids);

      await deps.fixtureStore.save();
      deps.groupStore.scheduleSave();

      return reply.status(200).send(
        successResponse({ deleted, count: deleted.length }),
      );
    },
  );

  app.post<{ Body: { ids: string[]; universeId?: string } }>(
    "/fixtures/batch-duplicate",
    { schema: batchDuplicateSchema },
    async (request, reply) => {
      const { ids, universeId } = request.body;

      const sources = ids.map((id) => deps.fixtureStore.getById(id));
      const missingIndex = sources.findIndex((s) => s === undefined);
      if (missingIndex !== -1) {
        return reply
          .status(400)
          .send(errorResponse(`Unknown fixture ID: ${ids[missingIndex]}`));
      }

      // Build requests, finding addresses incrementally.
      // We track "virtual" fixtures to avoid placing duplicates on top of each other.
      const existingFixtures = [...deps.fixtureStore.getAll()];
      const requests: AddFixtureRequest[] = [];

      for (const source of sources) {
        // sources are validated non-undefined above
        const s = source!;
        const targetUniverse = universeId ?? s.universeId;

        const address = findNextAvailableAddress(
          s.channelCount,
          existingFixtures,
          targetUniverse,
        );

        if (address === undefined) {
          return reply
            .status(409)
            .send(
              errorResponse(
                `No available DMX address space for "${s.name}" (needs ${s.channelCount} channels)`,
              ),
            );
        }

        const req: AddFixtureRequest = {
          name: `${s.name} (copy)`,
          mode: s.mode,
          dmxStartAddress: address,
          channelCount: s.channelCount,
          channels: s.channels,
          universeId: targetUniverse,
          ...(s.oflKey ? { oflKey: s.oflKey } : {}),
          ...(s.oflFixtureName ? { oflFixtureName: s.oflFixtureName } : {}),
          ...(s.source ? { source: s.source } : {}),
          ...(s.category ? { category: s.category } : {}),
        };
        requests.push(req);

        // Add virtual fixture so next iteration won't overlap
        existingFixtures.push({
          id: "pending",
          name: req.name,
          mode: req.mode,
          dmxStartAddress: address,
          channelCount: s.channelCount,
          channels: s.channels,
          universeId: targetUniverse,
        });
      }

      const created = deps.fixtureStore.addBatch(requests);
      await deps.fixtureStore.save();

      return reply.status(201).send(created);
    },
  );
}
