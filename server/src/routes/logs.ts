import type { FastifyInstance } from "fastify";
import type { LogBuffer, LogLevel, LogSource } from "../logging/log-buffer.js";

interface LogRouteDeps {
  readonly logBuffer: LogBuffer;
}

const VALID_LEVELS = new Set<LogLevel>(["error", "warn", "info", "debug"]);
const VALID_SOURCES = new Set<LogSource>(["connection", "pipeline", "server", "api"]);

export function registerLogRoutes(
  app: FastifyInstance,
  deps: LogRouteDeps,
): void {
  app.get<{
    Querystring: { level?: string; source?: string; since?: string; limit?: string };
  }>("/api/logs", async (request) => {
    const { level, source, since, limit } = request.query;
    return deps.logBuffer.getEntries({
      level: level && VALID_LEVELS.has(level as LogLevel) ? (level as LogLevel) : undefined,
      source: source && VALID_SOURCES.has(source as LogSource) ? (source as LogSource) : undefined,
      since,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  });

  app.post("/api/logs/clear", async () => {
    deps.logBuffer.clear();
    return { success: true };
  });

  app.get("/api/logs/stream", async (request, reply) => {
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

    const unsubscribe = deps.logBuffer.subscribe((entry) => {
      if (!reply.raw.destroyed) {
        reply.raw.write(`data:${JSON.stringify(entry)}\n\n`);
      }
    });

    const heartbeat = setInterval(() => {
      if (reply.raw.destroyed) {
        clearInterval(heartbeat);
        unsubscribe();
        return;
      }
      reply.raw.write(":heartbeat\n\n");
    }, 30_000);
    heartbeat.unref();

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });

    await reply.hijack();
  });
}
