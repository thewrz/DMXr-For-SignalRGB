import type { FastifyInstance } from "fastify";
import type { UniverseManager, DmxWriteResult } from "../dmx/universe-manager.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { FixtureConfig } from "../types/protocol.js";
import { analyzeFixture } from "../fixtures/fixture-capabilities.js";
import { resolveAddress } from "../fixtures/channel-remap.js";

function dmxStatus(result: DmxWriteResult) {
  return {
    dmxStatus: result.ok ? ("ok" as const) : ("error" as const),
    ...(result.error ? { dmxError: result.error } : {}),
  };
}

export interface FixtureTestDeps {
  readonly manager: UniverseManager;
  readonly store: FixtureStore;
}

interface TestBody {
  readonly action: "flash" | "flash-hold" | "flash-release" | "flash-click" | "identify";
  readonly durationMs?: number;
  readonly channelOffset?: number;
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
      channelOffset: { type: "integer" as const, minimum: 0 },
    },
  },
};

const FLASH_HOLD_SAFETY_MS = 10_000;
const FLASH_CLICK_SUSTAIN_MS = 2_000;

function getFixtureAddresses(fixture: FixtureConfig): number[] {
  return fixture.channels.map((ch) => resolveAddress(fixture, ch.offset));
}

export function buildFlashValues(
  fixture: FixtureConfig,
  snapshot: Record<number, number>,
  channelOffset?: number,
): Record<number, number> {
  const result: Record<number, number> = {};
  const caps = analyzeFixture(fixture.channels);
  const singleChannel = channelOffset !== undefined;

  for (const channel of fixture.channels) {
    const addr = resolveAddress(fixture, channel.offset);

    if (singleChannel) {
      // Single-channel mode: only the targeted offset gets 255
      result[addr] =
        channel.offset === channelOffset
          ? 255
          : (snapshot[addr] ?? channel.defaultValue);
    } else if (channel.type === "ColorIntensity" || channel.type === "Intensity") {
      result[addr] = 255;
    } else if (channel.type === "Strobe" || channel.type === "ShutterStrobe") {
      result[addr] = caps.strobeMode === "effect" ? 0 : 255;
    } else {
      result[addr] = snapshot[addr] ?? channel.defaultValue;
    }
  }

  return result;
}

export function registerFixtureTestRoutes(
  app: FastifyInstance,
  deps: FixtureTestDeps,
): { activeTimers: Map<string, NodeJS.Timeout>; holdSnapshots: Map<string, Record<number, number>> } {
  const activeTimers = new Map<string, NodeJS.Timeout>();
  const holdSnapshots = new Map<string, Record<number, number>>();

  function releaseFlash(
    fixture: FixtureConfig,
    snapshot: Record<number, number>,
  ): void {
    const addresses = getFixtureAddresses(fixture);
    deps.manager.unlockChannels(addresses);

    if (deps.manager.isBlackoutActive()) {
      const zeros: Record<number, number> = {};
      for (const addr of addresses) {
        zeros[addr] = 0;
      }
      deps.manager.applyRawUpdate(zeros, { bypassBlackout: true });
    } else {
      deps.manager.applyRawUpdate(snapshot, { bypassBlackout: true });
    }

    holdSnapshots.delete(fixture.id);
  }

  app.post<{ Params: { id: string }; Body: TestBody }>(
    "/fixtures/:id/test",
    { schema: testSchema },
    async (request, reply) => {
      const fixture = deps.store.getById(request.params.id);

      if (fixture === undefined) {
        request.log.warn({ fixtureId: request.params.id }, "flash: fixture not found");
        return reply.status(404).send({ error: "Fixture not found" });
      }

      const { action, durationMs = 500, channelOffset } = request.body;
      const start = fixture.dmxStartAddress;
      const count = fixture.channelCount;

      if (channelOffset !== undefined && channelOffset >= fixture.channelCount) {
        return reply.status(400).send({
          error: `channelOffset ${channelOffset} out of range (fixture has ${fixture.channelCount} channels)`,
        });
      }

      // Cancel any existing timer for this fixture (safety or timed flash)
      const existingTimer = activeTimers.get(fixture.id);
      if (existingTimer !== undefined) {
        clearTimeout(existingTimer);
        activeTimers.delete(fixture.id);
      }

      if (action === "flash") {
        const snapshot = deps.manager.getChannelSnapshot(start, count);
        const flashValues = buildFlashValues(fixture, snapshot, channelOffset);
        const dmxResult = deps.manager.applyRawUpdate(flashValues, { bypassBlackout: true });

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

        return { success: true, action, fixtureId: fixture.id, durationMs, ...dmxStatus(dmxResult) };
      }

      if (action === "flash-hold") {
        const snapshot = deps.manager.getChannelSnapshot(start, count);
        holdSnapshots.set(fixture.id, snapshot);

        const flashValues = buildFlashValues(fixture, snapshot, channelOffset);
        const addresses = getFixtureAddresses(fixture);
        const dmxResult = deps.manager.applyRawUpdate(flashValues, { bypassBlackout: true });
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

        return { success: true, action, fixtureId: fixture.id, ...dmxStatus(dmxResult) };
      }

      if (action === "flash-click") {
        const snapshot = deps.manager.getChannelSnapshot(start, count);
        holdSnapshots.set(fixture.id, snapshot);

        const flashValues = buildFlashValues(fixture, snapshot, channelOffset);
        const addresses = getFixtureAddresses(fixture);
        const dmxResult = deps.manager.applyRawUpdate(flashValues, { bypassBlackout: true });
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

        return { success: true, action, fixtureId: fixture.id, durationMs: FLASH_CLICK_SUSTAIN_MS, ...dmxStatus(dmxResult) };
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

  return { activeTimers, holdSnapshots };
}
