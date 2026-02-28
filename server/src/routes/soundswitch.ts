import type { FastifyInstance, FastifyReply } from "fastify";
import type { SsClient, SsStatus } from "../soundswitch/ss-client.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import { validateFixtureAddress, validateFixtureChannels } from "../fixtures/fixture-validator.js";

interface SoundswitchRouteDeps {
  readonly ssClient: SsClient | null;
  readonly ssStatus: SsStatus;
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
    return { status: 503, message: "SoundSwitch database is corrupt" };
  }
  if (lower.includes("busy") || lower.includes("locked")) {
    return { status: 503, message: "SoundSwitch database is locked — close SoundSwitch and retry" };
  }
  if (lower.includes("enoent") || lower.includes("no such file")) {
    return { status: 503, message: "SoundSwitch database file not found" };
  }
  return { status: 500, message: `SoundSwitch database error: ${msg}` };
}

function handleDbError(error: unknown, reply: FastifyReply): void {
  const { status, message } = classifyDbError(error);
  reply.log.error(`SoundSwitch DB error: ${message}`);
  reply.status(status).send({ error: message });
}

function requireClient(
  deps: SoundswitchRouteDeps,
  reply: FastifyReply,
): SsClient | null {
  if (deps.ssClient === null) {
    reply.status(503).send({
      error: "SoundSwitch is not available",
      state: deps.ssStatus.state,
    });
    return null;
  }
  return deps.ssClient;
}

export function registerSoundswitchRoutes(
  app: FastifyInstance,
  deps: SoundswitchRouteDeps,
): void {
  // Status endpoint — always registered
  app.get("/soundswitch/status", async (): Promise<SsStatus> => {
    return deps.ssStatus;
  });

  app.get("/soundswitch/manufacturers", async (_request, reply) => {
    const client = requireClient(deps, reply);
    if (!client) return;
    try {
      return client.getManufacturers();
    } catch (error) {
      handleDbError(error, reply);
    }
  });

  app.get<{ Params: { id: string } }>(
    "/soundswitch/manufacturers/:id/fixtures",
    async (request, reply) => {
      const client = requireClient(deps, reply);
      if (!client) return;
      const id = parseInt(request.params.id, 10);
      if (!Number.isFinite(id)) {
        return reply.status(400).send({ error: "Invalid manufacturer ID" });
      }
      try {
        return client.getFixtures(id);
      } catch (error) {
        handleDbError(error, reply);
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/soundswitch/fixtures/:id",
    async (request, reply) => {
      const client = requireClient(deps, reply);
      if (!client) return;
      const id = parseInt(request.params.id, 10);
      if (!Number.isFinite(id)) {
        return reply.status(400).send({ error: "Invalid fixture ID" });
      }
      try {
        const modes = client.getFixtureModes(id);
        return { fixtureId: id, modes };
      } catch (error) {
        handleDbError(error, reply);
      }
    },
  );

  app.get<{ Params: { id: string; modeId: string } }>(
    "/soundswitch/fixtures/:id/modes/:modeId/channels",
    async (request, reply) => {
      const client = requireClient(deps, reply);
      if (!client) return;
      const modeId = parseInt(request.params.modeId, 10);
      if (!Number.isFinite(modeId)) {
        return reply.status(400).send({ error: "Invalid mode ID" });
      }
      try {
        return client.mapToFixtureChannels(modeId);
      } catch (error) {
        handleDbError(error, reply);
      }
    },
  );

  app.post<{
    Params: { id: string; modeId: string };
    Body: { name: string; dmxStartAddress: number };
  }>(
    "/soundswitch/fixtures/:id/modes/:modeId/import",
    { schema: importSchema },
    async (request, reply) => {
      const client = requireClient(deps, reply);
      if (!client) return;

      const fixtureId = parseInt(request.params.id, 10);
      if (!Number.isFinite(fixtureId)) {
        return reply.status(400).send({ error: "Invalid fixture ID" });
      }

      const modeId = parseInt(request.params.modeId, 10);
      if (!Number.isFinite(modeId)) {
        return reply.status(400).send({ error: "Invalid mode ID" });
      }

      let channels: readonly import("../types/protocol.js").FixtureChannel[];
      try {
        channels = client.mapToFixtureChannels(modeId);
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
        const modes = client.getFixtureModes(fixtureId);
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
        source: "soundswitch",
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
