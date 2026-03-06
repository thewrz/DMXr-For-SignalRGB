import type { FastifyInstance } from "fastify";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { UniverseManager } from "../dmx/universe-manager.js";
import type { AddFixtureRequest, UpdateFixtureRequest } from "../types/protocol.js";
import { validateFixtureAddress, validateFixtureChannels, findNextAvailableAddress } from "../fixtures/fixture-validator.js";
import { computeOverrideChannels } from "../fixtures/fixture-override-service.js";
import { validateChannelRemap } from "../fixtures/channel-remap.js";
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
      universeId: { type: "string" as const },
      oflKey: { type: "string" as const },
      oflFixtureName: { type: "string" as const },
      source: { type: "string" as const, enum: ["ofl", "local-db", "custom"] },
      category: { type: "string" as const },
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
  app.get<{ Querystring: { universeId?: string } }>("/fixtures", async (request) => {
    const { universeId } = request.query;
    if (universeId) {
      return deps.store.getByUniverse(universeId);
    }
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
        undefined,
        body.universeId,
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
            universeId: { type: "string" as const },
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
            channelRemap: {
              type: "object" as const,
              additionalProperties: { type: "integer" as const, minimum: 0 },
            },
            whiteGateThreshold: { type: "integer" as const, minimum: 0, maximum: 255 },
            motorGuardEnabled: { type: "boolean" as const },
            motorGuardBuffer: { type: "integer" as const, minimum: 0, maximum: 20 },
            resetConfig: {
              type: "object" as const,
              required: ["channelOffset", "value", "holdMs"],
              properties: {
                channelOffset: { type: "integer" as const, minimum: 0 },
                value: { type: "integer" as const, minimum: 0, maximum: 255 },
                holdMs: { type: "integer" as const, minimum: 1000, maximum: 15000 },
              },
              additionalProperties: false,
            },
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
        const targetUniverse = request.body.universeId ?? existing.universeId;
        const validation = validateFixtureAddress(
          request.body.dmxStartAddress,
          existing.channelCount,
          deps.store.getAll(),
          existing.id,
          targetUniverse,
        );
        if (!validation.valid) {
          return reply.status(409).send({ success: false, error: validation.error });
        }
      }

      if (request.body.channelRemap !== undefined) {
        const remapValidation = validateChannelRemap(
          request.body.channelRemap,
          existing.channelCount,
        );
        if (!remapValidation.valid) {
          return reply.status(400).send({ success: false, error: remapValidation.error });
        }
      }

      const updated = deps.store.update(request.params.id, request.body);

      // Immediately push override values to DMX so changes take effect
      // without waiting for the next color frame from SignalRGB.
      if (updated && request.body.channelOverrides && deps.manager) {
        const { channels, logLines } = computeOverrideChannels(updated, request.body.channelOverrides);

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

  app.post<{
    Params: { id: string };
    Body: { dmxStartAddress?: number; name?: string; universeId?: string };
  }>(
    "/fixtures/:id/duplicate",
    {
      schema: {
        body: {
          type: "object" as const,
          properties: {
            dmxStartAddress: { type: "integer" as const, minimum: 1, maximum: 512 },
            name: { type: "string" as const, minLength: 1 },
            universeId: { type: "string" as const },
          },
        },
      },
    },
    async (request, reply) => {
      const source = deps.store.getById(request.params.id);
      if (!source) {
        return reply.status(404).send({ success: false, error: "Fixture not found" });
      }

      const targetUniverse = request.body.universeId ?? source.universeId;
      const channelCount = source.channelCount;

      let startAddress = request.body.dmxStartAddress;
      if (startAddress === undefined) {
        const afterSource = source.dmxStartAddress + source.channelCount;
        const found = findNextAvailableAddress(
          channelCount,
          deps.store.getAll(),
          targetUniverse,
          afterSource,
        );
        if (found === undefined) {
          return reply.status(409).send({
            success: false,
            error: "No available DMX address space for duplicate fixture",
          });
        }
        startAddress = found;
      }

      const validation = validateFixtureAddress(
        startAddress,
        channelCount,
        deps.store.getAll(),
        undefined,
        targetUniverse,
      );
      if (!validation.valid) {
        return reply.status(409).send({ success: false, error: validation.error });
      }

      const duplicateName = request.body.name ?? `${source.name} (copy)`;

      const fixture = deps.store.add({
        name: duplicateName,
        universeId: targetUniverse,
        ...(source.oflKey ? { oflKey: source.oflKey } : {}),
        ...(source.oflFixtureName ? { oflFixtureName: source.oflFixtureName } : {}),
        ...(source.source ? { source: source.source } : {}),
        ...(source.category ? { category: source.category } : {}),
        mode: source.mode,
        dmxStartAddress: startAddress,
        channelCount: source.channelCount,
        channels: source.channels,
      });

      await deps.store.save();

      return reply.status(201).send(fixture);
    },
  );

  app.post<{
    Body: {
      name: string;
      mode: string;
      channels: AddFixtureRequest["channels"];
      channelCount: number;
      startAddress: number;
      count: number;
      spacing?: number;
      universeId?: string;
      oflKey?: string;
      oflFixtureName?: string;
      source?: string;
      category?: string;
    };
  }>(
    "/fixtures/batch",
    {
      schema: {
        body: {
          type: "object" as const,
          required: ["name", "mode", "channels", "channelCount", "startAddress", "count"],
          properties: {
            name: { type: "string" as const, minLength: 1 },
            mode: { type: "string" as const, minLength: 1 },
            channels: addFixtureSchema.body.properties.channels,
            channelCount: { type: "integer" as const, minimum: 1 },
            startAddress: { type: "integer" as const, minimum: 1, maximum: 512 },
            count: { type: "integer" as const, minimum: 1, maximum: 32 },
            spacing: { type: "integer" as const, minimum: 1 },
            universeId: { type: "string" as const },
            oflKey: { type: "string" as const },
            oflFixtureName: { type: "string" as const },
            source: { type: "string" as const, enum: ["ofl", "local-db", "custom"] },
            category: { type: "string" as const },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const channelCount = body.channels.length;

      const channelValidation = validateFixtureChannels(body.channels, body.channelCount);
      if (!channelValidation.valid) {
        return reply.status(400).send({ success: false, error: channelValidation.error });
      }

      const spacing = body.spacing ?? channelCount;

      // Validate that the entire batch fits within DMX range
      const lastStart = body.startAddress + spacing * (body.count - 1);
      const lastEnd = lastStart + channelCount - 1;
      if (lastEnd > 512) {
        return reply.status(409).send({
          success: false,
          error: `Batch extends beyond channel 512 (last fixture needs ${lastStart}-${lastEnd})`,
        });
      }

      // Validate no intra-batch overlaps (spacing < channelCount)
      if (spacing < channelCount) {
        return reply.status(400).send({
          success: false,
          error: `Spacing (${spacing}) is less than channel count (${channelCount}) — fixtures would overlap each other`,
        });
      }

      // Validate each fixture address against existing fixtures
      const existingFixtures = deps.store.getAll();
      for (let i = 0; i < body.count; i++) {
        const address = body.startAddress + spacing * i;
        const validation = validateFixtureAddress(
          address,
          channelCount,
          existingFixtures,
          undefined,
          body.universeId,
        );
        if (!validation.valid) {
          return reply.status(409).send({
            success: false,
            error: `Fixture ${i + 1} at DMX ${address}: ${validation.error}`,
          });
        }
      }

      // Build batch requests
      const requests: AddFixtureRequest[] = [];
      for (let i = 0; i < body.count; i++) {
        requests.push({
          name: body.count === 1 ? body.name : `${body.name} ${i + 1}`,
          mode: body.mode,
          dmxStartAddress: body.startAddress + spacing * i,
          channelCount: body.channelCount,
          channels: body.channels,
          universeId: body.universeId,
          ...(body.oflKey ? { oflKey: body.oflKey } : {}),
          ...(body.oflFixtureName ? { oflFixtureName: body.oflFixtureName } : {}),
          ...(body.source ? { source: body.source as AddFixtureRequest["source"] } : {}),
          ...(body.category ? { category: body.category } : {}),
        });
      }

      const created = deps.store.addBatch(requests);
      await deps.store.save();

      return reply.status(201).send(created);
    },
  );
}
