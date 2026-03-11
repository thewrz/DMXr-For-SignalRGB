import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildServer } from "../server.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import { createConnectionLog } from "../dmx/connection-log.js";
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
