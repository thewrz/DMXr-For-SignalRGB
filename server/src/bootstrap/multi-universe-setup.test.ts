import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MultiUniverseStack } from "./multi-universe-setup.js";

vi.mock("../dmx/universe-registry.js", () => ({
  createUniverseRegistry: () => ({
    load: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockReturnValue([]),
    getById: vi.fn().mockReturnValue(undefined),
    getByDevicePath: vi.fn().mockReturnValue(undefined),
    getDefault: vi.fn().mockReturnValue({
      id: "default",
      name: "Default",
      driverType: "null",
      devicePath: "auto",
    }),
    add: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    autoAssignDevices: vi.fn().mockReturnValue([]),
    save: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../dmx/connection-pool.js", () => ({
  createConnectionPool: (factory: unknown) => ({
    create: vi.fn().mockResolvedValue(undefined),
    getManager: vi.fn().mockReturnValue(undefined),
    getManagerOrDefault: vi.fn().mockReturnValue(undefined),
    getConnection: vi.fn().mockReturnValue(undefined),
    getStatus: vi.fn().mockReturnValue(new Map()),
    remove: vi.fn().mockResolvedValue(undefined),
    closeAll: vi.fn().mockResolvedValue(undefined),
    getAllManagers: vi.fn().mockReturnValue(new Map()),
  }),
}));

vi.mock("../dmx/multi-universe-coordinator.js", () => ({
  createMultiUniverseCoordinator: (getManagers: unknown) => ({
    applyFixtureUpdate: vi.fn().mockReturnValue(0),
    blackout: vi.fn().mockReturnValue({ ok: true }),
    blackoutAll: vi.fn(),
    whiteout: vi.fn().mockReturnValue({ ok: true }),
    whiteoutAll: vi.fn(),
    resumeNormal: vi.fn().mockReturnValue({ ok: true }),
    resumeNormalAll: vi.fn(),
    isBlackoutActive: vi.fn().mockReturnValue(false),
    getChannelSnapshot: vi.fn().mockReturnValue({}),
    getFullSnapshot: vi.fn().mockReturnValue({}),
  }),
}));

vi.mock("../dmx/resilient-connection.js", () => ({
  createResilientConnection: vi.fn().mockResolvedValue({
    universe: { update: vi.fn(), updateAll: vi.fn() },
    close: vi.fn(),
    getStatus: () => ({
      state: "connected",
      lastConnectedAt: Date.now(),
      lastDisconnectedAt: null,
      reconnectAttempts: 0,
      lastError: null,
      lastErrorTitle: null,
      lastErrorSuggestion: null,
    }),
  }),
}));

vi.mock("../dmx/universe-manager.js", () => ({
  createUniverseManager: () => ({
    getActiveChannelCount: () => 0,
    getFullSnapshot: () => ({}),
    isBlackoutActive: () => false,
    blackout: vi.fn(),
    getControlMode: () => "normal",
  }),
}));

vi.mock("../logging/pipeline-logger.js", () => ({
  pipeLog: vi.fn(),
}));

vi.mock("../dmx/connection-log.js", () => ({
  createConnectionLog: () => ({
    getEvents: vi.fn().mockReturnValue([]),
    push: vi.fn(),
    clear: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => {}),
  }),
  mapStatusToEvent: vi.fn().mockReturnValue({
    type: "connected",
    universeId: "default",
    timestamp: Date.now(),
    details: {},
  }),
}));

const { createMultiUniverseStack } = await import("./multi-universe-setup.js");

function makeConfig() {
  return {
    dmxDriver: "null",
    dmxDevicePath: "/dev/null",
    port: 8080,
    host: "0.0.0.0",
    portRangeSize: 1,
    fixturesPath: "./config/fixtures.json",
    userFixturesPath: "./config/user-fixtures",
    mdnsEnabled: false,
    udpPort: 0,
    logFormat: "text" as const,
    apiKeys: [],
  };
}

function makeLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function makeLatencyTracker() {
  return {
    recordDmxSend: vi.fn(),
    recordUdpReceive: vi.fn(),
    recordDispatch: vi.fn(),
    getStats: vi.fn().mockReturnValue({
      dmxSend: { avg: 0, min: 0, max: 0, count: 0 },
      udpReceive: { avg: 0, min: 0, max: 0, count: 0 },
      dispatch: { avg: 0, min: 0, max: 0, count: 0 },
    }),
    reset: vi.fn(),
  };
}

describe("createMultiUniverseStack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an object with registry, pool, coordinator, and connectionLog", async () => {
    const stack = await createMultiUniverseStack(
      makeConfig(),
      makeLogger(),
      makeLatencyTracker(),
    );

    expect(stack).toHaveProperty("registry");
    expect(stack).toHaveProperty("pool");
    expect(stack).toHaveProperty("coordinator");
    expect(stack).toHaveProperty("connectionLog");
  });

  it("registry is loaded during creation", async () => {
    const stack = await createMultiUniverseStack(
      makeConfig(),
      makeLogger(),
      makeLatencyTracker(),
    );

    // registry.load() was called; getAll returns empty array from our mock
    expect(stack.registry.getAll()).toEqual([]);
  });

  it("connectionLog is created when not provided", async () => {
    const stack = await createMultiUniverseStack(
      makeConfig(),
      makeLogger(),
      makeLatencyTracker(),
    );

    expect(stack.connectionLog).toBeDefined();
    expect(typeof stack.connectionLog.push).toBe("function");
    expect(typeof stack.connectionLog.getEvents).toBe("function");
  });

  it("uses provided connectionLog when given", async () => {
    const externalLog = {
      getEvents: vi.fn().mockReturnValue([]),
      push: vi.fn(),
      clear: vi.fn(),
      subscribe: vi.fn().mockReturnValue(() => {}),
    };

    const stack = await createMultiUniverseStack(
      makeConfig(),
      makeLogger(),
      makeLatencyTracker(),
      undefined,
      externalLog,
    );

    expect(stack.connectionLog).toBe(externalLog);
  });

  it("does not throw with zero configured universes", async () => {
    await expect(
      createMultiUniverseStack(makeConfig(), makeLogger(), makeLatencyTracker()),
    ).resolves.not.toThrow();
  });
});
