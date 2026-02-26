import type { FastifyInstance } from "fastify";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { AddFixtureRequest } from "../types/protocol.js";
import { validateFixtureAddress } from "../fixtures/fixture-validator.js";

interface FixtureRouteDeps {
  readonly store: FixtureStore;
}

const addFixtureSchema = {
  body: {
    type: "object" as const,
    required: [
      "name",
      "oflKey",
      "oflFixtureName",
      "mode",
      "dmxStartAddress",
      "channelCount",
      "channels",
    ],
    properties: {
      name: { type: "string" as const, minLength: 1 },
      oflKey: { type: "string" as const, minLength: 1 },
      oflFixtureName: { type: "string" as const, minLength: 1 },
      mode: { type: "string" as const, minLength: 1 },
      dmxStartAddress: { type: "integer" as const, minimum: 1, maximum: 512 },
      channelCount: { type: "integer" as const, minimum: 1 },
      channels: {
        type: "array" as const,
        items: {
          type: "object" as const,
          required: ["offset", "name", "type", "defaultValue"],
          properties: {
            offset: { type: "integer" as const, minimum: 0 },
            name: { type: "string" as const },
            type: { type: "string" as const },
            color: { type: "string" as const },
            defaultValue: { type: "integer" as const, minimum: 0, maximum: 255 },
          },
        },
      },
    },
  },
};

export function registerFixtureRoutes(
  app: FastifyInstance,
  deps: FixtureRouteDeps,
): void {
  app.get("/fixtures", async () => {
    return deps.store.getAll();
  });

  app.post<{ Body: AddFixtureRequest }>(
    "/fixtures",
    { schema: addFixtureSchema },
    async (request, reply) => {
      const body = request.body;
      const channelCount = body.channels.length;

      if (body.channelCount !== channelCount) {
        return reply.status(400).send({
          success: false,
          error: `channelCount (${body.channelCount}) does not match channels array length (${channelCount})`,
        });
      }

      const validation = validateFixtureAddress(
        body.dmxStartAddress,
        channelCount,
        deps.store.getAll(),
      );

      if (!validation.valid) {
        return reply.status(409).send({
          success: false,
          error: validation.error,
        });
      }

      const fixture = deps.store.add(body);
      await deps.store.save();

      return reply.status(201).send(fixture);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/fixtures/:id",
    async (request, reply) => {
      const removed = deps.store.remove(request.params.id);

      if (!removed) {
        return reply.status(404).send({
          success: false,
          error: "Fixture not found",
        });
      }

      await deps.store.save();

      return { success: true };
    },
  );
}
