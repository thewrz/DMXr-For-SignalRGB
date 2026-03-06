import type { FastifyInstance } from "fastify";
import type { UniverseManager } from "../dmx/universe-manager.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { FixtureChannel } from "../types/protocol.js";
import { pipeLog } from "../logging/pipeline-logger.js";
import { errorResponse, successResponse } from "./response-helpers.js";

/** Name patterns that indicate a channel capable of triggering a fixture reset.
 *  Checked case-insensitively against the channel name. */
const RESET_CHANNEL_PATTERNS = [
  /\breset\b/i,
  /\bmaintenance\b/i,
  /\blamp\s*control\b/i,
  /\bspecial\b/i,
  /\bauto\s*mode\b/i,
  /\bcontrol\s*ch/i,
];

const DEFAULT_RESET_VALUE = 200;
const DEFAULT_RESET_HOLD_MS = 5000;

/** Auto-detect a likely reset channel from the fixture's channel list. */
export function detectResetChannel(channels: readonly FixtureChannel[]): FixtureChannel | undefined {
  for (const pattern of RESET_CHANNEL_PATTERNS) {
    const match = channels.find((ch) => pattern.test(ch.name) && ch.type === "Generic");
    if (match) return match;
  }
  return undefined;
}

export interface FixtureResetDeps {
  readonly manager: UniverseManager;
  readonly store: FixtureStore;
}

export function registerFixtureResetRoutes(
  app: FastifyInstance,
  deps: FixtureResetDeps,
  activeTimers: Map<string, NodeJS.Timeout>,
): void {
  app.post<{ Params: { id: string } }>(
    "/fixtures/:id/reset",
    async (request, reply) => {
      const fixture = deps.store.getById(request.params.id);
      if (!fixture) {
        return reply.status(404).send(errorResponse("Fixture not found"));
      }

      const config = fixture.resetConfig;
      const resetChannel = config
        ? fixture.channels.find((ch) => ch.offset === config.channelOffset)
        : detectResetChannel(fixture.channels);

      if (!resetChannel) {
        return reply.status(400).send(
          errorResponse("No reset channel detected", "Configure resetConfig on this fixture via PATCH"),
        );
      }

      const resetValue = config?.value ?? DEFAULT_RESET_VALUE;
      const holdMs = config?.holdMs ?? DEFAULT_RESET_HOLD_MS;
      const dmxAddr = fixture.dmxStartAddress + resetChannel.offset;

      const existingTimer = activeTimers.get(`reset:${fixture.id}`);
      if (existingTimer) {
        clearTimeout(existingTimer);
        activeTimers.delete(`reset:${fixture.id}`);
      }

      deps.manager.applyRawUpdate({ [dmxAddr]: resetValue });

      pipeLog("info",
        `RESET "${fixture.name}": DMX${dmxAddr} (${resetChannel.name}) → ${resetValue}, ` +
        `hold ${holdMs}ms then restore to 0`,
      );

      const timer = setTimeout(() => {
        deps.manager.applyRawUpdate({ [dmxAddr]: 0 });
        activeTimers.delete(`reset:${fixture.id}`);
        pipeLog("info", `RESET "${fixture.name}": DMX${dmxAddr} restored to 0`);
      }, holdMs);
      timer.unref();
      activeTimers.set(`reset:${fixture.id}`, timer);

      return successResponse({
        action: "reset" as const,
        fixtureId: fixture.id,
        channel: resetChannel.name,
        dmxAddress: dmxAddr,
        value: resetValue,
        holdMs,
      });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/fixtures/:id/reset-info",
    async (request, reply) => {
      const fixture = deps.store.getById(request.params.id);
      if (!fixture) {
        return reply.status(404).send(errorResponse("Fixture not found"));
      }

      const config = fixture.resetConfig;
      const resetChannel = config
        ? fixture.channels.find((ch) => ch.offset === config.channelOffset)
        : detectResetChannel(fixture.channels);

      return {
        fixtureId: fixture.id,
        hasReset: resetChannel !== undefined,
        configured: config !== undefined,
        channel: resetChannel ? {
          offset: resetChannel.offset,
          name: resetChannel.name,
          dmxAddress: fixture.dmxStartAddress + resetChannel.offset,
        } : null,
        value: config?.value ?? DEFAULT_RESET_VALUE,
        holdMs: config?.holdMs ?? DEFAULT_RESET_HOLD_MS,
      };
    },
  );
}
