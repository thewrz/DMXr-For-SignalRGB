import type { FastifyInstance, FastifyReply } from "fastify";
import type { SsClient } from "../soundswitch/ss-client.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import { validateFixtureAddress } from "../fixtures/fixture-validator.js";

interface SoundswitchRouteDeps {
  readonly ssClient: SsClient;
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

function handleDbError(error: unknown, reply: FastifyReply): void {
  const message = error instanceof Error ? error.message : String(error);
  reply.log.error(`SoundSwitch DB error: ${message}`);
  reply.status(500).send({ error: "SoundSwitch database error" });
}

export function registerSoundswitchRoutes(
  app: FastifyInstance,
  deps: SoundswitchRouteDeps,
): void {
  app.get("/soundswitch/manufacturers", async (_request, reply) => {
    try {
      return deps.ssClient.getManufacturers();
    } catch (error) {
      handleDbError(error, reply);
    }
  });

  app.get<{ Params: { id: string } }>(
    "/soundswitch/manufacturers/:id/fixtures",
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (!Number.isFinite(id)) {
        return reply.status(400).send({ error: "Invalid manufacturer ID" });
      }
      try {
        return deps.ssClient.getFixtures(id);
      } catch (error) {
        handleDbError(error, reply);
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    "/soundswitch/fixtures/:id",
    async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      if (!Number.isFinite(id)) {
        return reply.status(400).send({ error: "Invalid fixture ID" });
      }
      try {
        const modes = deps.ssClient.getFixtureModes(id);
        return { fixtureId: id, modes };
      } catch (error) {
        handleDbError(error, reply);
      }
    },
  );

  app.get<{ Params: { id: string; modeId: string } }>(
    "/soundswitch/fixtures/:id/modes/:modeId/channels",
    async (request, reply) => {
      const modeId = parseInt(request.params.modeId, 10);
      if (!Number.isFinite(modeId)) {
        return reply.status(400).send({ error: "Invalid mode ID" });
      }
      try {
        return deps.ssClient.mapToFixtureChannels(modeId);
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
        channels = deps.ssClient.mapToFixtureChannels(modeId);
      } catch (error) {
        handleDbError(error, reply);
        return;
      }

      if (channels.length === 0) {
        return reply
          .status(404)
          .send({ error: "No channels found for this mode" });
      }

      let modeName: string;
      try {
        const modes = deps.ssClient.getFixtureModes(fixtureId);
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
