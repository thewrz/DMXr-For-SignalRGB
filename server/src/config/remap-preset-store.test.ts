import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { createRemapPresetStore } from "./remap-preset-store.js";
import type { RemapPresetStore } from "./remap-preset-store.js";

describe("createRemapPresetStore", () => {
  let store: RemapPresetStore;
  let filePath: string;

  beforeEach(() => {
    filePath = `/tmp/dmxr-test-presets-${randomUUID()}.json`;
    store = createRemapPresetStore(filePath);
  });

  afterEach(async () => {
    try {
      await unlink(filePath);
    } catch {
      // may not exist
    }
    try {
      await unlink(filePath + ".tmp");
    } catch {
      // may not exist
    }
  });

  describe("getAll", () => {
    it("returns empty object when no file exists", async () => {
      await store.load();
      expect(store.getAll()).toEqual({});
    });
  });

  describe("upsert / save", () => {
    it("persists after save and returns stored data", async () => {
      await store.load();
      store.upsert("test-fixture", { channelCount: 3, remap: { 0: 1, 1: 0 } });
      await store.save();

      const all = store.getAll();
      expect(all["test-fixture"]).toEqual({
        channelCount: 3,
        remap: { 0: 1, 1: 0 },
      });
    });
  });

  describe("get", () => {
    it("returns preset for known key", async () => {
      await store.load();
      store.upsert("my-par", { channelCount: 7, remap: { 2: 3, 3: 2 } });

      const preset = store.get("my-par");
      expect(preset).toEqual({ channelCount: 7, remap: { 2: 3, 3: 2 } });
    });

    it("returns undefined for unknown key", async () => {
      await store.load();
      expect(store.get("no-such-key")).toBeUndefined();
    });
  });

  describe("remove", () => {
    it("deletes and returns true for known key", async () => {
      await store.load();
      store.upsert("removable", { channelCount: 3, remap: { 0: 2 } });

      expect(store.remove("removable")).toBe(true);
      expect(store.get("removable")).toBeUndefined();
    });

    it("returns false for unknown key", async () => {
      await store.load();
      expect(store.remove("nope")).toBe(false);
    });
  });

  describe("round-trip persistence", () => {
    it("save → new instance → load → get returns same data", async () => {
      await store.load();
      store.upsert("round-trip", { channelCount: 5, remap: { 1: 4, 4: 1 } });
      await store.save();

      const store2 = createRemapPresetStore(filePath);
      await store2.load();

      expect(store2.get("round-trip")).toEqual({
        channelCount: 5,
        remap: { 1: 4, 4: 1 },
      });
    });
  });

  describe("keys with slashes", () => {
    it("works with slash-delimited keys", async () => {
      await store.load();
      const key = "oppsk/bl-18/7-channel";
      store.upsert(key, { channelCount: 7, remap: { 0: 6, 6: 0 } });
      await store.save();

      const store2 = createRemapPresetStore(filePath);
      await store2.load();

      expect(store2.get(key)).toEqual({
        channelCount: 7,
        remap: { 0: 6, 6: 0 },
      });
    });
  });
});
