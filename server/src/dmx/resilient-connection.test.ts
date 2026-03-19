import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createResilientConnection } from "./resilient-connection.js";
import type { ResilientConnection } from "./resilient-connection.js";
import type { DmxConnection, DmxUniverse } from "./driver-factory.js";

vi.mock("./driver-factory.js", () => ({
  createDmxConnection: vi.fn(),
}));

vi.mock("./error-messages.js", () => ({
  translateDmxError: () => ({
    title: "Test Error",
    suggestion: "Check connection",
  }),
}));

import { createDmxConnection } from "./driver-factory.js";

const mockCreateDmxConnection = vi.mocked(createDmxConnection);

interface MockConnection {
  universe: {
    update: ReturnType<typeof vi.fn>;
    updateAll: ReturnType<typeof vi.fn>;
  };
  driver: string;
  close: ReturnType<typeof vi.fn>;
  onDisconnect: (cb: (err?: Error) => void) => void;
  triggerDisconnect: (err?: Error) => void;
}

function createMockConnection(): MockConnection {
  let onDisconnectCb: ((err?: Error) => void) | null = null;
  return {
    universe: {
      update: vi.fn(),
      updateAll: vi.fn(),
    },
    driver: "null",
    close: vi.fn().mockResolvedValue(undefined),
    onDisconnect: (cb: (err?: Error) => void) => {
      onDisconnectCb = cb;
    },
    triggerDisconnect: (err?: Error) => onDisconnectCb?.(err),
  };
}

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("createResilientConnection", () => {
  let conn: ResilientConnection | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCreateDmxConnection.mockReset();
  });

  afterEach(async () => {
    if (conn) {
      await conn.close();
      conn = null;
    }
    vi.useRealTimers();
  });

  describe("initial connection success", () => {
    it("delegates update to the real universe", async () => {
      const mock = createMockConnection();
      mockCreateDmxConnection.mockResolvedValue(mock as unknown as DmxConnection);

      conn = await createResilientConnection({
        config: { dmxDriver: "null", dmxDevicePath: "" } as never,
        logger: createLogger(),
        getChannelSnapshot: () => ({}),
      });

      conn.universe.update({ 1: 255 });

      expect(mock.universe.update).toHaveBeenCalledWith({ 1: 255 });
    });

    it("delegates updateAll to the real universe", async () => {
      const mock = createMockConnection();
      mockCreateDmxConnection.mockResolvedValue(mock as unknown as DmxConnection);

      conn = await createResilientConnection({
        config: { dmxDriver: "null", dmxDevicePath: "" } as never,
        logger: createLogger(),
        getChannelSnapshot: () => ({}),
      });

      conn.universe.updateAll(0);

      expect(mock.universe.updateAll).toHaveBeenCalledWith(0);
    });

    it("reports connected status", async () => {
      const mock = createMockConnection();
      mockCreateDmxConnection.mockResolvedValue(mock as unknown as DmxConnection);

      conn = await createResilientConnection({
        config: { dmxDriver: "null", dmxDevicePath: "" } as never,
        logger: createLogger(),
        getChannelSnapshot: () => ({}),
      });

      expect(conn.getStatus().state).toBe("connected");
    });
  });

  describe("initial connection failure", () => {
    it("starts in disconnected state and schedules reconnect", async () => {
      mockCreateDmxConnection.mockRejectedValue(new Error("No device"));
      const onStateChange = vi.fn();

      conn = await createResilientConnection({
        config: { dmxDriver: "null", dmxDevicePath: "" } as never,
        logger: createLogger(),
        getChannelSnapshot: () => ({}),
        onStateChange,
      });

      const status = conn.getStatus();
      expect(status.state).toBe("reconnecting");
      expect(status.lastError).toBe("No device");
      expect(status.lastErrorTitle).toBe("Test Error");
      expect(status.lastErrorSuggestion).toBe("Check connection");
    });
  });

  describe("proxy drops updates when disconnected", () => {
    it("does not throw when update is called without a connection", async () => {
      mockCreateDmxConnection.mockRejectedValue(new Error("No device"));

      conn = await createResilientConnection({
        config: { dmxDriver: "null", dmxDevicePath: "" } as never,
        logger: createLogger(),
        getChannelSnapshot: () => ({}),
      });

      expect(() => conn!.universe.update({ 1: 128 })).not.toThrow();
    });

    it("does not throw when updateAll is called without a connection", async () => {
      mockCreateDmxConnection.mockRejectedValue(new Error("No device"));

      conn = await createResilientConnection({
        config: { dmxDriver: "null", dmxDevicePath: "" } as never,
        logger: createLogger(),
        getChannelSnapshot: () => ({}),
      });

      expect(() => conn!.universe.updateAll(0)).not.toThrow();
    });
  });

  describe("disconnect triggers reconnect", () => {
    it("transitions to disconnected then reconnecting after disconnect", async () => {
      const mock = createMockConnection();
      mockCreateDmxConnection.mockResolvedValue(mock as unknown as DmxConnection);
      const onStateChange = vi.fn();

      conn = await createResilientConnection({
        config: { dmxDriver: "null", dmxDevicePath: "" } as never,
        logger: createLogger(),
        getChannelSnapshot: () => ({}),
        onStateChange,
      });

      expect(conn.getStatus().state).toBe("connected");

      mock.triggerDisconnect(new Error("USB removed"));

      const states = onStateChange.mock.calls.map(
        (call: [{ state: string }]) => call[0].state,
      );
      expect(states).toContain("disconnected");
      expect(states).toContain("reconnecting");
    });
  });

  describe("successful reconnect replays snapshot", () => {
    it("zero-flushes, calls onReconnect, and replays channel snapshot", async () => {
      const initialMock = createMockConnection();
      const reconnectMock = createMockConnection();
      let callCount = 0;

      mockCreateDmxConnection.mockImplementation(async () => {
        callCount += 1;
        if (callCount === 1) return initialMock as unknown as DmxConnection;
        return reconnectMock as unknown as DmxConnection;
      });

      const onReconnect = vi.fn();
      const snapshot = { 1: 200, 5: 128 };

      conn = await createResilientConnection({
        config: { dmxDriver: "null", dmxDevicePath: "" } as never,
        logger: createLogger(),
        getChannelSnapshot: () => snapshot,
        onReconnect,
      });

      initialMock.triggerDisconnect(new Error("USB removed"));

      await vi.advanceTimersByTimeAsync(1000);

      expect(reconnectMock.universe.updateAll).toHaveBeenCalledWith(0);
      expect(onReconnect).toHaveBeenCalledWith(reconnectMock.universe);
      expect(reconnectMock.universe.update).toHaveBeenCalledWith(snapshot);
    });
  });

  describe("close() stops reconnect loop", () => {
    it("does not attempt further reconnects after close", async () => {
      const mock = createMockConnection();
      mockCreateDmxConnection.mockResolvedValue(mock as unknown as DmxConnection);

      conn = await createResilientConnection({
        config: { dmxDriver: "null", dmxDevicePath: "" } as never,
        logger: createLogger(),
        getChannelSnapshot: () => ({}),
      });

      mock.triggerDisconnect(new Error("USB removed"));

      await conn.close();
      conn = null;

      const callCountBeforeTimer = mockCreateDmxConnection.mock.calls.length;

      await vi.advanceTimersByTimeAsync(30_000);

      expect(mockCreateDmxConnection.mock.calls.length).toBe(callCountBeforeTimer);
    });
  });

  describe("exponential backoff", () => {
    it("doubles the delay for each reconnect attempt up to 30s max", async () => {
      const mock = createMockConnection();
      mockCreateDmxConnection
        .mockResolvedValueOnce(mock as unknown as DmxConnection)
        .mockRejectedValue(new Error("Still disconnected"));

      conn = await createResilientConnection({
        config: { dmxDriver: "null", dmxDevicePath: "" } as never,
        logger: createLogger(),
        getChannelSnapshot: () => ({}),
      });

      mock.triggerDisconnect(new Error("USB removed"));

      // Attempt 1 fires after 1000ms
      expect(mockCreateDmxConnection).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockCreateDmxConnection).toHaveBeenCalledTimes(2);

      // Attempt 2 fires after 2000ms
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockCreateDmxConnection).toHaveBeenCalledTimes(3);

      // Attempt 3 fires after 4000ms
      await vi.advanceTimersByTimeAsync(4000);
      expect(mockCreateDmxConnection).toHaveBeenCalledTimes(4);

      // Attempt 4 fires after 8000ms
      await vi.advanceTimersByTimeAsync(8000);
      expect(mockCreateDmxConnection).toHaveBeenCalledTimes(5);
    });
  });
});
