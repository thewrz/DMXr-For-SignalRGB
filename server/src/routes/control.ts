import type { FastifyInstance } from "fastify";
import type { UniverseManager } from "../dmx/universe-manager.js";
import type { MultiUniverseCoordinator } from "../dmx/multi-universe-coordinator.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { FixtureConfig, FixtureChannel } from "../types/protocol.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";
import { mapColor } from "../fixtures/channel-mapper.js";
import { analyzeFixture } from "../fixtures/fixture-capabilities.js";
import { pipeLog } from "../logging/pipeline-logger.js";

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
function detectResetChannel(channels: readonly FixtureChannel[]): FixtureChannel | undefined {
  // Prefer exact "reset" match, then fall back to broader patterns
  for (const pattern of RESET_CHANNEL_PATTERNS) {
    const match = channels.find((ch) => pattern.test(ch.name) && ch.type === "Generic");
    if (match) return match;
  }
  return undefined;
}

interface ControlRouteDeps {
  readonly manager: UniverseManager;
  readonly store: FixtureStore;
  readonly coordinator?: MultiUniverseCoordinator;
}

interface TestBody {
  readonly action: "flash" | "flash-hold" | "flash-release" | "flash-click" | "identify";
  readonly durationMs?: number;
}

const testSchema = {
  body: {
    type: "object" as const,
    required: ["action"],
    properties: {
      action: {
        type: "string" as const,
        enum: ["flash", "flash-hold", "flash-release", "flash-click", "identify"],
      },
      durationMs: { type: "integer" as const, minimum: 100, maximum: 5000 },
    },
  },
};

const FLASH_HOLD_SAFETY_MS = 10_000;
const FLASH_CLICK_SUSTAIN_MS = 2_000;

function getFixtureAddresses(fixture: FixtureConfig): number[] {
  return fixture.channels.map((ch) => fixture.dmxStartAddress + ch.offset);
}

export function registerControlRoutes(
  app: FastifyInstance,
  deps: ControlRouteDeps,
): void {
  const activeTimers = new Map<string, NodeJS.Timeout>();
  const holdSnapshots = new Map<string, Record<number, number>>();

  function releaseFlash(
    fixture: FixtureConfig,
    snapshot: Record<number, number>,
  ): void {
    const addresses = getFixtureAddresses(fixture);
    deps.manager.unlockChannels(addresses);

    if (deps.manager.isBlackoutActive()) {
      // Deferred per-fixture blackout: now that flash is over, apply blackout
      const zeros: Record<number, number> = {};
      for (const addr of addresses) {
        zeros[addr] = 0;
      }
      deps.manager.applyRawUpdate(zeros);
    } else {
      deps.manager.applyRawUpdate(snapshot);
    }

    holdSnapshots.delete(fixture.id);
  }

  app.post<{ Body: { universeId?: string } }>("/control/blackout", async (request) => {
    const universeId = request.body?.universeId;

    if (deps.coordinator && universeId) {
      deps.coordinator.blackout(universeId);
    } else if (deps.coordinator) {
      deps.coordinator.blackoutAll();
    }
    // Primary manager is not in the connection pool — always update it
    deps.manager.blackout();

    const fixtures = deps.store.getAll();
    request.log.info(
      { action: "blackout", fixtureCount: fixtures.length, universeId: universeId ?? "all" },
      `blackout: ${universeId ?? "all universes"} → 0`,
    );
    return { success: true, action: "blackout", controlMode: "blackout" as const, universeId: universeId ?? null };
  });

  app.post<{ Body: { universeId?: string } }>("/control/whiteout", async (request) => {
    const universeId = request.body?.universeId;
    const fixtures = universeId
      ? deps.store.getByUniverse(universeId)
      : deps.store.getAll();

    if (deps.coordinator && universeId) {
      deps.coordinator.whiteout(universeId);
    } else if (deps.coordinator) {
      deps.coordinator.whiteoutAll();
    }
    // Primary manager is not in the connection pool — always update it
    deps.manager.whiteout();

    // Overlay fixture-specific values via mapColor for correct
    // non-color channels (pan center, strobe open, dimmer full, etc.)
    let totalChannelsSet = 0;
    if (deps.coordinator) {
      const byUniverse = new Map<string, Record<number, number>>();
      for (const fixture of fixtures) {
        const uid = fixture.universeId ?? DEFAULT_UNIVERSE_ID;
        const channels = mapColor(fixture, 255, 255, 255, 1.0);
        const existing = byUniverse.get(uid) ?? {};
        const merged = { ...existing };
        for (const [addr, val] of Object.entries(channels)) {
          merged[Number(addr)] = val;
        }
        byUniverse.set(uid, merged);
      }
      for (const [uid, updates] of byUniverse) {
        totalChannelsSet += Object.keys(updates).length;
        deps.coordinator.applyRawUpdate(uid, updates);
      }
    } else {
      const allUpdates: Record<number, number> = {};
      for (const fixture of fixtures) {
        const channels = mapColor(fixture, 255, 255, 255, 1.0);
        for (const [addr, val] of Object.entries(channels)) {
          allUpdates[Number(addr)] = val;
        }
      }
      totalChannelsSet = Object.keys(allUpdates).length;
      if (totalChannelsSet > 0) {
        deps.manager.applyRawUpdate(allUpdates);
      }
    }

    request.log.info(
      {
        action: "whiteout",
        fixtureCount: fixtures.length,
        channelsSet: totalChannelsSet,
      },
      `whiteout: ${fixtures.length} fixtures, ${totalChannelsSet} channels set via mapColor`,
    );

    return {
      success: true,
      action: "whiteout",
      controlMode: "whiteout" as const,
      fixturesUpdated: fixtures.length,
      universeId: universeId ?? null,
    };
  });

  app.post<{ Body: { universeId?: string } }>("/control/resume", async (request) => {
    const universeId = request.body?.universeId;

    if (deps.coordinator && universeId) {
      deps.coordinator.resumeNormal(universeId);
    } else if (deps.coordinator) {
      deps.coordinator.resumeNormalAll();
    }
    // Primary manager is not in the connection pool — always update it
    deps.manager.resumeNormal();

    request.log.info(
      { action: "resume", universeId: universeId ?? "all" },
      `resume: ${universeId ?? "all universes"} override cleared`,
    );
    return { success: true, action: "resume", controlMode: "normal" as const, universeId: universeId ?? null };
  });

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

  app.post<{ Params: { id: string }; Body: TestBody }>(
    "/fixtures/:id/test",
    { schema: testSchema },
    async (request, reply) => {
      const fixture = deps.store.getById(request.params.id);

      if (fixture === undefined) {
        request.log.warn({ fixtureId: request.params.id }, "flash: fixture not found");
        return reply.status(404).send({ error: "Fixture not found" });
      }

      const { action, durationMs = 500 } = request.body;
      const start = fixture.dmxStartAddress;
      const count = fixture.channelCount;

      // Cancel any existing timer for this fixture (safety or timed flash)
      const existingTimer = activeTimers.get(fixture.id);
      if (existingTimer !== undefined) {
        clearTimeout(existingTimer);
        activeTimers.delete(fixture.id);
      }

      if (action === "flash") {
        const snapshot = deps.manager.getChannelSnapshot(start, count);
        const flashValues = buildFlashValues(fixture, snapshot);
        deps.manager.applyRawUpdate(flashValues);

        request.log.info(
          {
            action,
            fixtureId: fixture.id,
            fixtureName: fixture.name,
            dmxRange: `${start}-${start + count - 1}`,
            durationMs,
            channelValues: flashValues,
          },
          `flash: "${fixture.name}" DMX ${start}-${start + count - 1} for ${durationMs}ms`,
        );

        const timer = setTimeout(() => {
          releaseFlash(fixture, snapshot);
          request.log.info(
            { action: "flash-restore", fixtureId: fixture.id },
            `flash-restore: "${fixture.name}" restored`,
          );
          activeTimers.delete(fixture.id);
        }, durationMs);
        timer.unref();
        activeTimers.set(fixture.id, timer);

        return { success: true, action, fixtureId: fixture.id, durationMs };
      }

      if (action === "flash-hold") {
        const snapshot = deps.manager.getChannelSnapshot(start, count);
        holdSnapshots.set(fixture.id, snapshot);

        const flashValues = buildFlashValues(fixture, snapshot);
        const addresses = getFixtureAddresses(fixture);
        deps.manager.applyRawUpdate(flashValues);
        deps.manager.lockChannels(addresses);

        request.log.info(
          { action, fixtureId: fixture.id, fixtureName: fixture.name },
          `flash-hold: "${fixture.name}" held on (${addresses.length} channels locked)`,
        );

        // Safety timeout in case browser disconnects mid-hold
        const safety = setTimeout(() => {
          const snap = holdSnapshots.get(fixture.id);
          if (snap !== undefined) {
            releaseFlash(fixture, snap);
            request.log.warn(
              { fixtureId: fixture.id },
              `flash-hold safety timeout: "${fixture.name}" auto-restored`,
            );
          }
          activeTimers.delete(fixture.id);
        }, FLASH_HOLD_SAFETY_MS);
        safety.unref();
        activeTimers.set(fixture.id, safety);

        return { success: true, action, fixtureId: fixture.id };
      }

      if (action === "flash-click") {
        const snapshot = deps.manager.getChannelSnapshot(start, count);
        holdSnapshots.set(fixture.id, snapshot);

        const flashValues = buildFlashValues(fixture, snapshot);
        const addresses = getFixtureAddresses(fixture);
        deps.manager.applyRawUpdate(flashValues);
        deps.manager.lockChannels(addresses);

        request.log.info(
          { action, fixtureId: fixture.id, fixtureName: fixture.name },
          `flash-click: "${fixture.name}" sustain ${FLASH_CLICK_SUSTAIN_MS}ms`,
        );

        const timer = setTimeout(() => {
          const snap = holdSnapshots.get(fixture.id);
          if (snap !== undefined) {
            releaseFlash(fixture, snap);
          }
          activeTimers.delete(fixture.id);
        }, FLASH_CLICK_SUSTAIN_MS);
        timer.unref();
        activeTimers.set(fixture.id, timer);

        return { success: true, action, fixtureId: fixture.id, durationMs: FLASH_CLICK_SUSTAIN_MS };
      }

      if (action === "flash-release") {
        const snapshot =
          holdSnapshots.get(fixture.id) ??
          deps.manager.getChannelSnapshot(start, count);
        releaseFlash(fixture, snapshot);

        request.log.info(
          { action, fixtureId: fixture.id, fixtureName: fixture.name },
          `flash-release: "${fixture.name}" restored`,
        );

        return { success: true, action, fixtureId: fixture.id };
      }

      // identify — passthrough (future)
      return { success: true, action, fixtureId: fixture.id };
    },
  );

  // ── Raw DMX channel write (debug / probing) ──
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

  // ── Fixture DMX Reset ──
  // Sends a reset command to the fixture's maintenance/reset channel,
  // holds for a configurable duration, then returns to 0.
  app.post<{ Params: { id: string } }>(
    "/fixtures/:id/reset",
    async (request, reply) => {
      const fixture = deps.store.getById(request.params.id);
      if (!fixture) {
        return reply.status(404).send({ error: "Fixture not found" });
      }

      // Use explicit config if set, otherwise auto-detect
      const config = fixture.resetConfig;
      const resetChannel = config
        ? fixture.channels.find((ch) => ch.offset === config.channelOffset)
        : detectResetChannel(fixture.channels);

      if (!resetChannel) {
        return reply.status(400).send({
          error: "No reset channel detected",
          hint: "Configure resetConfig on this fixture via PATCH",
        });
      }

      const resetValue = config?.value ?? DEFAULT_RESET_VALUE;
      const holdMs = config?.holdMs ?? DEFAULT_RESET_HOLD_MS;
      const dmxAddr = fixture.dmxStartAddress + resetChannel.offset;

      // Cancel any existing reset timer for this fixture
      const existingTimer = activeTimers.get(`reset:${fixture.id}`);
      if (existingTimer) {
        clearTimeout(existingTimer);
        activeTimers.delete(`reset:${fixture.id}`);
      }

      // Send reset value
      deps.manager.applyRawUpdate({ [dmxAddr]: resetValue });

      pipeLog("info",
        `RESET "${fixture.name}": DMX${dmxAddr} (${resetChannel.name}) → ${resetValue}, ` +
        `hold ${holdMs}ms then restore to 0`,
      );

      // Hold, then return to 0
      const timer = setTimeout(() => {
        deps.manager.applyRawUpdate({ [dmxAddr]: 0 });
        activeTimers.delete(`reset:${fixture.id}`);
        pipeLog("info", `RESET "${fixture.name}": DMX${dmxAddr} restored to 0`);
      }, holdMs);
      timer.unref();
      activeTimers.set(`reset:${fixture.id}`, timer);

      return {
        success: true,
        action: "reset",
        fixtureId: fixture.id,
        channel: resetChannel.name,
        dmxAddress: dmxAddr,
        value: resetValue,
        holdMs,
      };
    },
  );

  // ── Reset channel detection (GET) ──
  // Returns info about the detected reset channel for a fixture.
  app.get<{ Params: { id: string } }>(
    "/fixtures/:id/reset-info",
    async (request, reply) => {
      const fixture = deps.store.getById(request.params.id);
      if (!fixture) {
        return reply.status(404).send({ error: "Fixture not found" });
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

function buildFlashValues(
  fixture: FixtureConfig,
  snapshot: Record<number, number>,
): Record<number, number> {
  const start = fixture.dmxStartAddress;
  const result: Record<number, number> = {};
  const caps = analyzeFixture(fixture.channels);

  for (const channel of fixture.channels) {
    const addr = start + channel.offset;

    if (channel.type === "ColorIntensity" || channel.type === "Intensity") {
      result[addr] = 255;
    } else if (channel.type === "Strobe" || channel.type === "ShutterStrobe") {
      // Flash always forces shutter fully open (255) for maximum output,
      // unlike mapColor which respects channel.defaultValue when > 0.
      result[addr] = caps.strobeMode === "effect" ? 0 : 255;
    } else {
      result[addr] = snapshot[addr] ?? channel.defaultValue;
    }
  }

  return result;
}
