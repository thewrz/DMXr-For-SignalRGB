import type { FastifyInstance } from "fastify";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { AddFixtureRequest, UpdateFixtureRequest } from "../types/protocol.js";
import { validateFixtureAddress, validateFixtureChannels } from "../fixtures/fixture-validator.js";

interface FixtureRouteDeps {
  readonly store: FixtureStore;
}

const addFixtureSchema = {
  body: {
    type: "object" as const,
    required: [
      "name",
      "mode",
      "dmxStartAddress",
      "channelCount",
      "channels",
    ],
    properties: {
      name: { type: "string" as const, minLength: 1 },
      oflKey: { type: "string" as const },
      oflFixtureName: { type: "string" as const },
      source: { type: "string" as const, enum: ["ofl", "local-db", "custom"] },
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

      const channelValidation = validateFixtureChannels(body.channels, body.channelCount);
      if (!channelValidation.valid) {
        return reply.status(400).send({
          success: false,
          error: channelValidation.error,
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

  app.patch<{ Params: { id: string }; Body: UpdateFixtureRequest }>(
    "/fixtures/:id",
    {
      schema: {
        body: {
          type: "object" as const,
          properties: {
            name: { type: "string" as const, minLength: 1 },
            dmxStartAddress: { type: "integer" as const, minimum: 1, maximum: 512 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const existing = deps.store.getById(request.params.id);
      if (!existing) {
        return reply.status(404).send({ success: false, error: "Fixture not found" });
      }

      if (request.body.dmxStartAddress !== undefined) {
        const validation = validateFixtureAddress(
          request.body.dmxStartAddress,
          existing.channelCount,
          deps.store.getAll(),
          existing.id,
        );
        if (!validation.valid) {
          return reply.status(409).send({ success: false, error: validation.error });
        }
      }

      const updated = deps.store.update(request.params.id, request.body);
      await deps.store.save();

      return reply.status(200).send(updated);
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
