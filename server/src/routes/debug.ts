import type { FastifyInstance } from "fastify";
import type { UniverseManager } from "../dmx/universe-manager.js";
import type { MultiUniverseCoordinator } from "../dmx/multi-universe-coordinator.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";
import { pipeLog } from "../logging/pipeline-logger.js";

export interface DebugRouteDeps {
  readonly manager: UniverseManager;
  readonly store: FixtureStore;
  readonly coordinator?: MultiUniverseCoordinator;
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
        return reply.status(404).send({ error: "Fixture not found" });
      }

      const base = fixture.dmxStartAddress;
      const count = fixture.channelCount;
      const universeId = fixture.universeId ?? DEFAULT_UNIVERSE_ID;

      const manager = deps.coordinator
        ? (() => { const m = deps.coordinator!; return {
            getChannelSnapshot: (s: number, c: number) => m.getChannelSnapshot(universeId, s, c),
            isBlackoutActive: () => m.isBlackoutActive(universeId),
            getActiveChannelCount: () => m.getActiveChannelCount(universeId),
          }; })()
        : deps.manager;
      const snapshot = manager.getChannelSnapshot(base, count);

      const channels = fixture.channels.map((ch) => {
        const addr = base + ch.offset;
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
        blackoutActive: manager.isBlackoutActive(),
        activeChannels: manager.getActiveChannelCount(),
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
      if (deps.coordinator && uid) {
        deps.coordinator.applyRawUpdate(uid, updates);
      } else {
        deps.manager.applyRawUpdate(updates);
      }

      pipeLog("info", `DEBUG raw DMX write (universe=${uid ?? "default"}): ${JSON.stringify(updates)}`);
      return { success: true, channelsSet: Object.keys(updates).length, universeId: uid ?? null, updates };
    },
  );
}
