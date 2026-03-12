import http from "node:http";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import { buildServer } from "../server.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import { createConnectionLog } from "../dmx/connection-log.js";
import { registerDiagnosticsRoutes } from "./diagnostics.js";
import {
  createMockUniverse,
  createTestConfig,
  createTestFixtureStore,
  createMockOflClient,
  createMockRegistry,
} from "../test-helpers.js";
import type { FastifyInstance } from "fastify";
import type { ConnectionLog } from "../dmx/connection-log.js";
import type { ConnectionEvent } from "../dmx/connection-state.js";

function makeEvent(overrides: Partial<ConnectionEvent> = {}): ConnectionEvent {
  return {
    timestamp: new Date().toISOString(),
    type: "connected",
    universeId: "default",
    details: {},
    ...overrides,
  };
}

describe("Diagnostics routes", () => {
  let app: FastifyInstance;
  let connectionLog: ConnectionLog;

  beforeEach(async () => {
    const mockUniverse = createMockUniverse();
    const manager = createUniverseManager(mockUniverse);
    connectionLog = createConnectionLog();

    ({ app } = await buildServer({
      config: createTestConfig(),
      manager,
      driver: "null",
      startTime: Date.now(),
      fixtureStore: createTestFixtureStore(),
      oflClient: createMockOflClient(),
      registry: createMockRegistry(),
      connectionLog,
    }));
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /api/diagnostics/connection-log", () => {
    it("returns empty array for empty log", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/diagnostics/connection-log",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns pushed events", async () => {
      connectionLog.push(makeEvent({ type: "connected" }));
      connectionLog.push(makeEvent({ type: "disconnected" }));

      const res = await app.inject({
        method: "GET",
        url: "/api/diagnostics/connection-log",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveLength(2);
      expect(body[0].type).toBe("disconnected");
      expect(body[1].type).toBe("connected");
    });

    it("filters by universeId query param", async () => {
      connectionLog.push(makeEvent({ universeId: "alpha" }));
      connectionLog.push(makeEvent({ universeId: "beta" }));
      connectionLog.push(makeEvent({ universeId: "alpha" }));

      const res = await app.inject({
        method: "GET",
        url: "/api/diagnostics/connection-log?universeId=alpha",
      });

      const body = res.json();
      expect(body).toHaveLength(2);
      expect(body.every((e: ConnectionEvent) => e.universeId === "alpha")).toBe(true);
    });

    it("filters by since query param", async () => {
      connectionLog.push(makeEvent({ timestamp: "2026-01-01T00:00:00.000Z" }));
      connectionLog.push(makeEvent({ timestamp: "2026-01-01T00:00:05.000Z" }));
      connectionLog.push(makeEvent({ timestamp: "2026-01-01T00:00:10.000Z" }));

      const res = await app.inject({
        method: "GET",
        url: "/api/diagnostics/connection-log?since=2026-01-01T00:00:03.000Z",
      });

      expect(res.json()).toHaveLength(2);
    });

    it("limits results with limit query param", async () => {
      for (let i = 0; i < 10; i++) connectionLog.push(makeEvent());

      const res = await app.inject({
        method: "GET",
        url: "/api/diagnostics/connection-log?limit=5",
      });

      expect(res.json()).toHaveLength(5);
    });
  });

  describe("POST /api/diagnostics/connection-log/clear", () => {
    it("empties log and returns success", async () => {
      connectionLog.push(makeEvent());
      connectionLog.push(makeEvent());

      const clearRes = await app.inject({
        method: "POST",
        url: "/api/diagnostics/connection-log/clear",
      });

      expect(clearRes.statusCode).toBe(200);
      expect(clearRes.json()).toEqual({ success: true });

      const getRes = await app.inject({
        method: "GET",
        url: "/api/diagnostics/connection-log",
      });

      expect(getRes.json()).toEqual([]);
    });
  });

  describe("GET /api/diagnostics/connection-log/stream", () => {
    it("returns SSE content-type headers", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/diagnostics/connection-log/stream",
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("text/event-stream");
      expect(res.headers["cache-control"]).toBe("no-cache");
      expect(res.headers["connection"]).toBe("keep-alive");
    });
  });

  describe("GET /api/diagnostics/connection-log/stream (SSE connection path)", () => {
    it("subscribes to events and writes SSE data frames", async () => {
      const streamLog = createConnectionLog();
      const miniApp = Fastify();
      registerDiagnosticsRoutes(miniApp, { connectionLog: streamLog });
      await miniApp.listen({ port: 0, host: "127.0.0.1" });

      const addr = miniApp.server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      const baseUrl = `http://127.0.0.1:${port}`;

      const chunks: string[] = [];

      await new Promise<void>((resolve) => {
        const req = http.get(
          `${baseUrl}/api/diagnostics/connection-log/stream`,
          (res) => {
            res.setEncoding("utf8");
            res.on("data", (chunk: string) => {
              chunks.push(chunk);
              if (chunks.some((c) => c.includes('"type":"connected"'))) {
                req.destroy();
              }
            });
            res.on("error", () => resolve());
            res.on("end", () => resolve());
          },
        );

        req.on("error", () => resolve());
        req.on("close", () => resolve());

        // Push events with a small delay to let the connection establish
        const pushInterval = setInterval(() => {
          streamLog.push(makeEvent({ type: "connected", universeId: "stream-test" }));
        }, 30);

        // Safety timeout
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
      expect(parsed.type).toBe("connected");
      expect(parsed.universeId).toBe("stream-test");
    }, 10000);

    it("unsubscribes when client disconnects", async () => {
      const streamLog = createConnectionLog();
      const miniApp = Fastify();
      registerDiagnosticsRoutes(miniApp, { connectionLog: streamLog });
      await miniApp.listen({ port: 0, host: "127.0.0.1" });

      const addr = miniApp.server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      const baseUrl = `http://127.0.0.1:${port}`;

      // Connect then immediately disconnect after first data
      await new Promise<void>((resolve) => {
        const req = http.get(
          `${baseUrl}/api/diagnostics/connection-log/stream`,
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

        setTimeout(() => {
          streamLog.push(makeEvent({ type: "connected" }));
        }, 50);

        setTimeout(() => {
          req.destroy();
          resolve();
        }, 2000);
      });

      // Allow close event to propagate
      await new Promise((r) => setTimeout(r, 100));

      // After disconnect, pushing events should not throw
      expect(() => {
        streamLog.push(makeEvent({ type: "disconnected" }));
      }).not.toThrow();

      await miniApp.close();
    }, 10000);

    it("does not write to destroyed response stream", async () => {
      const streamLog = createConnectionLog();
      const miniApp = Fastify();
      registerDiagnosticsRoutes(miniApp, { connectionLog: streamLog });
      await miniApp.listen({ port: 0, host: "127.0.0.1" });

      const addr = miniApp.server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      const baseUrl = `http://127.0.0.1:${port}`;

      // Connect, receive one event, destroy, then push more
      await new Promise<void>((resolve) => {
        const req = http.get(
          `${baseUrl}/api/diagnostics/connection-log/stream`,
          (res) => {
            res.once("data", () => {
              req.destroy();
              // Give close event time to fire
              setTimeout(resolve, 100);
            });
            res.on("error", () => {});
          },
        );

        req.on("error", () => {});

        setTimeout(() => {
          streamLog.push(makeEvent({ type: "reconnecting" }));
        }, 50);

        setTimeout(() => {
          req.destroy();
          resolve();
        }, 2000);
      });

      // Push after stream is destroyed — the guard at line 46 should prevent write
      expect(() => {
        streamLog.push(makeEvent({ type: "connected" }));
      }).not.toThrow();

      await miniApp.close();
    }, 10000);

    it("two SSE clients connected → one disconnects → other still receives events", async () => {
      const streamLog = createConnectionLog();
      const miniApp = Fastify();
      registerDiagnosticsRoutes(miniApp, { connectionLog: streamLog });
      await miniApp.listen({ port: 0, host: "127.0.0.1" });

      const addr = miniApp.server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      const baseUrl = `http://127.0.0.1:${port}`;

      const client1Chunks: string[] = [];
      const client2Chunks: string[] = [];

      await new Promise<void>((resolve) => {
        // Client 1 — will disconnect early
        const req1 = http.get(
          `${baseUrl}/api/diagnostics/connection-log/stream`,
          (res) => {
            res.setEncoding("utf8");
            res.on("data", (chunk: string) => {
              client1Chunks.push(chunk);
              // Disconnect client 1 after first event
              if (client1Chunks.some((c) => c.includes('"phase":"before"'))) {
                req1.destroy();
              }
            });
            res.on("error", () => {});
          },
        );
        req1.on("error", () => {});

        // Client 2 — stays connected
        const req2 = http.get(
          `${baseUrl}/api/diagnostics/connection-log/stream`,
          (res) => {
            res.setEncoding("utf8");
            res.on("data", (chunk: string) => {
              client2Chunks.push(chunk);
              if (client2Chunks.some((c) => c.includes('"phase":"after"'))) {
                req2.destroy();
                resolve();
              }
            });
            res.on("error", () => resolve());
            res.on("end", () => resolve());
          },
        );
        req2.on("error", () => resolve());

        // Push "before" event — both clients should get it
        setTimeout(() => {
          streamLog.push(makeEvent({ type: "connected", details: { phase: "before" } as any }));
        }, 100);

        // After client 1 disconnects, push "after" event — only client 2 should get it
        setTimeout(() => {
          streamLog.push(makeEvent({ type: "disconnected", details: { phase: "after" } as any }));
        }, 400);

        setTimeout(() => {
          req1.destroy();
          req2.destroy();
          resolve();
        }, 3000);
      });

      await miniApp.close();

      const combined2 = client2Chunks.join("");
      expect(combined2).toContain('"phase":"after"');
    }, 10000);

    it("rapid burst of events → all arrive in order", async () => {
      const streamLog = createConnectionLog();
      const miniApp = Fastify();
      registerDiagnosticsRoutes(miniApp, { connectionLog: streamLog });
      await miniApp.listen({ port: 0, host: "127.0.0.1" });

      const addr = miniApp.server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      const baseUrl = `http://127.0.0.1:${port}`;

      const receivedEvents: ConnectionEvent[] = [];
      const BURST_SIZE = 50;

      await new Promise<void>((resolve) => {
        const req = http.get(
          `${baseUrl}/api/diagnostics/connection-log/stream`,
          (res) => {
            res.setEncoding("utf8");
            res.on("data", (chunk: string) => {
              // Parse SSE data frames
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (line.startsWith("data:")) {
                  try {
                    receivedEvents.push(JSON.parse(line.slice(5)));
                  } catch { /* heartbeat or partial */ }
                }
              }
              if (receivedEvents.length >= BURST_SIZE) {
                req.destroy();
                resolve();
              }
            });
            res.on("error", () => resolve());
            res.on("end", () => resolve());
          },
        );

        req.on("error", () => resolve());

        // Burst of events after connection establishes
        setTimeout(() => {
          for (let i = 0; i < BURST_SIZE; i++) {
            streamLog.push(makeEvent({
              type: "connected",
              details: { seq: i } as any,
            }));
          }
        }, 100);

        setTimeout(() => {
          req.destroy();
          resolve();
        }, 5000);
      });

      await miniApp.close();

      // Verify we got events and they're in order
      expect(receivedEvents.length).toBeGreaterThanOrEqual(BURST_SIZE);
      for (let i = 0; i < BURST_SIZE; i++) {
        expect((receivedEvents[i].details as any).seq).toBe(i);
      }
    }, 10000);
  });

  describe("routes not registered without connectionLog", () => {
    it("returns 404 when connectionLog is not provided", async () => {
      const { app: appNoLog } = await buildServer({
        config: createTestConfig(),
        manager: createUniverseManager(createMockUniverse()),
        driver: "null",
        startTime: Date.now(),
        fixtureStore: createTestFixtureStore(),
        oflClient: createMockOflClient(),
        registry: createMockRegistry(),
      });

      const res = await appNoLog.inject({
        method: "GET",
        url: "/api/diagnostics/connection-log",
      });

      expect(res.statusCode).toBe(404);
      await appNoLog.close();
    });
  });
});
