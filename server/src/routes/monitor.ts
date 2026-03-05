import type { FastifyInstance } from "fastify";
import type { DmxMonitor } from "../dmx/dmx-monitor.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";

interface MonitorRouteDeps {
  readonly monitor: DmxMonitor;
  readonly fixtureStore?: FixtureStore;
}

export function registerMonitorRoutes(
  app: FastifyInstance,
  deps: MonitorRouteDeps,
): void {
  app.get<{ Querystring: { universeId?: string; grouped?: string } }>(
    "/api/dmx/snapshot",
    { config: { rateLimit: { max: 300, timeWindow: "1 minute" } } },
    async (request) => {
      const snapshot = deps.monitor.getSnapshot();
      const grouped = request.query.grouped === "true";

      if (grouped && deps.fixtureStore) {
        const fixtures = deps.fixtureStore.getAll().map((fixture) => ({
          id: fixture.id,
          name: fixture.name,
          dmxStartAddress: fixture.dmxStartAddress,
          channelCount: fixture.channelCount,
          channels: fixture.channels.map((ch) => ({
            offset: ch.offset,
            name: ch.name,
            type: ch.type,
            color: ch.color ?? null,
            dmxAddress: fixture.dmxStartAddress + ch.offset,
            value: snapshot.channels[fixture.dmxStartAddress + ch.offset] ?? 0,
          })),
        }));

        return { ...snapshot, fixtures };
      }

      return snapshot;
    },
  );

  app.get<{ Querystring: { universeId?: string; fps?: string } }>(
    "/api/dmx/monitor",
    async (request, reply) => {
      const initial = deps.monitor.getSnapshot();
      const initialPayload = `data:${JSON.stringify(initial)}\n\n`;

      // Fastify inject() uses a mock socket — detect and return a single frame
      // Real browsers use EventSource which keeps the connection alive
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

      const unsubscribe = deps.monitor.subscribe((frame) => {
        reply.raw.write(`data:${JSON.stringify(frame)}\n\n`);
      });

      request.raw.on("close", () => {
        unsubscribe();
      });

      await reply.hijack();
    },
  );
}
