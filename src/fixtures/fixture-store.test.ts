import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createFixtureStore } from "./fixture-store.js";
import type { FixtureStore } from "./fixture-store.js";
import type { AddFixtureRequest } from "../types/protocol.js";
import { rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makeRequest(overrides: Partial<AddFixtureRequest> = {}): AddFixtureRequest {
  return {
    name: "Test PAR",
    oflKey: "cameo/flat-pro-18",
    oflFixtureName: "Flat Pro 18",
    mode: "5-channel",
    dmxStartAddress: 1,
    channelCount: 3,
    channels: [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ],
    ...overrides,
  };
}

describe("createFixtureStore", () => {
  let store: FixtureStore;
  let filePath: string;

  beforeEach(() => {
    filePath = join(tmpdir(), `dmxr-test-${Date.now()}.json`);
    store = createFixtureStore(filePath);
  });

  afterEach(async () => {
    try {
      await rm(filePath);
    } catch {
      // file may not exist
    }
  });

  describe("getAll", () => {
    it("returns empty array initially", () => {
      expect(store.getAll()).toEqual([]);
    });
  });

  describe("add", () => {
    it("creates a fixture with a generated id", () => {
      const fixture = store.add(makeRequest());

      expect(fixture.id).toBeDefined();
      expect(fixture.name).toBe("Test PAR");
      expect(fixture.oflKey).toBe("cameo/flat-pro-18");
      expect(fixture.channelCount).toBe(3);
      expect(fixture.channels).toHaveLength(3);
    });

    it("adds fixture to the store", () => {
      store.add(makeRequest());

      expect(store.getAll()).toHaveLength(1);
    });

    it("preserves existing fixtures when adding", () => {
      store.add(makeRequest({ name: "First", dmxStartAddress: 1 }));
      store.add(makeRequest({ name: "Second", dmxStartAddress: 10 }));

      expect(store.getAll()).toHaveLength(2);
    });
  });

  describe("getById", () => {
    it("returns fixture by id", () => {
      const added = store.add(makeRequest());
      const found = store.getById(added.id);

      expect(found).toEqual(added);
    });

    it("returns undefined for unknown id", () => {
      expect(store.getById("nonexistent")).toBeUndefined();
    });
  });

  describe("remove", () => {
    it("removes fixture and returns true", () => {
      const fixture = store.add(makeRequest());
      const removed = store.remove(fixture.id);

      expect(removed).toBe(true);
      expect(store.getAll()).toHaveLength(0);
    });

    it("returns false for unknown id", () => {
      expect(store.remove("nonexistent")).toBe(false);
    });

    it("does not affect other fixtures", () => {
      const first = store.add(makeRequest({ name: "First", dmxStartAddress: 1 }));
      store.add(makeRequest({ name: "Second", dmxStartAddress: 10 }));

      store.remove(first.id);

      expect(store.getAll()).toHaveLength(1);
      expect(store.getAll()[0].name).toBe("Second");
    });
  });

  describe("update", () => {
    it("updates fixture name", () => {
      const fixture = store.add(makeRequest({ name: "Old Name" }));
      const updated = store.update(fixture.id, { name: "New Name" });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe("New Name");
      expect(updated!.id).toBe(fixture.id);
      expect(updated!.dmxStartAddress).toBe(fixture.dmxStartAddress);
    });

    it("updates fixture address", () => {
      const fixture = store.add(makeRequest({ dmxStartAddress: 1 }));
      const updated = store.update(fixture.id, { dmxStartAddress: 100 });

      expect(updated).toBeDefined();
      expect(updated!.dmxStartAddress).toBe(100);
      expect(updated!.name).toBe(fixture.name);
    });

    it("returns undefined for unknown id", () => {
      expect(store.update("nonexistent", { name: "X" })).toBeUndefined();
    });

    it("does not mutate original fixture array", () => {
      const fixture = store.add(makeRequest());
      const allBefore = store.getAll();

      store.update(fixture.id, { name: "Changed" });

      const allAfter = store.getAll();
      expect(allBefore).not.toBe(allAfter);
    });

    it("persists after save and load", async () => {
      const fixture = store.add(makeRequest({ name: "Before" }));
      store.update(fixture.id, { name: "After" });
      await store.save();

      const store2 = createFixtureStore(filePath);
      await store2.load();

      expect(store2.getById(fixture.id)!.name).toBe("After");
    });
  });

  describe("save and load", () => {
    it("persists fixtures to disk and loads them back", async () => {
      store.add(makeRequest({ name: "Saved PAR" }));
      await store.save();

      const store2 = createFixtureStore(filePath);
      await store2.load();

      expect(store2.getAll()).toHaveLength(1);
      expect(store2.getAll()[0].name).toBe("Saved PAR");
    });

    it("writes valid JSON", async () => {
      store.add(makeRequest());
      await store.save();

      const raw = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it("loads empty array when file does not exist", async () => {
      const missingStore = createFixtureStore("/tmp/does-not-exist.json");
      await missingStore.load();

      expect(missingStore.getAll()).toEqual([]);
    });
  });
});
