import { describe, it, expect, vi } from "vitest";
import { createMovementTickHandler } from "./movement-tick.js";
import { MovementEngine } from "./movement-interpolator.js";
import { defaultMovementConfig } from "./movement-types.js";
import { createTestFixtureStore, makeTestMovingHead, makeTestPar } from "../test-helpers.js";
import type { DmxDispatcher } from "../dmx/dmx-dispatcher.js";

function makeMockDispatcher(): DmxDispatcher & {
  rawCalls: Array<{ universeId: string | undefined; channels: Record<number, number> }>;
} {
  const rawCalls: Array<{ universeId: string | undefined; channels: Record<number, number> }> = [];
  return {
    rawCalls,
    applyRawUpdate(universeId, channels) {
      rawCalls.push({ universeId, channels });
    },
    applyFixtureUpdate: vi.fn() as any,
    blackout: vi.fn(),
    whiteout: vi.fn(),
    resumeNormal: vi.fn(),
    getChannelSnapshot: vi.fn(() => ({})),
    isBlackoutActive: vi.fn(() => false),
    getControlMode: vi.fn(() => "normal" as const),
    getActiveChannelCount: vi.fn(() => 0),
    lockChannels: vi.fn(),
    unlockChannels: vi.fn(),
  };
}

describe("createMovementTickHandler", () => {
  it("dispatches movement output to correct universe", () => {
    const store = createTestFixtureStore();
    const engine = new MovementEngine();
    const dispatcher = makeMockDispatcher();

    const fixture = store.add(makeTestMovingHead({
      dmxStartAddress: 1,
      universeId: "universe-2",
    }));

    engine.setConfig(fixture.id, { ...defaultMovementConfig(), smoothingCurve: "linear" });
    engine.setTarget(fixture.id, { pan: 200 });

    const tick = createMovementTickHandler({ engine, fixtureStore: store, dispatcher });
    tick(25);

    expect(dispatcher.rawCalls.length).toBeGreaterThan(0);
    expect(dispatcher.rawCalls[0].universeId).toBe("universe-2");
  });

  it("dispatches to default universe when universeId is not set", () => {
    const store = createTestFixtureStore();
    const engine = new MovementEngine();
    const dispatcher = makeMockDispatcher();

    const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));

    engine.setConfig(fixture.id, { ...defaultMovementConfig(), smoothingCurve: "linear" });
    engine.setTarget(fixture.id, { pan: 200 });

    const tick = createMovementTickHandler({ engine, fixtureStore: store, dispatcher });
    tick(25);

    expect(dispatcher.rawCalls.length).toBeGreaterThan(0);
    expect(dispatcher.rawCalls[0].universeId).toBe("default");
  });

  it("writes pan coarse to correct DMX address", () => {
    const store = createTestFixtureStore();
    const engine = new MovementEngine();
    const dispatcher = makeMockDispatcher();

    const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 10 }));

    engine.setConfig(fixture.id, { ...defaultMovementConfig(), smoothingCurve: "linear" });
    engine.setTarget(fixture.id, { pan: 200 });

    const tick = createMovementTickHandler({ engine, fixtureStore: store, dispatcher });
    tick(25);

    // Pan is at offset 0 → address 10, Tilt is at offset 1 → address 11
    const channels = dispatcher.rawCalls[0].channels;
    expect(channels[10]).toBeDefined(); // Pan coarse
    expect(channels[11]).toBeDefined(); // Tilt coarse
  });

  it("skips fixtures no longer in the store", () => {
    const store = createTestFixtureStore();
    const engine = new MovementEngine();
    const dispatcher = makeMockDispatcher();

    const fixture = store.add(makeTestMovingHead({ dmxStartAddress: 1 }));
    engine.setConfig(fixture.id, { ...defaultMovementConfig(), smoothingCurve: "linear" });
    engine.setTarget(fixture.id, { pan: 200 });

    // Remove from store but leave in engine
    store.remove(fixture.id);

    const tick = createMovementTickHandler({ engine, fixtureStore: store, dispatcher });
    tick(25);

    expect(dispatcher.rawCalls.length).toBe(0);
  });

  it("skips non-mover fixtures (no pan/tilt output)", () => {
    const store = createTestFixtureStore();
    const engine = new MovementEngine();
    const dispatcher = makeMockDispatcher();

    store.add(makeTestPar({ dmxStartAddress: 1 }));

    const tick = createMovementTickHandler({ engine, fixtureStore: store, dispatcher });
    tick(25);

    expect(dispatcher.rawCalls.length).toBe(0);
  });

  it("handles multiple fixtures on different universes", () => {
    const store = createTestFixtureStore();
    const engine = new MovementEngine();
    const dispatcher = makeMockDispatcher();

    const f1 = store.add(makeTestMovingHead({ dmxStartAddress: 1, universeId: "uni-a" }));
    const f2 = store.add(makeTestMovingHead({ dmxStartAddress: 20, universeId: "uni-b" }));

    const config = { ...defaultMovementConfig(), smoothingCurve: "linear" as const };
    engine.setConfig(f1.id, config);
    engine.setConfig(f2.id, config);
    engine.setTarget(f1.id, { pan: 200 });
    engine.setTarget(f2.id, { pan: 100 });

    const tick = createMovementTickHandler({ engine, fixtureStore: store, dispatcher });
    tick(25);

    expect(dispatcher.rawCalls.length).toBe(2);
    const universes = dispatcher.rawCalls.map((c) => c.universeId).sort();
    expect(universes).toEqual(["uni-a", "uni-b"]);
  });
});
