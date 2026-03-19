import type { FastifyInstance } from "fastify";
import type { LogBuffer, LogEntry, LogLevel, LogSource } from "../logging/log-buffer.js";

interface LogRouteDeps {
  readonly logBuffer: LogBuffer;
}

const VALID_LEVELS = new Set<LogLevel>(["error", "warn", "info", "debug"]);
const VALID_SOURCES = new Set<LogSource>(["connection", "pipeline", "server", "api"]);

/** Max SSE flushes per second per subscriber. */
const STREAM_FLUSH_INTERVAL_MS = 250;
/** Max entries batched before forcing a flush (back-pressure safety valve). */
const STREAM_BATCH_LIMIT = 50;

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

    // Throttled SSE: batch entries and flush at a fixed interval.
    // Error/warn entries flush immediately; debug entries are batched.
    let pending: LogEntry[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let droppedCount = 0;

    function flush(): void {
      if (reply.raw.destroyed) return;
      if (pending.length === 0 && droppedCount === 0) return;

      const batch = pending;
      const dropped = droppedCount;
      pending = [];
      droppedCount = 0;

      if (dropped > 0) {
        const summary: LogEntry = {
          timestamp: new Date().toISOString(),
          level: "warn",
          source: "server",
          message: `${dropped} debug log entries dropped (rate too high)`,
        };
        reply.raw.write(`data:${JSON.stringify(summary)}\n\n`);
      }

      for (const entry of batch) {
        reply.raw.write(`data:${JSON.stringify(entry)}\n\n`);
      }
    }

    function scheduleFlush(): void {
      if (flushTimer !== null) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
      }, STREAM_FLUSH_INTERVAL_MS);
    }

    const unsubscribe = deps.logBuffer.subscribe((entry) => {
      if (reply.raw.destroyed) return;

      // Error and warn entries flush immediately — never delay bad news.
      if (entry.level === "error" || entry.level === "warn") {
        pending.push(entry);
        flush();
        return;
      }

      // Debug/info entries are batched; drop excess debug entries under load.
      if (pending.length >= STREAM_BATCH_LIMIT) {
        if (entry.level === "debug") {
          droppedCount++;
          return;
        }
      }

      pending.push(entry);
      scheduleFlush();
    });

    const heartbeat = setInterval(() => {
      if (reply.raw.destroyed) {
        clearInterval(heartbeat);
        if (flushTimer !== null) clearTimeout(flushTimer);
        unsubscribe();
        return;
      }
      reply.raw.write(":heartbeat\n\n");
    }, 30_000);
    heartbeat.unref();

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      if (flushTimer !== null) clearTimeout(flushTimer);
      unsubscribe();
    });

    await reply.hijack();
  });
}
