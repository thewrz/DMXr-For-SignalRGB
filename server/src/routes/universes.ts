import type { FastifyInstance } from "fastify";
import type { UniverseRegistry } from "../dmx/universe-registry.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";

interface UniverseRouteDeps {
  readonly registry: UniverseRegistry;
  readonly fixtureStore: FixtureStore;
}

const createSchema = {
  body: {
    type: "object" as const,
    required: ["name", "devicePath", "driverType"],
    properties: {
      name: { type: "string" as const, minLength: 1 },
      devicePath: { type: "string" as const, minLength: 1 },
      driverType: { type: "string" as const, minLength: 1 },
      serialNumber: { type: "string" as const },
    },
  },
};

const updateSchema = {
  body: {
    type: "object" as const,
    properties: {
      name: { type: "string" as const, minLength: 1 },
      devicePath: { type: "string" as const, minLength: 1 },
      driverType: { type: "string" as const, minLength: 1 },
      serialNumber: { type: "string" as const },
    },
  },
};

export function registerUniverseRoutes(
  app: FastifyInstance,
  deps: UniverseRouteDeps,
): void {
  app.get("/universes", async () => {
    return deps.registry.getAll();
  });

  app.get<{ Params: { id: string } }>("/universes/:id", async (req, reply) => {
    const universe = deps.registry.getById(req.params.id);
    if (!universe) {
      return reply.status(404).send({ error: "Universe not found" });
    }
    return universe;
  });

  app.post<{ Body: { name: string; devicePath: string; driverType: string; serialNumber?: string } }>(
    "/universes",
    { schema: createSchema },
    async (req, reply) => {
      try {
        const universe = deps.registry.add(req.body);
        await deps.registry.save();
        return reply.status(201).send(universe);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("already exists") || message.includes("already assigned")) {
          return reply.status(409).send({ error: message });
        }
        return reply.status(400).send({ error: message });
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: { name?: string; devicePath?: string; driverType?: string; serialNumber?: string } }>(
    "/universes/:id",
    { schema: updateSchema },
    async (req, reply) => {
      try {
        const updated = deps.registry.update(req.params.id, req.body);
        if (!updated) {
          return reply.status(404).send({ error: "Universe not found" });
        }
        await deps.registry.save();
        return updated;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.status(409).send({ error: message });
      }
    },
  );

  app.delete<{ Params: { id: string } }>("/universes/:id", async (req, reply) => {
    try {
      const orphans = deps.fixtureStore.getByUniverse(req.params.id);
      if (orphans.length > 0) {
        return reply.status(409).send({
          error: `Cannot delete universe with ${orphans.length} assigned fixture(s). Reassign them first.`,
        });
      }

      const removed = deps.registry.remove(req.params.id);
      if (!removed) {
        return reply.status(404).send({ error: "Universe not found" });
      }
      await deps.registry.save();
      return reply.status(204).send();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(400).send({ error: message });
    }
  });

  app.get<{ Params: { id: string } }>("/universes/:id/fixtures", async (req, reply) => {
    const universe = deps.registry.getById(req.params.id);
    if (!universe) {
      return reply.status(404).send({ error: "Universe not found" });
    }
    return deps.fixtureStore.getByUniverse(req.params.id);
  });
}
