import type { FastifyInstance } from "fastify";
import type { RemapPresetStore } from "../config/remap-preset-store.js";
import { validateChannelRemap } from "../fixtures/channel-remap.js";

interface RemapPresetRouteDeps {
  readonly store: RemapPresetStore;
}

const putSchema = {
  body: {
    type: "object",
    required: ["channelCount", "remap"],
    properties: {
      channelCount: { type: "integer", minimum: 1 },
      remap: { type: "object", additionalProperties: { type: "integer", minimum: 0 } },
    },
  },
} as const;

export function registerRemapPresetRoutes(
  app: FastifyInstance,
  deps: RemapPresetRouteDeps,
): void {
  app.get("/remap-presets", async () => {
    return deps.store.getAll();
  });

  app.get<{ Params: { key: string } }>(
    "/remap-presets/:key",
    async (request, reply) => {
      const key = decodeURIComponent(request.params.key);
      const preset = deps.store.get(key);
      if (!preset) {
        return reply.status(404).send({ error: `Preset not found: ${key}` });
      }
      return preset;
    },
  );

  app.put<{
    Params: { key: string };
    Body: { channelCount: number; remap: Record<number, number> };
  }>(
    "/remap-presets/:key",
    { schema: putSchema },
    async (request, reply) => {
      const key = decodeURIComponent(request.params.key);
      const { channelCount, remap } = request.body;

      const validation = validateChannelRemap(remap, channelCount);
      if (!validation.valid) {
        return reply.status(400).send({ error: validation.error });
      }

      deps.store.upsert(key, { channelCount, remap });
      await deps.store.save();

      return deps.store.get(key);
    },
  );

  app.delete<{ Params: { key: string } }>(
    "/remap-presets/:key",
    async (request, reply) => {
      const key = decodeURIComponent(request.params.key);
      const removed = deps.store.remove(key);
      if (!removed) {
        return reply.status(404).send({ error: `Preset not found: ${key}` });
      }
      await deps.store.save();
      return reply.status(204).send();
    },
  );
}
