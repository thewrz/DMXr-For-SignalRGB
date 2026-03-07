import type { FastifyInstance } from "fastify";
import type { ConnectionLog } from "../dmx/connection-log.js";

interface DiagnosticsRouteDeps {
  readonly connectionLog: ConnectionLog;
}

export function registerDiagnosticsRoutes(
  app: FastifyInstance,
  deps: DiagnosticsRouteDeps,
): void {
  app.get<{
    Querystring: { universeId?: string; since?: string; limit?: string };
  }>("/api/diagnostics/connection-log", async (request) => {
    const { universeId, since, limit } = request.query;
    return deps.connectionLog.getEvents({
      universeId,
      since,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  });

  app.post("/api/diagnostics/connection-log/clear", async () => {
    deps.connectionLog.clear();
    return { success: true };
  });

  app.get("/api/diagnostics/connection-log/stream", async (request, reply) => {
    const isRealConnection = request.raw.socket?.writable === true;

    if (!isRealConnection) {
      return reply
        .header("Content-Type", "text/event-stream")
        .header("Cache-Control", "no-cache")
        .header("Connection", "keep-alive")
        .send("");
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const unsubscribe = deps.connectionLog.subscribe((event) => {
      reply.raw.write(`data:${JSON.stringify(event)}\n\n`);
    });

    request.raw.on("close", () => {
      unsubscribe();
    });

    await reply.hijack();
  });
}
