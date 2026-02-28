import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DmxConnection, DmxUniverse } from "./driver-factory.js";
import type { DmxLogger } from "./universe-manager.js";
import type { ConnectionStatus } from "./connection-state.js";

// Mock driver-factory before importing resilient-connection
vi.mock("./driver-factory.js", () => ({
  createDmxConnection: vi.fn(),
}));

import { createResilientConnection } from "./resilient-connection.js";
import { createDmxConnection } from "./driver-factory.js";

const mockedCreateDmxConnection = vi.mocked(createDmxConnection);

function createMockConnection(overrides?: Partial<DmxConnection>): DmxConnection & {
  universe: DmxUniverse & {
    updateCalls: Array<Record<number, number>>;
    updateAllCalls: number[];
  };
  disconnectCallbacks: Array<(err?: Error) => void>;
} {
  const updateCalls: Array<Record<number, number>> = [];
  const updateAllCalls: number[] = [];
  const disconnectCallbacks: Array<(err?: Error) => void> = [];

  return {
    universe: {
      update: (channels) => updateCalls.push(channels),
      updateAll: (value) => updateAllCalls.push(value),
      updateCalls,
      updateAllCalls,
    },
    driver: "enttec-usb-dmx-pro",
    close: vi.fn(async () => {}),
    onDisconnect: (callback) => disconnectCallbacks.push(callback),
    disconnectCallbacks,
    ...overrides,
  };
}

function createSilentLogger(): DmxLogger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createTestConfig() {
  return {
    port: 8080,
    host: "127.0.0.1",
    dmxDriver: "enttec-usb-dmx-pro" as const,
    dmxDevicePath: "/dev/ttyUSB0",
    logLevel: "silent",
    fixturesPath: "/tmp/test.json",
    mdnsEnabled: false,
    portRangeSize: 10,
  };
}

describe("createResilientConnection", () => {
  let mockConn: ReturnType<typeof createMockConnection>;
  let logger: DmxLogger;

  beforeEach(() => {
    vi.useFakeTimers();
    mockConn = createMockConnection();
    mockedCreateDmxConnection.mockResolvedValue(mockConn);
    logger = createSilentLogger();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("proxy universe", () => {
    it("passes update() through to the real connection", async () => {
      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
      });

      conn.universe.update({ 1: 255, 2: 128 });

      expect(mockConn.universe.updateCalls).toEqual([{ 1: 255, 2: 128 }]);
      await conn.close();
    });

    it("passes updateAll() through to the real connection", async () => {
      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
      });

      conn.universe.updateAll(0);

      expect(mockConn.universe.updateAllCalls).toEqual([0]);
      await conn.close();
    });

    it("silently drops update() when disconnected", async () => {
      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
      });

      // Simulate USB disconnect
      const disconnectErr = new Error("disconnected") as Error & { disconnected: boolean };
      disconnectErr.disconnected = true;
      mockConn.disconnectCallbacks[0]?.(disconnectErr);

      conn.universe.update({ 1: 255 });

      // Only the calls before disconnect count
      expect(mockConn.universe.updateCalls).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("DMX update dropped"),
      );
      await conn.close();
    });

    it("silently drops updateAll() when disconnected", async () => {
      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
      });

      // Simulate USB disconnect
      mockConn.disconnectCallbacks[0]?.(new Error("gone"));

      conn.universe.updateAll(255);

      expect(mockConn.universe.updateAllCalls).toHaveLength(0);
      await conn.close();
    });

    it("logs dropped update only once per disconnect", async () => {
      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
      });

      mockConn.disconnectCallbacks[0]?.(new Error("gone"));

      conn.universe.update({ 1: 255 });
      conn.universe.update({ 2: 128 });
      conn.universe.update({ 3: 64 });

      expect(logger.warn).toHaveBeenCalledTimes(1);
      await conn.close();
    });
  });

  describe("initial connection failure", () => {
    it("starts in disconnected state and enters reconnect loop when device is missing", async () => {
      mockedCreateDmxConnection.mockReset();
      mockedCreateDmxConnection.mockRejectedValueOnce(
        new Error("Opening COM3: File not found"),
      );

      const stateChanges: ConnectionStatus[] = [];
      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
        onStateChange: (s) => stateChanges.push(s),
      });

      // Should NOT have crashed — should be in reconnecting state
      const lastState = stateChanges[stateChanges.length - 1];
      expect(lastState?.state).toBe("reconnecting");
      expect(lastState?.lastError).toBe("Opening COM3: File not found");

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Initial DMX connection failed"),
      );

      // Now simulate device appearing — reconnect succeeds
      const newMock = createMockConnection();
      mockedCreateDmxConnection.mockResolvedValueOnce(newMock);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(conn.getStatus().state).toBe("connected");
      expect(conn.getStatus().lastError).toBeNull();
      await conn.close();
    });

    it("keeps retrying with backoff when device stays missing", async () => {
      mockedCreateDmxConnection.mockReset();
      mockedCreateDmxConnection.mockRejectedValueOnce(
        new Error("Opening COM3: File not found"),
      );

      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
      });

      // First reconnect attempt also fails
      mockedCreateDmxConnection.mockRejectedValueOnce(
        new Error("Still no COM3"),
      );
      await vi.advanceTimersByTimeAsync(1_000);
      expect(conn.getStatus().reconnectAttempts).toBe(1);

      // Second attempt also fails (2s delay)
      mockedCreateDmxConnection.mockRejectedValueOnce(
        new Error("Nope"),
      );
      await vi.advanceTimersByTimeAsync(2_000);
      expect(conn.getStatus().reconnectAttempts).toBe(2);

      // Third attempt succeeds (4s delay)
      const newMock = createMockConnection();
      mockedCreateDmxConnection.mockResolvedValueOnce(newMock);
      await vi.advanceTimersByTimeAsync(4_000);

      expect(conn.getStatus().state).toBe("connected");
      await conn.close();
    });

    it("proxy universe drops updates while waiting for initial connection", async () => {
      mockedCreateDmxConnection.mockReset();
      mockedCreateDmxConnection.mockRejectedValueOnce(
        new Error("No device"),
      );

      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
      });

      // Should not throw — just silently drops
      conn.universe.update({ 1: 255 });
      conn.universe.updateAll(0);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("DMX update dropped"),
      );
      await conn.close();
    });
  });

  describe("initial connection", () => {
    it("starts in connected state", async () => {
      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
      });

      expect(conn.getStatus().state).toBe("connected");
      expect(conn.getStatus().reconnectAttempts).toBe(0);
      await conn.close();
    });

    it("registers disconnect listener on initial connection", async () => {
      await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
      });

      expect(mockConn.disconnectCallbacks).toHaveLength(1);
    });

    it("fires onStateChange callback on creation", async () => {
      const stateChanges: ConnectionStatus[] = [];

      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
        onStateChange: (s) => stateChanges.push(s),
      });

      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0]?.state).toBe("connected");
      await conn.close();
    });
  });

  describe("disconnect detection", () => {
    it("transitions to disconnected on USB removal", async () => {
      const stateChanges: ConnectionStatus[] = [];

      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
        onStateChange: (s) => stateChanges.push(s),
      });

      mockConn.disconnectCallbacks[0]?.(new Error("USB removed"));

      // disconnected → reconnecting (two transitions)
      const states = stateChanges.map((s) => s.state);
      expect(states).toContain("disconnected");
      expect(states).toContain("reconnecting");
      await conn.close();
    });

    it("logs the disconnect error", async () => {
      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
      });

      mockConn.disconnectCallbacks[0]?.(new Error("USB removed"));

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("USB removed"),
      );
      await conn.close();
    });
  });

  describe("reconnection", () => {
    it("attempts reconnect after disconnect with 1s initial delay", async () => {
      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
      });

      // Disconnect
      mockConn.disconnectCallbacks[0]?.(new Error("gone"));

      // New connection for reconnect
      const newMock = createMockConnection();
      mockedCreateDmxConnection.mockResolvedValueOnce(newMock);

      // Advance past the 1s delay
      await vi.advanceTimersByTimeAsync(1_000);

      expect(conn.getStatus().state).toBe("connected");
      expect(conn.getStatus().reconnectAttempts).toBe(0);
      await conn.close();
    });

    it("uses exponential backoff on repeated failures", async () => {
      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
      });

      mockConn.disconnectCallbacks[0]?.(new Error("gone"));

      // Fail first reconnect
      mockedCreateDmxConnection.mockRejectedValueOnce(new Error("still gone"));
      await vi.advanceTimersByTimeAsync(1_000);

      // After first failure, should be reconnecting with attempt=1
      expect(conn.getStatus().reconnectAttempts).toBe(1);
      expect(conn.getStatus().lastError).toBe("still gone");

      // Fail second reconnect
      mockedCreateDmxConnection.mockRejectedValueOnce(new Error("nope"));
      await vi.advanceTimersByTimeAsync(2_000);

      expect(conn.getStatus().reconnectAttempts).toBe(2);

      // Third attempt succeeds
      const newMock = createMockConnection();
      mockedCreateDmxConnection.mockResolvedValueOnce(newMock);
      await vi.advanceTimersByTimeAsync(4_000);

      expect(conn.getStatus().state).toBe("connected");
      expect(conn.getStatus().reconnectAttempts).toBe(0);
      await conn.close();
    });

    it("replays channel snapshot on successful reconnect", async () => {
      const snapshot = { 1: 255, 2: 128, 3: 64 };
      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => snapshot,
      });

      mockConn.disconnectCallbacks[0]?.(new Error("gone"));

      const newMock = createMockConnection();
      mockedCreateDmxConnection.mockResolvedValueOnce(newMock);

      await vi.advanceTimersByTimeAsync(1_000);

      expect(newMock.universe.updateCalls).toEqual([snapshot]);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Replayed 3 channels"),
      );
      await conn.close();
    });

    it("skips replay when snapshot is empty", async () => {
      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
      });

      mockConn.disconnectCallbacks[0]?.(new Error("gone"));

      const newMock = createMockConnection();
      mockedCreateDmxConnection.mockResolvedValueOnce(newMock);

      await vi.advanceTimersByTimeAsync(1_000);

      expect(newMock.universe.updateCalls).toHaveLength(0);
      await conn.close();
    });

    it("routes updates to new connection after reconnect", async () => {
      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
      });

      mockConn.disconnectCallbacks[0]?.(new Error("gone"));

      const newMock = createMockConnection();
      mockedCreateDmxConnection.mockResolvedValueOnce(newMock);
      await vi.advanceTimersByTimeAsync(1_000);

      conn.universe.update({ 10: 200 });

      expect(newMock.universe.updateCalls).toEqual([{ 10: 200 }]);
      expect(mockConn.universe.updateCalls).toHaveLength(0);
      await conn.close();
    });
  });

  describe("close", () => {
    it("closes the underlying connection", async () => {
      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
      });

      await conn.close();

      expect(mockConn.close).toHaveBeenCalledOnce();
    });

    it("cancels pending reconnect timer", async () => {
      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
      });

      mockConn.disconnectCallbacks[0]?.(new Error("gone"));

      // Close before reconnect fires
      await conn.close();

      // Advance timers — reconnect should NOT fire
      const newMock = createMockConnection();
      mockedCreateDmxConnection.mockResolvedValueOnce(newMock);
      await vi.advanceTimersByTimeAsync(5_000);

      // createDmxConnection was called once (initial) — not again for reconnect
      expect(mockedCreateDmxConnection).toHaveBeenCalledTimes(1);
    });

    it("ignores disconnect events after close", async () => {
      const stateChanges: ConnectionStatus[] = [];
      const conn = await createResilientConnection({
        config: createTestConfig(),
        logger,
        getChannelSnapshot: () => ({}),
        onStateChange: (s) => stateChanges.push(s),
      });

      await conn.close();

      // Fire disconnect after close — should be ignored
      mockConn.disconnectCallbacks[0]?.(new Error("late"));

      const postCloseChanges = stateChanges.filter(
        (_, i) => i > 0, // Skip the initial "connected" event
      );
      expect(postCloseChanges).toHaveLength(0);
    });
  });

  describe("null driver (no onDisconnect)", () => {
    it("works without onDisconnect hook", async () => {
      const nullMock = createMockConnection();
      // Remove onDisconnect to simulate null driver
      const { onDisconnect: _, ...withoutDisconnect } = nullMock;
      mockedCreateDmxConnection.mockResolvedValueOnce(
        withoutDisconnect as DmxConnection,
      );

      const conn = await createResilientConnection({
        config: { ...createTestConfig(), dmxDriver: "null" },
        logger,
        getChannelSnapshot: () => ({}),
      });

      expect(conn.getStatus().state).toBe("connected");
      conn.universe.update({ 1: 255 });
      expect(nullMock.universe.updateCalls).toEqual([{ 1: 255 }]);
      await conn.close();
    });
  });
});
