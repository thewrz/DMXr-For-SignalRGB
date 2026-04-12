import type { FastifyInstance } from "fastify";
import type { GroupStore } from "../fixtures/group-store.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { DmxDispatcher } from "../dmx/dmx-dispatcher.js";
import type { FixtureConfig } from "../types/protocol.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";
import { mapColor, getFixtureDefaults } from "../fixtures/channel-mapper.js";
import { withDmxStatus, errorResponse } from "./response-helpers.js";

export interface GroupControlDeps {
  readonly groupStore: GroupStore;
  readonly fixtureStore: FixtureStore;
  readonly dispatcher: DmxDispatcher;
}

interface LockedEntry {
  readonly universeId: string;
  readonly addresses: number[];
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
): { activeTimers: Map<string, NodeJS.Timeout> } {
  // Track locked channels per group so resume can unlock them
  const groupLocked = new Map<string, LockedEntry[]>();
  const activeTimers = new Map<string, NodeJS.Timeout>();

  function lockFixtures(groupId: string, fixtures: readonly FixtureConfig[]): void {
    const entries: LockedEntry[] = [];
    for (const fixture of fixtures) {
      const universeId = fixture.universeId ?? DEFAULT_UNIVERSE_ID;
      const addresses = getFixtureAddresses(fixture);
      deps.dispatcher.lockChannels(universeId, addresses);
      entries.push({ universeId, addresses });
    }
    groupLocked.set(groupId, entries);
  }

  function unlockGroup(groupId: string): void {
    const entries = groupLocked.get(groupId);
    if (entries) {
      for (const { universeId, addresses } of entries) {
        deps.dispatcher.unlockChannels(universeId, addresses);
      }
      groupLocked.delete(groupId);
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

      let lastDmxResult: import("../dmx/universe-manager.js").DmxWriteResult = { ok: true };
      for (const fixture of fixtures) {
        const universeId = fixture.universeId ?? DEFAULT_UNIVERSE_ID;
        const zeros = buildZeroChannels(fixture);
        lastDmxResult = deps.dispatcher.applyRawUpdate(universeId, zeros, { bypassBlackout: true });
      }

      // Lock channels so incoming color frames don't overwrite
      lockFixtures(group.id, fixtures);

      request.log.info(
        { action: "group-blackout", groupId: group.id, fixtureCount: fixtures.length },
        `group blackout: "${group.name}" → ${fixtures.length} fixtures zeroed and locked`,
      );

      return withDmxStatus({
        action: "blackout" as const,
        groupId: group.id,
        fixturesUpdated: fixtures.length,
      }, lastDmxResult);
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

      let lastDmxResult: import("../dmx/universe-manager.js").DmxWriteResult = { ok: true };
      for (const fixture of fixtures) {
        const universeId = fixture.universeId ?? DEFAULT_UNIVERSE_ID;
        const channels = mapColor(fixture, 255, 255, 255, 1.0);
        lastDmxResult = deps.dispatcher.applyRawUpdate(universeId, channels, { bypassBlackout: true });
      }

      // Lock channels so incoming color frames don't overwrite
      lockFixtures(group.id, fixtures);

      request.log.info(
        { action: "group-whiteout", groupId: group.id, fixtureCount: fixtures.length },
        `group whiteout: "${group.name}" → ${fixtures.length} fixtures maxed and locked`,
      );

      return withDmxStatus({
        action: "whiteout" as const,
        groupId: group.id,
        fixturesUpdated: fixtures.length,
      }, lastDmxResult);
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
      const durationMs = Math.max(50, Math.min(10000, request.body?.durationMs ?? 500));

      const snapshots: Array<{ universeId: string; channels: Record<number, number> }> = [];
      let lastDmxResult: import("../dmx/universe-manager.js").DmxWriteResult = { ok: true };

      for (const fixture of fixtures) {
        const universeId = fixture.universeId ?? DEFAULT_UNIVERSE_ID;
        const snapshot = deps.dispatcher.getChannelSnapshot(
          universeId,
          fixture.dmxStartAddress,
          fixture.channelCount,
        );
        snapshots.push({ universeId, channels: snapshot });

        const whiteChannels = mapColor(fixture, 255, 255, 255, 1.0);
        lastDmxResult = deps.dispatcher.applyRawUpdate(universeId, whiteChannels, { bypassBlackout: true });
      }

      // Lock during flash so SignalRGB doesn't overwrite mid-flash
      lockFixtures(group.id, fixtures);

      // Clear any existing flash timer for this group
      const existingTimer = activeTimers.get(group.id);
      if (existingTimer !== undefined) {
        clearTimeout(existingTimer);
        activeTimers.delete(group.id);
      }

      const timer = setTimeout(() => {
        unlockGroup(group.id);
        for (const { universeId, channels } of snapshots) {
          deps.dispatcher.applyRawUpdate(universeId, channels, { bypassBlackout: true });
        }
        activeTimers.delete(group.id);
      }, durationMs);
      timer.unref();
      activeTimers.set(group.id, timer);

      request.log.info(
        { action: "group-flash", groupId: group.id, fixtureCount: fixtures.length, durationMs },
        `group flash: "${group.name}" → ${fixtures.length} fixtures, ${durationMs}ms`,
      );

      return withDmxStatus({
        action: "flash" as const,
        groupId: group.id,
        fixturesUpdated: fixtures.length,
        durationMs,
      }, lastDmxResult);
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

      let lastDmxResult: import("../dmx/universe-manager.js").DmxWriteResult = { ok: true };
      for (const fixture of fixtures) {
        const universeId = fixture.universeId ?? DEFAULT_UNIVERSE_ID;
        const defaults = getFixtureDefaults(fixture);
        lastDmxResult = deps.dispatcher.applyRawUpdate(universeId, defaults, { bypassBlackout: true });
      }

      request.log.info(
        { action: "group-resume", groupId: group.id, fixtureCount: fixtures.length },
        `group resume: "${group.name}" → ${fixtures.length} fixtures unlocked and restored to defaults`,
      );

      return withDmxStatus({
        action: "resume" as const,
        groupId: group.id,
        fixturesUpdated: fixtures.length,
      }, lastDmxResult);
    },
  );

  return { activeTimers };
}
