import type { FastifyInstance, FastifyReply } from "fastify";
import type { LibraryRegistry, FixtureLibraryProvider } from "../libraries/types.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import { validateFixtureAddress, validateFixtureChannels } from "../fixtures/fixture-validator.js";

interface LibraryRouteDeps {
  readonly registry: LibraryRegistry;
  readonly store: FixtureStore;
}

const importSchema = {
  body: {
    type: "object" as const,
    required: ["name", "dmxStartAddress"],
    properties: {
      name: { type: "string" as const, minLength: 1 },
      dmxStartAddress: { type: "integer" as const, minimum: 1, maximum: 512 },
    },
  },
};

function classifyDbError(error: unknown): { status: number; message: string } {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (lower.includes("malformed") || lower.includes("corrupt") || lower.includes("not a database")) {
    return { status: 503, message: "Database is corrupt" };
  }
  if (lower.includes("busy") || lower.includes("locked")) {
    return { status: 503, message: "Database is locked — close any applications using it and retry" };
  }
  if (lower.includes("enoent") || lower.includes("no such file")) {
    return { status: 503, message: "Database file not found" };
  }
  return { status: 500, message: `Database error: ${msg}` };
}

function handleDbError(error: unknown, reply: FastifyReply): void {
  const { status, message } = classifyDbError(error);
  reply.log.error(`Library DB error: ${message}`);
  reply.status(status).send({ error: message });
}

function requireProvider(
  registry: LibraryRegistry,
  id: string,
  reply: FastifyReply,
): FixtureLibraryProvider | null {
  const provider = registry.getById(id);
  if (!provider) {
    reply.status(404).send({ error: "Library not found" });
    return null;
  }
  if (!provider.status().available) {
    reply.status(503).send({
      error: "Library not available",
      state: provider.status().state,
    });
    return null;
  }
  return provider;
}

export function registerLibraryRoutes(
  app: FastifyInstance,
  deps: LibraryRouteDeps,
): void {
  // List all libraries with their status
  app.get("/libraries", async () => {
    return deps.registry.getAll().map((p) => ({
      id: p.id,
      displayName: p.displayName,
      description: p.description,
      type: p.type,
      status: p.status(),
    }));
  });

  // Get manufacturers for a library
  app.get<{ Params: { id: string } }>(
    "/libraries/:id/manufacturers",
    async (request, reply) => {
      const provider = requireProvider(deps.registry, request.params.id, reply);
      if (!provider) return;
      try {
        return provider.getManufacturers();
      } catch (error) {
        handleDbError(error, reply);
      }
    },
  );

  // Get fixtures for a manufacturer within a library
  app.get<{ Params: { id: string; mfrId: string } }>(
    "/libraries/:id/manufacturers/:mfrId/fixtures",
    async (request, reply) => {
      const provider = requireProvider(deps.registry, request.params.id, reply);
      if (!provider) return;
      const mfrId = parseInt(request.params.mfrId, 10);
      if (!Number.isFinite(mfrId)) {
        return reply.status(400).send({ error: "Invalid manufacturer ID" });
      }
      try {
        return provider.getFixtures(mfrId);
      } catch (error) {
        handleDbError(error, reply);
      }
    },
  );

  // Get modes for a fixture within a library
  app.get<{ Params: { id: string; fid: string } }>(
    "/libraries/:id/fixtures/:fid/modes",
    async (request, reply) => {
      const provider = requireProvider(deps.registry, request.params.id, reply);
      if (!provider) return;
      const fid = parseInt(request.params.fid, 10);
      if (!Number.isFinite(fid)) {
        return reply.status(400).send({ error: "Invalid fixture ID" });
      }
      try {
        const modes = provider.getFixtureModes(fid);
        return { fixtureId: fid, modes };
      } catch (error) {
        handleDbError(error, reply);
      }
    },
  );

  // Get channels for a mode within a library
  app.get<{ Params: { id: string; fid: string; mid: string } }>(
    "/libraries/:id/fixtures/:fid/modes/:mid/channels",
    async (request, reply) => {
      const provider = requireProvider(deps.registry, request.params.id, reply);
      if (!provider) return;
      const mid = parseInt(request.params.mid, 10);
      if (!Number.isFinite(mid)) {
        return reply.status(400).send({ error: "Invalid mode ID" });
      }
      try {
        return provider.getModeChannels(mid);
      } catch (error) {
        handleDbError(error, reply);
      }
    },
  );

  // Import a fixture from a library
  app.post<{
    Params: { id: string; fid: string; mid: string };
    Body: { name: string; dmxStartAddress: number };
  }>(
    "/libraries/:id/fixtures/:fid/modes/:mid/import",
    { schema: importSchema },
    async (request, reply) => {
      const provider = requireProvider(deps.registry, request.params.id, reply);
      if (!provider) return;

      const fixtureId = parseInt(request.params.fid, 10);
      if (!Number.isFinite(fixtureId)) {
        return reply.status(400).send({ error: "Invalid fixture ID" });
      }

      const modeId = parseInt(request.params.mid, 10);
      if (!Number.isFinite(modeId)) {
        return reply.status(400).send({ error: "Invalid mode ID" });
      }

      let channels: readonly import("../types/protocol.js").FixtureChannel[];
      try {
        channels = provider.getModeChannels(modeId);
      } catch (error) {
        handleDbError(error, reply);
        return;
      }

      if (channels.length === 0) {
        return reply
          .status(404)
          .send({ error: "No channels found for this mode" });
      }

      const channelValidation = validateFixtureChannels(channels, channels.length);
      if (!channelValidation.valid) {
        return reply.status(400).send({
          success: false,
          error: channelValidation.error,
        });
      }

      let modeName: string;
      try {
        const modes = provider.getFixtureModes(fixtureId);
        const mode = modes.find((m) => m.id === modeId);
        modeName = mode ? mode.name : `Mode ${modeId}`;
      } catch (error) {
        handleDbError(error, reply);
        return;
      }

      const validation = validateFixtureAddress(
        request.body.dmxStartAddress,
        channels.length,
        deps.store.getAll(),
      );

      if (!validation.valid) {
        return reply.status(409).send({
          success: false,
          error: validation.error,
        });
      }

      const fixture = deps.store.add({
        name: request.body.name,
        source: provider.id as "local-db",
        mode: modeName,
        dmxStartAddress: request.body.dmxStartAddress,
        channelCount: channels.length,
        channels,
      });

      await deps.store.save();

      return reply.status(201).send(fixture);
    },
  );
}
