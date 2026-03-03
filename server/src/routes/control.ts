import type { FastifyInstance } from "fastify";
import type { UniverseManager } from "../dmx/universe-manager.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { FixtureConfig } from "../types/protocol.js";
import { mapColor } from "../fixtures/channel-mapper.js";
import { analyzeFixture } from "../fixtures/fixture-capabilities.js";
import { pipeLog } from "../logging/pipeline-logger.js";

interface ControlRouteDeps {
  readonly manager: UniverseManager;
  readonly store: FixtureStore;
}

interface TestBody {
  readonly action: "flash" | "flash-hold" | "flash-release" | "identify";
  readonly durationMs?: number;
}

const testSchema = {
  body: {
    type: "object" as const,
    required: ["action"],
    properties: {
      action: {
        type: "string" as const,
        enum: ["flash", "flash-hold", "flash-release", "identify"],
      },
      durationMs: { type: "integer" as const, minimum: 100, maximum: 5000 },
    },
  },
};

const FLASH_HOLD_SAFETY_MS = 10_000;

export function registerControlRoutes(
  app: FastifyInstance,
  deps: ControlRouteDeps,
): void {
  const activeTimers = new Map<string, NodeJS.Timeout>();
  const holdSnapshots = new Map<string, Record<number, number>>();

  function restoreAfterFlash(
    fixture: FixtureConfig,
    snapshot: Record<number, number>,
  ): void {
    if (deps.manager.isBlackoutActive()) {
      const zeros: Record<number, number> = {};
      for (const ch of fixture.channels) {
        zeros[fixture.dmxStartAddress + ch.offset] = 0;
      }
      deps.manager.applyRawUpdate(zeros);
    } else {
      deps.manager.applyRawUpdate(snapshot);
    }
  }

  app.post("/control/blackout", async (request) => {
    deps.manager.blackout();
    const fixtures = deps.store.getAll();
    request.log.info(
      { action: "blackout", fixtureCount: fixtures.length },
      "blackout: all 512 channels → 0",
    );
    return { success: true, action: "blackout" };
  });

  app.post("/control/whiteout", async (request) => {
    const fixtures = deps.store.getAll();

    // All 512 channels to 255 — works even with no fixtures in store
    deps.manager.whiteout();

    // Overlay fixture-specific values via mapColor for correct
    // non-color channels (pan center, strobe open, dimmer full, etc.)
    const allUpdates: Record<number, number> = {};
    for (const fixture of fixtures) {
      const channels = mapColor(fixture, 255, 255, 255, 1.0);
      for (const [addr, val] of Object.entries(channels)) {
        allUpdates[Number(addr)] = val;
      }
    }

    if (Object.keys(allUpdates).length > 0) {
      deps.manager.applyRawUpdate(allUpdates);
    }

    request.log.info(
      {
        action: "whiteout",
        fixtureCount: fixtures.length,
        channelsSet: Object.keys(allUpdates).length,
      },
      `whiteout: ${fixtures.length} fixtures, ${Object.keys(allUpdates).length} channels set via mapColor`,
    );

    return {
      success: true,
      action: "whiteout",
      fixturesUpdated: fixtures.length,
    };
  });

  app.post("/control/resume", async (request) => {
    deps.manager.resumeNormal();
    request.log.info(
      { action: "resume" },
      "resume: blackout/whiteout override cleared",
    );
    return { success: true, action: "resume" };
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
      const snapshot = deps.manager.getChannelSnapshot(base, count);

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
        `DEBUG fixture "${fixture.name}" (base=${base}):\n` +
        channels.map((ch) =>
          `  [${ch.offset}] DMX${ch.dmxAddress} ${ch.name.padEnd(16)} ` +
          `buffer=${ch.currentDmxValue} ovr=${ch.overrideEnabled ? "ON" : "off"}(${ch.overrideValue})`
        ).join("\n"),
      );

      return {
        fixture: fixture.name,
        id: fixture.id,
        dmxStartAddress: base,
        channelCount: count,
        blackoutActive: deps.manager.isBlackoutActive(),
        activeChannels: deps.manager.getActiveChannelCount(),
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
          restoreAfterFlash(fixture, snapshot);
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
        deps.manager.applyRawUpdate(flashValues);

        request.log.info(
          { action, fixtureId: fixture.id, fixtureName: fixture.name },
          `flash-hold: "${fixture.name}" held on`,
        );

        // Safety timeout in case browser disconnects mid-hold
        const safety = setTimeout(() => {
          const snap = holdSnapshots.get(fixture.id);
          if (snap !== undefined) {
            restoreAfterFlash(fixture, snap);
            holdSnapshots.delete(fixture.id);
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

      if (action === "flash-release") {
        const snapshot =
          holdSnapshots.get(fixture.id) ??
          deps.manager.getChannelSnapshot(start, count);
        restoreAfterFlash(fixture, snapshot);
        holdSnapshots.delete(fixture.id);

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
