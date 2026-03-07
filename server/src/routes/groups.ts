import type { FastifyInstance } from "fastify";
import type { GroupStore } from "../fixtures/group-store.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { AddGroupRequest, UpdateGroupRequest } from "../types/protocol.js";
import { successResponse, errorResponse } from "./response-helpers.js";

export interface GroupRouteDeps {
  readonly groupStore: GroupStore;
  readonly fixtureStore: FixtureStore;
}

const addGroupSchema = {
  body: {
    type: "object" as const,
    required: ["name", "fixtureIds"],
    properties: {
      name: { type: "string" as const, minLength: 1 },
      fixtureIds: {
        type: "array" as const,
        items: { type: "string" as const },
      },
      color: { type: "string" as const },
    },
  },
};

const updateGroupSchema = {
  body: {
    type: "object" as const,
    properties: {
      name: { type: "string" as const, minLength: 1 },
      fixtureIds: {
        type: "array" as const,
        items: { type: "string" as const },
      },
      color: { type: "string" as const },
    },
  },
};

export function registerGroupRoutes(
  app: FastifyInstance,
  deps: GroupRouteDeps,
): void {
  app.get("/groups", async () => {
    return deps.groupStore.getAll();
  });

  app.post<{ Body: AddGroupRequest }>(
    "/groups",
    { schema: addGroupSchema },
    async (request, reply) => {
      const body = request.body;

      const missingIds = body.fixtureIds.filter(
        (id) => deps.fixtureStore.getById(id) === undefined,
      );
      if (missingIds.length > 0) {
        return reply
          .status(400)
          .send(errorResponse(`Unknown fixture IDs: ${missingIds.join(", ")}`));
      }

      try {
        const group = deps.groupStore.add(body);
        await deps.groupStore.save();
        return reply.status(201).send(group);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create group";
        return reply.status(400).send(errorResponse(message));
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/groups/:id",
    async (request, reply) => {
      const group = deps.groupStore.getById(request.params.id);
      if (!group) {
        return reply
          .status(404)
          .send(errorResponse("Group not found"));
      }
      return group;
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateGroupRequest }>(
    "/groups/:id",
    { schema: updateGroupSchema },
    async (request, reply) => {
      const body = request.body;

      if (body.fixtureIds !== undefined) {
        const missingIds = body.fixtureIds.filter(
          (id) => deps.fixtureStore.getById(id) === undefined,
        );
        if (missingIds.length > 0) {
          return reply
            .status(400)
            .send(errorResponse(`Unknown fixture IDs: ${missingIds.join(", ")}`));
        }
      }

      try {
        const updated = deps.groupStore.update(request.params.id, body);
        if (!updated) {
          return reply
            .status(404)
            .send(errorResponse("Group not found"));
        }
        deps.groupStore.scheduleSave();
        return reply.status(200).send(updated);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update group";
        return reply.status(400).send(errorResponse(message));
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/groups/:id",
    async (request, reply) => {
      const removed = deps.groupStore.remove(request.params.id);
      if (!removed) {
        return reply
          .status(404)
          .send(errorResponse("Group not found"));
      }
      await deps.groupStore.save();
      return successResponse({});
    },
  );
}
