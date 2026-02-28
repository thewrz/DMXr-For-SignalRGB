import type { FastifyInstance } from "fastify";
import type { UniverseManager } from "../dmx/universe-manager.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { FixtureConfig } from "../types/protocol.js";

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

  app.post("/control/blackout", async () => {
    deps.manager.blackout();
    return { success: true, action: "blackout" };
  });

  app.post("/control/whiteout", async () => {
    deps.manager.whiteout();
    return { success: true, action: "whiteout" };
  });

  app.post<{ Params: { id: string }; Body: TestBody }>(
    "/fixtures/:id/test",
    { schema: testSchema },
    async (request, reply) => {
      const fixture = deps.store.getById(request.params.id);

      if (fixture === undefined) {
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

      const timer = setTimeout(() => {
        deps.manager.applyRawUpdate(snapshot);
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

const FLASHABLE_TYPES = new Set(["ColorIntensity", "Intensity", "Strobe", "ShutterStrobe"]);

function buildFlashValues(
  fixture: FixtureConfig,
  snapshot: Record<number, number>,
): Record<number, number> {
  const start = fixture.dmxStartAddress;
  const result: Record<number, number> = {};

  for (const channel of fixture.channels) {
    const addr = start + channel.offset;
    result[addr] = FLASHABLE_TYPES.has(channel.type)
      ? 255
      : (snapshot[addr] ?? channel.defaultValue);
  }

  return result;
}
