import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../logging/pipeline-logger.js", () => ({
  pipeLog: vi.fn(),
}));

vi.mock("../fixtures/motor-guard.js", () => ({
  computeSafePositions: vi.fn(),
}));

import { initializeFixtureDefaults } from "./fixture-init.js";
import { computeSafePositions } from "../fixtures/motor-guard.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { UniverseManager } from "../dmx/universe-manager.js";
import type { FixtureConfig } from "../types/protocol.js";

function makeFixture(overrides: Partial<FixtureConfig> = {}): FixtureConfig {
  return {
    id: "test-1",
    name: "Test Fixture",
    dmxStartAddress: 1,
    channels: [],
    ...overrides,
  } as FixtureConfig;
}

function makeManager(): UniverseManager {
  return {
    registerSafePositions: vi.fn(),
    blackout: vi.fn(() => ({ ok: true })),
    applyRawUpdate: vi.fn(() => ({ ok: true })),
  } as unknown as UniverseManager;
}

function makeStore(fixtures: FixtureConfig[]): FixtureStore {
  return {
    getAll: vi.fn(() => fixtures),
  } as unknown as FixtureStore;
}

describe("initializeFixtureDefaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers safe positions and enters blackout", () => {
    const fixture = makeFixture();
    const store = makeStore([fixture]);
    const manager = makeManager();
    const safePositions = { 5: 128, 6: 128 };
    vi.mocked(computeSafePositions).mockReturnValue(safePositions);

    initializeFixtureDefaults(store, manager);

    expect(computeSafePositions).toHaveBeenCalledWith([fixture]);
    expect(manager.registerSafePositions).toHaveBeenCalledWith(safePositions);
    expect(manager.blackout).toHaveBeenCalled();
  });

  it("does NOT call applyRawUpdate — prevents lighting defaults bypassing blackout", () => {
    const fixture = makeFixture({
      channels: [
        { offset: 0, name: "Strobe", type: "Strobe", defaultValue: 255 },
        { offset: 1, name: "Dimmer", type: "Intensity", defaultValue: 255 },
      ],
    });
    const store = makeStore([fixture]);
    const manager = makeManager();
    vi.mocked(computeSafePositions).mockReturnValue({});

    initializeFixtureDefaults(store, manager);

    expect(manager.applyRawUpdate).not.toHaveBeenCalled();
  });

  it("calls blackout AFTER registerSafePositions so motors are protected", () => {
    const store = makeStore([makeFixture()]);
    const manager = makeManager();
    vi.mocked(computeSafePositions).mockReturnValue({ 10: 128 });

    const callOrder: string[] = [];
    vi.mocked(manager.registerSafePositions).mockImplementation(() => {
      callOrder.push("registerSafePositions");
    });
    vi.mocked(manager.blackout).mockImplementation(() => {
      callOrder.push("blackout");
      return { ok: true };
    });

    initializeFixtureDefaults(store, manager);

    expect(callOrder).toEqual(["registerSafePositions", "blackout"]);
  });

  it("handles empty fixture store", () => {
    const store = makeStore([]);
    const manager = makeManager();
    vi.mocked(computeSafePositions).mockReturnValue({});

    initializeFixtureDefaults(store, manager);

    expect(manager.registerSafePositions).toHaveBeenCalledWith({});
    expect(manager.blackout).toHaveBeenCalled();
  });
});
