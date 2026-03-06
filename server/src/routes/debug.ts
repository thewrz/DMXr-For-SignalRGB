import type { FastifyInstance } from "fastify";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { DmxDispatcher } from "../dmx/dmx-dispatcher.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";
import { pipeLog } from "../logging/pipeline-logger.js";
import { errorResponse, successResponse } from "./response-helpers.js";
import { resolveAddress } from "../fixtures/channel-remap.js";

export interface DebugRouteDeps {
  readonly dispatcher: DmxDispatcher;
  readonly store: FixtureStore;
}

export function registerDebugRoutes(
  app: FastifyInstance,
  deps: DebugRouteDeps,
): void {
  // Diagnostic: dump DMX channel snapshot for a fixture or address range
  app.get<{ Params: { id: string } }>(
    "/debug/fixture/:id",
    async (request, reply) => {
      const fixture = deps.store.getById(request.params.id);
      if (!fixture) {
        return reply.status(404).send(errorResponse("Fixture not found"));
      }

      const base = fixture.dmxStartAddress;
      const count = fixture.channelCount;
      const universeId = fixture.universeId ?? DEFAULT_UNIVERSE_ID;
      const snapshot = deps.dispatcher.getChannelSnapshot(universeId, base, count);

      const channels = fixture.channels.map((ch) => {
        const addr = resolveAddress(fixture, ch.offset);
        const override = fixture.channelOverrides?.[ch.offset];
        return {
          offset: ch.offset,
          dmxAddress: addr,
          name: ch.name,
          type: ch.type,
          color: ch.color ?? null,
          defaultValue: ch.defaultValue,
          overrideEnabled: override?.enabled ?? false,
          overrideValue: override?.value ?? null,
          currentDmxValue: snapshot[addr] ?? 0,
        };
      });

      pipeLog("info",
        `DEBUG fixture "${fixture.name}" (base=${base} universe=${universeId}):\n` +
        channels.map((ch) =>
          `  [${ch.offset}] DMX${ch.dmxAddress} ${ch.name.padEnd(16)} ` +
          `buffer=${ch.currentDmxValue} ovr=${ch.overrideEnabled ? "ON" : "off"}(${ch.overrideValue})`
        ).join("\n"),
      );

      return {
        fixture: fixture.name,
        id: fixture.id,
        universeId,
        dmxStartAddress: base,
        channelCount: count,
        blackoutActive: deps.dispatcher.isBlackoutActive(universeId),
        activeChannels: deps.dispatcher.getActiveChannelCount(universeId),
        channels,
      };
    },
  );

  // Raw DMX channel write (debug / probing)
  app.post<{ Body: { channels: Record<string, number>; universeId?: string } }>(
    "/debug/raw",
    {
      schema: {
        body: {
          type: "object" as const,
          required: ["channels"],
          properties: {
            channels: {
              type: "object" as const,
              additionalProperties: { type: "integer" as const, minimum: 0, maximum: 255 },
            },
            universeId: { type: "string" as const },
          },
        },
      },
    },
    async (request) => {
      const updates: Record<number, number> = {};
      for (const [addr, val] of Object.entries(request.body.channels)) {
        const dmxAddr = Number(addr);
        if (dmxAddr >= 1 && dmxAddr <= 512) {
          updates[dmxAddr] = val;
        }
      }

      const uid = request.body.universeId;
      deps.dispatcher.applyRawUpdate(uid, updates);

      pipeLog("info", `DEBUG raw DMX write (universe=${uid ?? "default"}): ${JSON.stringify(updates)}`);
      return successResponse({ channelsSet: Object.keys(updates).length, universeId: uid ?? null, updates });
    },
  );
}
