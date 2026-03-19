import http from "node:http";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import { buildServer } from "../server.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import { createLogBuffer, type LogBuffer, type LogEntry } from "../logging/log-buffer.js";
import { registerLogRoutes } from "./logs.js";
import {
  createMockUniverse,
  createTestConfig,
  createTestFixtureStore,
  createMockOflClient,
  createMockRegistry,
} from "../test-helpers.js";
import type { FastifyInstance } from "fastify";

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level: "info",
    source: "server",
    message: "test entry",
    ...overrides,
  };
}

describe("Log routes", () => {
  let app: FastifyInstance;
  let logBuffer: LogBuffer;

  beforeEach(async () => {
    const mockUniverse = createMockUniverse();
    const manager = createUniverseManager(mockUniverse);
    logBuffer = createLogBuffer();

    ({ app } = await buildServer({
      config: createTestConfig(),
      manager,
      driver: "null",
      startTime: Date.now(),
      fixtureStore: createTestFixtureStore(),
      oflClient: createMockOflClient(),
      registry: createMockRegistry(),
      logBuffer,
    }));
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/logs", () => {
    it("returns empty array for empty buffer", async () => {
      const res = await app.inject({ method: "GET", url: "/api/logs" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns pushed entries", async () => {
      logBuffer.push(makeEntry({ message: "first" }));
      logBuffer.push(makeEntry({ message: "second" }));

      const res = await app.inject({ method: "GET", url: "/api/logs" });
      const body = res.json();
      expect(body).toHaveLength(2);
      expect(body[0].message).toBe("second");
      expect(body[1].message).toBe("first");
    });

    it("filters by level query param", async () => {
      logBuffer.push(makeEntry({ level: "debug" }));
      logBuffer.push(makeEntry({ level: "info" }));
      logBuffer.push(makeEntry({ level: "error" }));

      const res = await app.inject({ method: "GET", url: "/api/logs?level=error" });
      const body = res.json();
      expect(body).toHaveLength(1);
      expect(body[0].level).toBe("error");
    });

    it("filters by source query param", async () => {
      logBuffer.push(makeEntry({ source: "pipeline" }));
      logBuffer.push(makeEntry({ source: "connection" }));
      logBuffer.push(makeEntry({ source: "pipeline" }));

      const res = await app.inject({ method: "GET", url: "/api/logs?source=pipeline" });
      const body = res.json();
      expect(body).toHaveLength(2);
      expect(body.every((e: LogEntry) => e.source === "pipeline")).toBe(true);
    });

    it("filters by since query param", async () => {
      logBuffer.push(makeEntry({ timestamp: "2026-01-01T00:00:00Z" }));
      logBuffer.push(makeEntry({ timestamp: "2026-06-01T00:00:00Z" }));

      const res = await app.inject({
        method: "GET",
        url: "/api/logs?since=2026-03-01T00:00:00Z",
      });
      expect(res.json()).toHaveLength(1);
    });

    it("applies limit query param", async () => {
      for (let i = 0; i < 10; i++) logBuffer.push(makeEntry());
      const res = await app.inject({ method: "GET", url: "/api/logs?limit=3" });
      expect(res.json()).toHaveLength(3);
    });

    it("ignores invalid level values", async () => {
      logBuffer.push(makeEntry({ level: "debug" }));
      logBuffer.push(makeEntry({ level: "info" }));

      const res = await app.inject({ method: "GET", url: "/api/logs?level=bogus" });
      expect(res.json()).toHaveLength(2);
    });

    it("ignores invalid source values", async () => {
      logBuffer.push(makeEntry({ source: "server" }));

      const res = await app.inject({ method: "GET", url: "/api/logs?source=bogus" });
      expect(res.json()).toHaveLength(1);
    });
  });

  describe("POST /api/logs/clear", () => {
    it("clears buffer and returns success", async () => {
      logBuffer.push(makeEntry());
      logBuffer.push(makeEntry());

      const clearRes = await app.inject({ method: "POST", url: "/api/logs/clear" });
      expect(clearRes.statusCode).toBe(200);
      expect(clearRes.json()).toEqual({ success: true });

      const getRes = await app.inject({ method: "GET", url: "/api/logs" });
      expect(getRes.json()).toEqual([]);
    });
  });

  describe("GET /api/logs/stream", () => {
    it("returns SSE content-type headers", async () => {
      const res = await app.inject({ method: "GET", url: "/api/logs/stream" });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("text/event-stream");
      expect(res.headers["cache-control"]).toBe("no-cache");
    });
  });

  describe("GET /api/logs/stream (SSE connection)", () => {
    it("streams pushed entries as SSE data frames", async () => {
      const streamBuf = createLogBuffer();
      const miniApp = Fastify();
      registerLogRoutes(miniApp, { logBuffer: streamBuf });
      await miniApp.listen({ port: 0, host: "127.0.0.1" });

      const addr = miniApp.server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;

      const chunks: string[] = [];

      await new Promise<void>((resolve) => {
        const req = http.get(
          `http://127.0.0.1:${port}/api/logs/stream`,
          (res) => {
            res.setEncoding("utf8");
            res.on("data", (chunk: string) => {
              chunks.push(chunk);
              if (chunks.some((c) => c.includes('"message":"streamed"'))) {
                req.destroy();
              }
            });
            res.on("error", () => resolve());
            res.on("end", () => resolve());
          },
        );

        req.on("error", () => resolve());
        req.on("close", () => resolve());

        const pushInterval = setInterval(() => {
          streamBuf.push(makeEntry({ message: "streamed" }));
        }, 30);

        setTimeout(() => {
          clearInterval(pushInterval);
          req.destroy();
          resolve();
        }, 3000);
      });

      await miniApp.close();

      const combined = chunks.join("");
      expect(combined).toContain("data:");
      const dataMatch = combined.match(/data:(.+)\n/);
      expect(dataMatch).not.toBeNull();
      const parsed = JSON.parse(dataMatch![1]);
      expect(parsed.message).toBe("streamed");
    }, 10000);

    it("cleans up on client disconnect", async () => {
      const streamBuf = createLogBuffer();
      const miniApp = Fastify();
      registerLogRoutes(miniApp, { logBuffer: streamBuf });
      await miniApp.listen({ port: 0, host: "127.0.0.1" });

      const addr = miniApp.server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;

      await new Promise<void>((resolve) => {
        const req = http.get(
          `http://127.0.0.1:${port}/api/logs/stream`,
          (res) => {
            res.once("data", () => {
              req.destroy();
            });
            res.on("error", () => resolve());
            res.on("end", () => resolve());
          },
        );

        req.on("error", () => resolve());
        req.on("close", () => resolve());

        setTimeout(() => streamBuf.push(makeEntry()), 50);
        setTimeout(() => {
          req.destroy();
          resolve();
        }, 2000);
      });

      await new Promise((r) => setTimeout(r, 100));

      expect(() => {
        streamBuf.push(makeEntry({ message: "after disconnect" }));
      }).not.toThrow();

      await miniApp.close();
    }, 10000);
  });

  describe("routes not registered without logBuffer", () => {
    it("returns 404 when logBuffer is not provided", async () => {
      const { app: appNoLog } = await buildServer({
        config: createTestConfig(),
        manager: createUniverseManager(createMockUniverse()),
        driver: "null",
        startTime: Date.now(),
        fixtureStore: createTestFixtureStore(),
        oflClient: createMockOflClient(),
        registry: createMockRegistry(),
      });

      const res = await appNoLog.inject({ method: "GET", url: "/api/logs" });
      expect(res.statusCode).toBe(404);
      await appNoLog.close();
    });
  });
});
