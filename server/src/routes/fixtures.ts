import type { FastifyInstance } from "fastify";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { UniverseManager } from "../dmx/universe-manager.js";
import type { AddFixtureRequest, UpdateFixtureRequest } from "../types/protocol.js";
import { validateFixtureAddress, validateFixtureChannels } from "../fixtures/fixture-validator.js";
import { pipeLog, resetSample } from "../logging/pipeline-logger.js";

interface FixtureRouteDeps {
  readonly store: FixtureStore;
  readonly manager?: UniverseManager;
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
            channelOverrides: {
              type: "object" as const,
              additionalProperties: {
                type: "object" as const,
                required: ["value", "enabled"],
                properties: {
                  value: { type: "integer" as const, minimum: 0, maximum: 255 },
                  enabled: { type: "boolean" as const },
                },
                additionalProperties: false,
              },
            },
            whiteGateThreshold: { type: "integer" as const, minimum: 0, maximum: 255 },
          },
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

      // Immediately push override values to DMX so changes take effect
      // without waiting for the next color frame from SignalRGB.
      if (updated && request.body.channelOverrides && deps.manager) {
        const base = updated.dmxStartAddress;
        const channels: Record<number, number> = {};
        const logLines: string[] = [
          `PATCH override "${updated.name}" (id=${updated.id.slice(0, 8)} base=${base}):`,
        ];

        for (const [offsetStr, override] of Object.entries(request.body.channelOverrides)) {
          const offset = Number(offsetStr);
          const channel = updated.channels.find((ch) => ch.offset === offset);
          if (!channel) {
            logLines.push(`  [${offset}] SKIP — no matching channel definition`);
            continue;
          }

          const value = override.enabled
            ? Math.max(0, Math.min(255, Math.round(override.value)))
            : channel.defaultValue;
          channels[base + offset] = value;

          logLines.push(
            `  [${offset}] DMX${base + offset} ${channel.name.padEnd(16)} ` +
            `type=${channel.type.padEnd(15)} enabled=${override.enabled} ` +
            `value=${override.value} → DMX=${value}`,
          );
        }

        pipeLog("info", logLines.join("\n"));

        if (Object.keys(channels).length > 0) {
          const count = deps.manager.applyFixtureUpdate({ fixture: updated.id, channels });
          pipeLog("info", `PATCH DMX push: ${count} channels sent for "${updated.name}"`);
          // Force next mapColor sample to log so we can see the override in action
          resetSample(`mapColor:${updated.id}`);
        }
      }

      // Debounced save: in-memory state is already updated for mapColor.
      // Don't block the response on disk I/O — rapid slider drags would
      // queue sequential writes that stall the event loop for color updates.
      deps.store.scheduleSave();

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
