import { describe, it, expect } from "vitest";
import { processColorBatch, type ColorEntry } from "./color-pipeline.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import { createMockUniverse, createTestFixtureStore } from "../test-helpers.js";
import type { FixtureStore } from "./fixture-store.js";

function addRgbFixture(store: FixtureStore, name: string, startAddr: number) {
  return store.add({
    name,
    mode: "3ch",
    dmxStartAddress: startAddr,
    channels: [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ],
  });
}

describe("processColorBatch", () => {
  it("maps colors by fixture id", () => {
    const universe = createMockUniverse();
    const manager = createUniverseManager(universe);
    const store = createTestFixtureStore();
    const fixture = addRgbFixture(store, "Test", 1);

    const entries: readonly ColorEntry[] = [
      { id: fixture.id, r: 255, g: 128, b: 64, brightness: 1.0 },
    ];

    const result = processColorBatch(entries, store, manager);

    expect(result.fixturesMatched).toBe(1);
    expect(result.channelsUpdated).toBe(3);
    expect(universe.updateCalls).toHaveLength(1);
    expect(universe.updateCalls[0]).toEqual({ 1: 255, 2: 128, 3: 64 });
  });

  it("maps colors by fixture index", () => {
    const universe = createMockUniverse();
    const manager = createUniverseManager(universe);
    const store = createTestFixtureStore();
    addRgbFixture(store, "First", 1);
    addRgbFixture(store, "Second", 10);

    const entries: readonly ColorEntry[] = [
      { fixtureIndex: 1, r: 100, g: 200, b: 50, brightness: 1.0 },
    ];

    const result = processColorBatch(entries, store, manager);

    expect(result.fixturesMatched).toBe(1);
    expect(result.channelsUpdated).toBe(3);
    expect(universe.updateCalls[0]).toEqual({ 10: 100, 11: 200, 12: 50 });
  });

  it("skips unknown fixture ids", () => {
    const universe = createMockUniverse();
    const manager = createUniverseManager(universe);
    const store = createTestFixtureStore();

    const entries: readonly ColorEntry[] = [
      { id: "nonexistent", r: 255, g: 0, b: 0, brightness: 1.0 },
    ];

    const result = processColorBatch(entries, store, manager);

    expect(result.fixturesMatched).toBe(0);
    expect(result.channelsUpdated).toBe(0);
    expect(universe.updateCalls).toHaveLength(0);
  });

  it("skips out-of-range fixture index", () => {
    const universe = createMockUniverse();
    const manager = createUniverseManager(universe);
    const store = createTestFixtureStore();
    addRgbFixture(store, "Only", 1);

    const entries: readonly ColorEntry[] = [
      { fixtureIndex: 99, r: 255, g: 0, b: 0, brightness: 1.0 },
    ];

    const result = processColorBatch(entries, store, manager);

    expect(result.fixturesMatched).toBe(0);
    expect(result.channelsUpdated).toBe(0);
  });

  it("handles mixed id and index entries in one batch", () => {
    const universe = createMockUniverse();
    const manager = createUniverseManager(universe);
    const store = createTestFixtureStore();
    const f1 = addRgbFixture(store, "ById", 1);
    addRgbFixture(store, "ByIndex", 10);

    const entries: readonly ColorEntry[] = [
      { id: f1.id, r: 255, g: 0, b: 0, brightness: 1.0 },
      { fixtureIndex: 1, r: 0, g: 255, b: 0, brightness: 1.0 },
    ];

    const result = processColorBatch(entries, store, manager);

    expect(result.fixturesMatched).toBe(2);
    expect(result.channelsUpdated).toBe(6);
  });

  it("returns zero channels when entries array is empty", () => {
    const universe = createMockUniverse();
    const manager = createUniverseManager(universe);
    const store = createTestFixtureStore();

    const result = processColorBatch([], store, manager);

    expect(result.fixturesMatched).toBe(0);
    expect(result.channelsUpdated).toBe(0);
    expect(universe.updateCalls).toHaveLength(0);
  });

  it("applies brightness scaling when fixture has no dimmer", () => {
    const universe = createMockUniverse();
    const manager = createUniverseManager(universe);
    const store = createTestFixtureStore();
    const fixture = addRgbFixture(store, "NoDimmer", 1);

    const entries: readonly ColorEntry[] = [
      { id: fixture.id, r: 200, g: 100, b: 50, brightness: 0.5 },
    ];

    const result = processColorBatch(entries, store, manager);

    expect(result.fixturesMatched).toBe(1);
    // RGB fixture without dimmer: brightness applied to color values
    expect(universe.updateCalls[0]).toEqual({ 1: 100, 2: 50, 3: 25 });
  });

  it("includes positional channels (pan/tilt) with defaults in color batch output", () => {
    const universe = createMockUniverse();
    const manager = createUniverseManager(universe);
    const store = createTestFixtureStore();

    const fixture = store.add({
      name: "Moving Head",
      mode: "13ch",
      dmxStartAddress: 1,
      channels: [
        { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
        { offset: 1, name: "Tilt", type: "Tilt", defaultValue: 128 },
        { offset: 2, name: "Dimmer", type: "Intensity", defaultValue: 0 },
        { offset: 3, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
        { offset: 4, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
        { offset: 5, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
      ],
    });

    const entries: readonly ColorEntry[] = [
      { id: fixture.id, r: 255, g: 128, b: 64, brightness: 1.0 },
    ];

    const result = processColorBatch(entries, store, manager);

    expect(result.fixturesMatched).toBe(1);
    const update = universe.updateCalls[0];
    // Pan and Tilt included with their default values
    expect(update[1]).toBe(128); // pan center
    expect(update[2]).toBe(128); // tilt center
    // Color channels should be present
    expect(update[3]).toBe(255); // dimmer
    expect(update[4]).toBe(255); // red
    expect(update[5]).toBe(128); // green
    expect(update[6]).toBe(64);  // blue
  });
});
