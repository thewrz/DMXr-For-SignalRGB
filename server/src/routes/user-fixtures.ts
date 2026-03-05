import type { FastifyInstance } from "fastify";
import type { UserFixtureStore } from "../fixtures/user-fixture-store.js";
import type { CreateUserFixtureRequest, UpdateUserFixtureRequest } from "../fixtures/user-fixture-types.js";
import { validateUserFixtureTemplate } from "../fixtures/user-fixture-validator.js";

interface UserFixtureRouteDeps {
  readonly store: UserFixtureStore;
}

const channelSchema = {
  type: "object" as const,
  required: ["offset", "name", "type", "defaultValue"],
  properties: {
    offset: { type: "integer" as const, minimum: 0 },
    name: { type: "string" as const },
    type: { type: "string" as const },
    color: { type: "string" as const },
    defaultValue: { type: "integer" as const, minimum: 0, maximum: 255 },
    rangeMin: { type: "integer" as const, minimum: 0, maximum: 255 },
    rangeMax: { type: "integer" as const, minimum: 0, maximum: 255 },
  },
};

const modeSchema = {
  type: "object" as const,
  required: ["name", "channels"],
  properties: {
    name: { type: "string" as const, minLength: 1 },
    channels: {
      type: "array" as const,
      items: channelSchema,
      minItems: 1,
    },
  },
};

const createSchema = {
  body: {
    type: "object" as const,
    required: ["name", "manufacturer", "category", "modes"],
    properties: {
      name: { type: "string" as const, minLength: 1 },
      manufacturer: { type: "string" as const, minLength: 1 },
      category: { type: "string" as const },
      modes: {
        type: "array" as const,
        items: modeSchema,
        minItems: 1,
      },
    },
  },
};

const updateSchema = {
  body: {
    type: "object" as const,
    properties: {
      name: { type: "string" as const, minLength: 1 },
      manufacturer: { type: "string" as const, minLength: 1 },
      category: { type: "string" as const },
      modes: {
        type: "array" as const,
        items: modeSchema,
        minItems: 1,
      },
    },
  },
};

export function registerUserFixtureRoutes(
  app: FastifyInstance,
  deps: UserFixtureRouteDeps,
): void {
  app.get("/user-fixtures", async () => {
    return deps.store.getAll();
  });

  app.post<{ Body: CreateUserFixtureRequest }>(
    "/user-fixtures",
    { schema: createSchema },
    async (request, reply) => {
      const validation = validateUserFixtureTemplate(request.body);
      if (!validation.valid) {
        return reply.status(400).send({ success: false, error: validation.error });
      }

      const template = deps.store.add(request.body);
      await deps.store.save();
      return reply.status(201).send(template);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/user-fixtures/:id",
    async (request, reply) => {
      const template = deps.store.getById(request.params.id);
      if (!template) {
        return reply.status(404).send({ success: false, error: "Template not found" });
      }
      return template;
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateUserFixtureRequest }>(
    "/user-fixtures/:id",
    { schema: updateSchema },
    async (request, reply) => {
      const existing = deps.store.getById(request.params.id);
      if (!existing) {
        return reply.status(404).send({ success: false, error: "Template not found" });
      }

      const validation = validateUserFixtureTemplate(request.body);
      if (!validation.valid) {
        return reply.status(400).send({ success: false, error: validation.error });
      }

      const updated = deps.store.update(request.params.id, request.body);
      deps.store.scheduleSave();
      return reply.status(200).send(updated);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/user-fixtures/:id",
    async (request, reply) => {
      const removed = deps.store.remove(request.params.id);
      if (!removed) {
        return reply.status(404).send({ success: false, error: "Template not found" });
      }

      await deps.store.save();
      return { success: true };
    },
  );
}
