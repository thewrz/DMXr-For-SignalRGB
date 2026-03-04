import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createUserFixtureStore } from "./user-fixture-store.js";
import type { UserFixtureStore } from "./user-fixture-store.js";
import type { CreateUserFixtureRequest } from "./user-fixture-types.js";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makeRequest(
  overrides: Partial<CreateUserFixtureRequest> = {},
): CreateUserFixtureRequest {
  return {
    name: "My Custom PAR",
    manufacturer: "DIY",
    category: "Color Changer",
    modes: [
      {
        name: "3-channel",
        channels: [
          { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
          { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
          { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
        ],
      },
    ],
    ...overrides,
  };
}

describe("createUserFixtureStore", () => {
  let store: UserFixtureStore;
  let filePath: string;

  beforeEach(() => {
    filePath = join(tmpdir(), `dmxr-user-fixtures-test-${Date.now()}.json`);
    store = createUserFixtureStore(filePath);
  });

  afterEach(async () => {
    store.dispose();
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
    it("creates a template with generated id and timestamps", () => {
      const template = store.add(makeRequest());

      expect(template.id).toBeDefined();
      expect(template.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(template.name).toBe("My Custom PAR");
      expect(template.manufacturer).toBe("DIY");
      expect(template.category).toBe("Color Changer");
      expect(template.createdAt).toBeDefined();
      expect(template.updatedAt).toBeDefined();
    });

    it("generates ids for each mode", () => {
      const template = store.add(
        makeRequest({
          modes: [
            { name: "3ch", channels: [{ offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 }] },
            { name: "7ch", channels: [{ offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 }] },
          ],
        }),
      );

      expect(template.modes).toHaveLength(2);
      expect(template.modes[0].id).toBeDefined();
      expect(template.modes[1].id).toBeDefined();
      expect(template.modes[0].id).not.toBe(template.modes[1].id);
    });

    it("adds template to the store", () => {
      store.add(makeRequest());
      expect(store.getAll()).toHaveLength(1);
    });

    it("preserves existing templates when adding", () => {
      store.add(makeRequest({ name: "First" }));
      store.add(makeRequest({ name: "Second" }));
      expect(store.getAll()).toHaveLength(2);
    });
  });

  describe("getById", () => {
    it("returns template by id", () => {
      const added = store.add(makeRequest());
      const found = store.getById(added.id);
      expect(found).toEqual(added);
    });

    it("returns undefined for unknown id", () => {
      expect(store.getById("nonexistent")).toBeUndefined();
    });
  });

  describe("update", () => {
    it("merges partial update and bumps updatedAt", async () => {
      const template = store.add(makeRequest({ name: "Old Name" }));
      const originalUpdatedAt = template.updatedAt;

      // Ensure time advances
      await new Promise((r) => setTimeout(r, 5));

      const updated = store.update(template.id, { name: "New Name" });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe("New Name");
      expect(updated!.manufacturer).toBe("DIY");
      expect(updated!.id).toBe(template.id);
      expect(updated!.createdAt).toBe(template.createdAt);
      expect(updated!.updatedAt).not.toBe(originalUpdatedAt);
    });

    it("updates modes with new ids", () => {
      const template = store.add(makeRequest());
      const updated = store.update(template.id, {
        modes: [
          { name: "1ch", channels: [{ offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 }] },
        ],
      });

      expect(updated!.modes).toHaveLength(1);
      expect(updated!.modes[0].name).toBe("1ch");
      expect(updated!.modes[0].id).toBeDefined();
    });

    it("returns undefined for unknown id", () => {
      expect(store.update("nonexistent", { name: "X" })).toBeUndefined();
    });

    it("does not mutate original array", () => {
      const template = store.add(makeRequest());
      const allBefore = store.getAll();

      store.update(template.id, { name: "Changed" });

      const allAfter = store.getAll();
      expect(allBefore).not.toBe(allAfter);
    });
  });

  describe("remove", () => {
    it("removes template and returns true", () => {
      const template = store.add(makeRequest());
      const removed = store.remove(template.id);

      expect(removed).toBe(true);
      expect(store.getAll()).toHaveLength(0);
    });

    it("returns false for unknown id", () => {
      expect(store.remove("nonexistent")).toBe(false);
    });

    it("does not affect other templates", () => {
      const first = store.add(makeRequest({ name: "First" }));
      store.add(makeRequest({ name: "Second" }));

      store.remove(first.id);

      expect(store.getAll()).toHaveLength(1);
      expect(store.getAll()[0].name).toBe("Second");
    });
  });

  describe("save and load", () => {
    it("round-trips templates to disk", async () => {
      store.add(makeRequest({ name: "Saved PAR" }));
      await store.save();

      const store2 = createUserFixtureStore(filePath);
      await store2.load();

      expect(store2.getAll()).toHaveLength(1);
      expect(store2.getAll()[0].name).toBe("Saved PAR");
      store2.dispose();
    });

    it("loads empty array when file missing", async () => {
      const missingStore = createUserFixtureStore("/tmp/does-not-exist-user.json");
      await missingStore.load();

      expect(missingStore.getAll()).toEqual([]);
      missingStore.dispose();
    });

    it("loads empty array for invalid JSON", async () => {
      const { writeFile, mkdir } = await import("node:fs/promises");
      const { dirname } = await import("node:path");
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, "not json", "utf-8");

      await store.load();
      expect(store.getAll()).toEqual([]);
    });

    it("persists updates across load cycles", async () => {
      const template = store.add(makeRequest({ name: "Before" }));
      store.update(template.id, { name: "After" });
      await store.save();

      const store2 = createUserFixtureStore(filePath);
      await store2.load();

      expect(store2.getById(template.id)!.name).toBe("After");
      store2.dispose();
    });
  });

  describe("immutability", () => {
    it("add creates new array — old reference is stale", () => {
      store.add(makeRequest({ name: "First" }));
      const before = store.getAll();

      store.add(makeRequest({ name: "Second" }));
      const after = store.getAll();

      expect(before).not.toBe(after);
      expect(before).toHaveLength(1);
      expect(after).toHaveLength(2);
    });

    it("getById returns matching template", () => {
      const added = store.add(makeRequest());
      const found = store.getById(added.id);

      expect(found).toEqual(added);
    });
  });
});
