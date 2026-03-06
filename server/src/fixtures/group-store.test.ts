import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createGroupStore } from "./group-store.js";
import type { GroupStore } from "./group-store.js";

describe("GroupStore", () => {
  let dir: string;
  let filePath: string;
  let store: GroupStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "group-store-test-"));
    filePath = join(dir, "groups.json");
    store = createGroupStore(filePath);
  });

  afterEach(async () => {
    store.dispose();
    await rm(dir, { recursive: true, force: true });
  });

  // --- CRUD ---

  it("starts empty", () => {
    expect(store.getAll()).toEqual([]);
  });

  it("adds a group and returns it", () => {
    const group = store.add({ name: "Stage Left", fixtureIds: ["f1", "f2"] });
    expect(group.name).toBe("Stage Left");
    expect(group.fixtureIds).toEqual(["f1", "f2"]);
    expect(group.id).toBeTruthy();
    expect(group.createdAt).toBeTruthy();
  });

  it("getAll returns all added groups", () => {
    store.add({ name: "A", fixtureIds: [] });
    store.add({ name: "B", fixtureIds: ["f1"] });
    expect(store.getAll()).toHaveLength(2);
  });

  it("getById returns the correct group", () => {
    const group = store.add({ name: "Par Cans", fixtureIds: ["f1"] });
    expect(store.getById(group.id)).toEqual(group);
  });

  it("getById returns undefined for unknown id", () => {
    expect(store.getById("nonexistent")).toBeUndefined();
  });

  it("updates a group name", () => {
    const group = store.add({ name: "Old", fixtureIds: ["f1"] });
    const updated = store.update(group.id, { name: "New" });
    expect(updated?.name).toBe("New");
    expect(store.getById(group.id)?.name).toBe("New");
  });

  it("updates group fixtureIds", () => {
    const group = store.add({ name: "G", fixtureIds: ["f1"] });
    const updated = store.update(group.id, { fixtureIds: ["f2", "f3"] });
    expect(updated?.fixtureIds).toEqual(["f2", "f3"]);
  });

  it("updates group color", () => {
    const group = store.add({ name: "G", fixtureIds: [], color: "#ff0000" });
    const updated = store.update(group.id, { color: "#00ff00" });
    expect(updated?.color).toBe("#00ff00");
  });

  it("update returns undefined for non-existent group", () => {
    expect(store.update("nonexistent", { name: "X" })).toBeUndefined();
  });

  it("removes a group", () => {
    const group = store.add({ name: "G", fixtureIds: [] });
    expect(store.remove(group.id)).toBe(true);
    expect(store.getAll()).toHaveLength(0);
  });

  it("remove returns false for non-existent group", () => {
    expect(store.remove("nonexistent")).toBe(false);
  });

  // --- Validation ---

  it("rejects empty name on add", () => {
    expect(() => store.add({ name: "", fixtureIds: [] })).toThrow("must not be empty");
    expect(() => store.add({ name: "   ", fixtureIds: [] })).toThrow("must not be empty");
  });

  it("rejects duplicate name on add", () => {
    store.add({ name: "Unique", fixtureIds: [] });
    expect(() => store.add({ name: "Unique", fixtureIds: [] })).toThrow("already exists");
  });

  it("rejects duplicate name on update", () => {
    store.add({ name: "Alpha", fixtureIds: [] });
    const beta = store.add({ name: "Beta", fixtureIds: [] });
    expect(() => store.update(beta.id, { name: "Alpha" })).toThrow("already exists");
  });

  it("allows updating a group to its own name", () => {
    const group = store.add({ name: "Same", fixtureIds: [] });
    const updated = store.update(group.id, { name: "Same" });
    expect(updated?.name).toBe("Same");
  });

  // --- Persistence ---

  it("save writes JSON and load reads it back", async () => {
    store.add({ name: "Persisted", fixtureIds: ["f1"] });
    await store.save();

    const store2 = createGroupStore(filePath);
    await store2.load();
    expect(store2.getAll()).toHaveLength(1);
    expect(store2.getAll()[0].name).toBe("Persisted");
    store2.dispose();
  });

  it("load handles missing file gracefully", async () => {
    await store.load();
    expect(store.getAll()).toEqual([]);
  });

  it("load handles corrupt JSON gracefully", async () => {
    await writeFile(filePath, "not valid json{{{", "utf-8");
    await store.load();
    expect(store.getAll()).toEqual([]);
  });

  it("load rejects invalid data shape", async () => {
    await writeFile(filePath, JSON.stringify([{ bad: true }]), "utf-8");
    await store.load();
    expect(store.getAll()).toEqual([]);
  });

  it("save creates parent directories", async () => {
    const nested = join(dir, "nested", "deep", "groups.json");
    const nestedStore = createGroupStore(nested);
    nestedStore.add({ name: "Deep", fixtureIds: [] });
    await nestedStore.save();

    const raw = await readFile(nested, "utf-8");
    const data = JSON.parse(raw);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Deep");
    nestedStore.dispose();
  });

  // --- getGroupsForFixture ---

  it("returns groups containing a fixture", () => {
    store.add({ name: "G1", fixtureIds: ["f1", "f2"] });
    store.add({ name: "G2", fixtureIds: ["f2", "f3"] });
    store.add({ name: "G3", fixtureIds: ["f3"] });

    const result = store.getGroupsForFixture("f2");
    expect(result).toHaveLength(2);
    expect(result.map((g) => g.name)).toEqual(["G1", "G2"]);
  });

  it("returns empty array when fixture is in no groups", () => {
    store.add({ name: "G1", fixtureIds: ["f1"] });
    expect(store.getGroupsForFixture("f99")).toEqual([]);
  });

  // --- removeFixtureFromAll ---

  it("removes fixture from all groups that contain it", () => {
    store.add({ name: "G1", fixtureIds: ["f1", "f2"] });
    store.add({ name: "G2", fixtureIds: ["f2", "f3"] });

    store.removeFixtureFromAll("f2");

    const all = store.getAll();
    expect(all[0].fixtureIds).toEqual(["f1"]);
    expect(all[1].fixtureIds).toEqual(["f3"]);
  });

  it("removeFixtureFromAll is a no-op when fixture is absent", () => {
    store.add({ name: "G1", fixtureIds: ["f1"] });
    store.removeFixtureFromAll("f99");
    expect(store.getAll()[0].fixtureIds).toEqual(["f1"]);
  });

  // --- dispose ---

  it("dispose clears pending save timer without error", () => {
    store.add({ name: "G", fixtureIds: [] });
    store.scheduleSave();
    store.dispose();
    // no error thrown, timer cleared
  });
});
