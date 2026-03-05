import { describe, it, expect, beforeEach, vi } from "vitest";
import { createConnectionPool } from "./connection-pool.js";
import type { ConnectionPool, ConnectionFactory } from "./connection-pool.js";
import type { UniverseConfig } from "../types/protocol.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";
import type { DmxUniverse } from "./driver-factory.js";
import type { UniverseManager } from "./universe-manager.js";
import type { ResilientConnection } from "./resilient-connection.js";
import type { ConnectionStatus } from "./connection-state.js";

function makeUniverseConfig(overrides: Partial<UniverseConfig> = {}): UniverseConfig {
  return {
    id: "uni-1",
    name: "Test Universe",
    devicePath: "/dev/ttyUSB0",
    driverType: "null",
    ...overrides,
  };
}

function makeMockUniverse(): DmxUniverse {
  return {
    update: vi.fn(),
    updateAll: vi.fn(),
  };
}

function makeMockManager(universe: DmxUniverse): UniverseManager {
  return {
    applyFixtureUpdate: vi.fn().mockReturnValue(0),
    blackout: vi.fn(),
    whiteout: vi.fn(),
    resumeNormal: vi.fn(),
    isBlackoutActive: vi.fn().mockReturnValue(false),
    getActiveChannelCount: vi.fn().mockReturnValue(0),
    getChannelSnapshot: vi.fn().mockReturnValue({}),
    getFullSnapshot: vi.fn().mockReturnValue({}),
    applyRawUpdate: vi.fn(),
    getDmxSendStatus: vi.fn().mockReturnValue({ lastSendTime: null, lastSendError: null }),
    registerSafePositions: vi.fn(),
    lockChannels: vi.fn(),
    unlockChannels: vi.fn(),
    hasLockedChannels: vi.fn().mockReturnValue(false),
  };
}

function makeMockConnection(universe: DmxUniverse): ResilientConnection {
  const status: ConnectionStatus = {
    state: "connected",
    lastConnectedAt: Date.now(),
    lastDisconnectedAt: null,
    reconnectAttempts: 0,
    lastError: null,
    lastErrorTitle: null,
    lastErrorSuggestion: null,
  };

  return {
    universe,
    close: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockReturnValue(status),
  };
}

function makeMockFactory(): ConnectionFactory {
  return {
    createConnection: vi.fn().mockImplementation(async () => {
      const universe = makeMockUniverse();
      return makeMockConnection(universe);
    }),
    createManager: vi.fn().mockImplementation((universe: DmxUniverse) => {
      return makeMockManager(universe);
    }),
  };
}

describe("createConnectionPool", () => {
  let pool: ConnectionPool;
  let factory: ConnectionFactory;

  beforeEach(() => {
    factory = makeMockFactory();
    pool = createConnectionPool(factory);
  });

  describe("create", () => {
    it("starts a connection for a universe config", async () => {
      const config = makeUniverseConfig();
      await pool.create(config);

      expect(factory.createConnection).toHaveBeenCalledTimes(1);
      expect(factory.createManager).toHaveBeenCalledTimes(1);
    });

    it("makes the universe manager accessible by universe ID", async () => {
      const config = makeUniverseConfig({ id: "my-uni" });
      await pool.create(config);

      const manager = pool.getManager("my-uni");
      expect(manager).toBeDefined();
    });

    it("throws if universe ID already has a connection", async () => {
      const config = makeUniverseConfig({ id: "dup" });
      await pool.create(config);

      await expect(pool.create(config)).rejects.toThrow(/already exists/i);
    });

    it("closes the connection if manager creation fails", async () => {
      const failFactory: ConnectionFactory = {
        createConnection: vi.fn().mockImplementation(async () => {
          const universe = makeMockUniverse();
          return makeMockConnection(universe);
        }),
        createManager: vi.fn().mockImplementation(() => {
          throw new Error("Manager init failed");
        }),
      };

      const failPool = createConnectionPool(failFactory);
      const config = makeUniverseConfig({ id: "leak-test" });

      await expect(failPool.create(config)).rejects.toThrow("Manager init failed");

      // The connection should have been closed to prevent leak
      const mockConn = await (failFactory.createConnection as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(mockConn.close).toHaveBeenCalled();

      // Pool should not have the entry
      expect(failPool.getManager("leak-test")).toBeUndefined();
    });
  });

  describe("getManager", () => {
    it("returns the universe manager for a given ID", async () => {
      await pool.create(makeUniverseConfig({ id: "uni-a" }));
      expect(pool.getManager("uni-a")).toBeDefined();
    });

    it("returns undefined for unknown universe ID", () => {
      expect(pool.getManager("nonexistent")).toBeUndefined();
    });
  });

  describe("getConnection", () => {
    it("returns the resilient connection for a given ID", async () => {
      await pool.create(makeUniverseConfig({ id: "uni-b" }));
      const conn = pool.getConnection("uni-b");
      expect(conn).toBeDefined();
      expect(conn!.getStatus().state).toBe("connected");
    });

    it("returns undefined for unknown universe ID", () => {
      expect(pool.getConnection("nonexistent")).toBeUndefined();
    });
  });

  describe("getStatus", () => {
    it("returns connection status for all universes", async () => {
      await pool.create(makeUniverseConfig({ id: "uni-1", name: "First" }));
      await pool.create(makeUniverseConfig({ id: "uni-2", name: "Second", devicePath: "/dev/ttyUSB1" }));

      const statuses = pool.getStatus();
      expect(statuses.size).toBe(2);
      expect(statuses.get("uni-1")).toBeDefined();
      expect(statuses.get("uni-2")).toBeDefined();
    });
  });

  describe("remove", () => {
    it("closes the connection and removes the manager", async () => {
      await pool.create(makeUniverseConfig({ id: "to-remove" }));
      const conn = pool.getConnection("to-remove")!;

      await pool.remove("to-remove");

      expect(conn.close).toHaveBeenCalled();
      expect(pool.getManager("to-remove")).toBeUndefined();
      expect(pool.getConnection("to-remove")).toBeUndefined();
    });

    it("is safe to call with unknown ID", async () => {
      await expect(pool.remove("nonexistent")).resolves.toBeUndefined();
    });
  });

  describe("closeAll", () => {
    it("closes every connection", async () => {
      await pool.create(makeUniverseConfig({ id: "uni-1" }));
      await pool.create(makeUniverseConfig({ id: "uni-2", devicePath: "/dev/ttyUSB1" }));

      const conn1 = pool.getConnection("uni-1")!;
      const conn2 = pool.getConnection("uni-2")!;

      await pool.closeAll();

      expect(conn1.close).toHaveBeenCalled();
      expect(conn2.close).toHaveBeenCalled();
      expect(pool.getManager("uni-1")).toBeUndefined();
      expect(pool.getManager("uni-2")).toBeUndefined();
    });

    it("is safe to call when empty", async () => {
      await expect(pool.closeAll()).resolves.toBeUndefined();
    });
  });

  describe("getManagerOrDefault", () => {
    it("returns the default manager when universeId is undefined", async () => {
      await pool.create(makeUniverseConfig({ id: DEFAULT_UNIVERSE_ID }));
      const manager = pool.getManagerOrDefault(undefined);
      expect(manager).toBeDefined();
    });

    it("returns the specific manager when universeId is provided", async () => {
      await pool.create(makeUniverseConfig({ id: "specific" }));
      const manager = pool.getManagerOrDefault("specific");
      expect(manager).toBeDefined();
    });

    it("returns undefined when universeId not found", () => {
      expect(pool.getManagerOrDefault("missing")).toBeUndefined();
    });
  });

  describe("getAllManagers", () => {
    it("returns full map of universe ID to manager", async () => {
      await pool.create(makeUniverseConfig({ id: "uni-1" }));
      await pool.create(makeUniverseConfig({ id: "uni-2", devicePath: "/dev/ttyUSB1" }));

      const managers = pool.getAllManagers();
      expect(managers.size).toBe(2);
      expect(managers.has("uni-1")).toBe(true);
      expect(managers.has("uni-2")).toBe(true);
    });
  });
});
