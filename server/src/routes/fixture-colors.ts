import type { FastifyInstance } from "fastify";
import type { DmxMonitor } from "../dmx/dmx-monitor.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import { extractFixtureColor } from "../fixtures/fixture-color-extractor.js";

interface FixtureColorRouteDeps {
  readonly monitor: DmxMonitor;
  readonly fixtureStore: FixtureStore;
}

function buildColorSnapshot(deps: FixtureColorRouteDeps, universeId?: string) {
  const snapshot = deps.monitor.getSnapshot(universeId);
  const fixtures = deps.fixtureStore.getAll();

  // During blackout/whiteout the hardware output diverges from activeChannels,
  // so synthesize channel values that match what the fixtures actually output.
  let channelValues = snapshot.channels;
  if (snapshot.controlMode === "blackout" || snapshot.controlMode === "whiteout") {
    const overrideValue = snapshot.controlMode === "blackout" ? 0 : 255;
    channelValues = {};
    for (const f of fixtures) {
      for (const ch of f.channels) {
        channelValues[f.dmxStartAddress + ch.offset] = overrideValue;
      }
    }
  }

  return {
    fixtures: fixtures.map((f) => ({
      id: f.id,
      color: extractFixtureColor(f.channels, f.dmxStartAddress, channelValues),
    })),
  };
}

export function registerFixtureColorRoutes(
  app: FastifyInstance,
  deps: FixtureColorRouteDeps,
): void {
  app.get<{ Querystring: { universeId?: string } }>(
    "/api/fixtures/colors",
    { config: { rateLimit: { max: 300, timeWindow: "1 minute" } } },
    async (request) => {
      return buildColorSnapshot(deps, request.query.universeId);
    },
  );

  app.get<{ Querystring: { universeId?: string } }>(
    "/api/fixtures/colors/stream",
    async (request, reply) => {
      const universeId = request.query.universeId;
      const initial = buildColorSnapshot(deps, universeId);
      const initialPayload = `data:${JSON.stringify(initial)}\n\n`;

      const isRealConnection = request.raw.socket?.writable === true;

      if (!isRealConnection) {
        return reply
          .header("Content-Type", "text/event-stream")
          .header("Cache-Control", "no-cache")
          .header("Connection", "keep-alive")
          .send(initialPayload);
      }

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      reply.raw.write(initialPayload);

      const unsubscribe = deps.monitor.subscribe(() => {
        const payload = buildColorSnapshot(deps, universeId);
        reply.raw.write(`data:${JSON.stringify(payload)}\n\n`);
      }, universeId);

      request.raw.on("close", () => {
        unsubscribe();
      });

      await reply.hijack();
    },
  );
}
