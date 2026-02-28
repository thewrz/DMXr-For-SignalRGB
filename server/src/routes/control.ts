import type { FastifyInstance } from "fastify";
import type { UniverseManager } from "../dmx/universe-manager.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { FixtureConfig } from "../types/protocol.js";
import { mapColor } from "../fixtures/channel-mapper.js";
import { analyzeFixture } from "../fixtures/fixture-capabilities.js";

interface ControlRouteDeps {
  readonly manager: UniverseManager;
  readonly store: FixtureStore;
}

interface TestBody {
  readonly action: "flash" | "identify";
  readonly durationMs?: number;
}

const testSchema = {
  body: {
    type: "object" as const,
    required: ["action"],
    properties: {
      action: { type: "string" as const, enum: ["flash", "identify"] },
      durationMs: { type: "integer" as const, minimum: 100, maximum: 5000 },
    },
  },
};

export function registerControlRoutes(
  app: FastifyInstance,
  deps: ControlRouteDeps,
): void {
  const activeTimers = new Map<string, NodeJS.Timeout>();

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

  app.post<{ Params: { id: string }; Body: TestBody }>(
    "/fixtures/:id/test",
    { schema: testSchema },
    async (request, reply) => {
      if (deps.manager.isBlackoutActive()) {
        return reply.status(409).send({ error: "Cannot flash during blackout/whiteout override" });
      }

      const fixture = deps.store.getById(request.params.id);

      if (fixture === undefined) {
        request.log.warn({ fixtureId: request.params.id }, "flash: fixture not found");
        return reply.status(404).send({ error: "Fixture not found" });
      }

      const { action, durationMs = 500 } = request.body;
      const start = fixture.dmxStartAddress;
      const count = fixture.channelCount;

      const existingTimer = activeTimers.get(fixture.id);
      if (existingTimer !== undefined) {
        clearTimeout(existingTimer);
        activeTimers.delete(fixture.id);
      }

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
        deps.manager.applyRawUpdate(snapshot);
        request.log.info(
          { action: "flash-restore", fixtureId: fixture.id },
          `flash-restore: "${fixture.name}" restored to snapshot`,
        );
        activeTimers.delete(fixture.id);
      }, durationMs);
      timer.unref();

      activeTimers.set(fixture.id, timer);

      return {
        success: true,
        action,
        fixtureId: fixture.id,
        durationMs,
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
