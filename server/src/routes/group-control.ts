import type { FastifyInstance } from "fastify";
import type { GroupStore } from "../fixtures/group-store.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { DmxDispatcher } from "../dmx/dmx-dispatcher.js";
import type { FixtureConfig } from "../types/protocol.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";
import { mapColor, getFixtureDefaults } from "../fixtures/channel-mapper.js";
import { successResponse, errorResponse } from "./response-helpers.js";

export interface GroupControlDeps {
  readonly groupStore: GroupStore;
  readonly fixtureStore: FixtureStore;
  readonly dispatcher: DmxDispatcher;
}

function resolveGroupFixtures(deps: GroupControlDeps, groupId: string) {
  const group = deps.groupStore.getById(groupId);
  if (!group) return undefined;

  const fixtures = group.fixtureIds
    .map((id) => deps.fixtureStore.getById(id))
    .filter((f): f is FixtureConfig => f !== undefined);

  return { group, fixtures };
}

function getFixtureAddresses(fixture: FixtureConfig): number[] {
  return fixture.channels.map((ch) => fixture.dmxStartAddress + ch.offset);
}

function buildZeroChannels(fixture: FixtureConfig): Record<number, number> {
  const result: Record<number, number> = {};
  const base = fixture.dmxStartAddress;
  for (const channel of fixture.channels) {
    result[base + channel.offset] = 0;
  }
  return result;
}

export function registerGroupControlRoutes(
  app: FastifyInstance,
  deps: GroupControlDeps,
): void {
  // Track locked channels per group so resume can unlock them
  const groupLockedAddresses = new Map<string, number[]>();

  function unlockGroup(groupId: string): void {
    const locked = groupLockedAddresses.get(groupId);
    if (locked) {
      deps.dispatcher.unlockChannels(locked);
      groupLockedAddresses.delete(groupId);
    }
  }

  app.post<{ Params: { id: string } }>(
    "/groups/:id/blackout",
    async (request, reply) => {
      const resolved = resolveGroupFixtures(deps, request.params.id);
      if (!resolved) {
        reply.code(404);
        return errorResponse("Group not found");
      }

      const { group, fixtures } = resolved;

      // Unlock any previous override for this group
      unlockGroup(group.id);

      const allAddresses: number[] = [];
      for (const fixture of fixtures) {
        const universeId = fixture.universeId ?? DEFAULT_UNIVERSE_ID;
        const zeros = buildZeroChannels(fixture);
        deps.dispatcher.applyRawUpdate(universeId, zeros);
        allAddresses.push(...getFixtureAddresses(fixture));
      }

      // Lock channels so incoming color frames don't overwrite
      deps.dispatcher.lockChannels(allAddresses);
      groupLockedAddresses.set(group.id, allAddresses);

      request.log.info(
        { action: "group-blackout", groupId: group.id, fixtureCount: fixtures.length },
        `group blackout: "${group.name}" → ${fixtures.length} fixtures zeroed, ${allAddresses.length} channels locked`,
      );

      return successResponse({
        action: "blackout" as const,
        groupId: group.id,
        fixturesUpdated: fixtures.length,
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/groups/:id/whiteout",
    async (request, reply) => {
      const resolved = resolveGroupFixtures(deps, request.params.id);
      if (!resolved) {
        reply.code(404);
        return errorResponse("Group not found");
      }

      const { group, fixtures } = resolved;

      // Unlock any previous override for this group
      unlockGroup(group.id);

      const allAddresses: number[] = [];
      for (const fixture of fixtures) {
        const universeId = fixture.universeId ?? DEFAULT_UNIVERSE_ID;
        const channels = mapColor(fixture, 255, 255, 255, 1.0);
        deps.dispatcher.applyRawUpdate(universeId, channels);
        allAddresses.push(...getFixtureAddresses(fixture));
      }

      // Lock channels so incoming color frames don't overwrite
      deps.dispatcher.lockChannels(allAddresses);
      groupLockedAddresses.set(group.id, allAddresses);

      request.log.info(
        { action: "group-whiteout", groupId: group.id, fixtureCount: fixtures.length },
        `group whiteout: "${group.name}" → ${fixtures.length} fixtures maxed, ${allAddresses.length} channels locked`,
      );

      return successResponse({
        action: "whiteout" as const,
        groupId: group.id,
        fixturesUpdated: fixtures.length,
      });
    },
  );

  app.post<{ Params: { id: string }; Body: { durationMs?: number } }>(
    "/groups/:id/flash",
    async (request, reply) => {
      const resolved = resolveGroupFixtures(deps, request.params.id);
      if (!resolved) {
        reply.code(404);
        return errorResponse("Group not found");
      }

      const { group, fixtures } = resolved;
      const durationMs = request.body?.durationMs ?? 500;

      const snapshots: Array<{ universeId: string; channels: Record<number, number> }> = [];
      const allAddresses: number[] = [];

      for (const fixture of fixtures) {
        const universeId = fixture.universeId ?? DEFAULT_UNIVERSE_ID;
        const snapshot = deps.dispatcher.getChannelSnapshot(
          universeId,
          fixture.dmxStartAddress,
          fixture.channelCount,
        );
        snapshots.push({ universeId, channels: snapshot });

        const whiteChannels = mapColor(fixture, 255, 255, 255, 1.0);
        deps.dispatcher.applyRawUpdate(universeId, whiteChannels);
        allAddresses.push(...getFixtureAddresses(fixture));
      }

      // Lock during flash so SignalRGB doesn't overwrite mid-flash
      deps.dispatcher.lockChannels(allAddresses);

      setTimeout(() => {
        for (const { universeId, channels } of snapshots) {
          deps.dispatcher.applyRawUpdate(universeId, channels);
        }
        deps.dispatcher.unlockChannels(allAddresses);
      }, durationMs);

      request.log.info(
        { action: "group-flash", groupId: group.id, fixtureCount: fixtures.length, durationMs },
        `group flash: "${group.name}" → ${fixtures.length} fixtures, ${durationMs}ms`,
      );

      return successResponse({
        action: "flash" as const,
        groupId: group.id,
        fixturesUpdated: fixtures.length,
        durationMs,
      });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/groups/:id/resume",
    async (request, reply) => {
      const resolved = resolveGroupFixtures(deps, request.params.id);
      if (!resolved) {
        reply.code(404);
        return errorResponse("Group not found");
      }

      const { group, fixtures } = resolved;

      // Unlock any channels locked by blackout/whiteout
      unlockGroup(group.id);

      for (const fixture of fixtures) {
        const universeId = fixture.universeId ?? DEFAULT_UNIVERSE_ID;
        const defaults = getFixtureDefaults(fixture);
        deps.dispatcher.applyRawUpdate(universeId, defaults);
      }

      request.log.info(
        { action: "group-resume", groupId: group.id, fixtureCount: fixtures.length },
        `group resume: "${group.name}" → ${fixtures.length} fixtures unlocked and restored to defaults`,
      );

      return successResponse({
        action: "resume" as const,
        groupId: group.id,
        fixturesUpdated: fixtures.length,
      });
    },
  );
}
