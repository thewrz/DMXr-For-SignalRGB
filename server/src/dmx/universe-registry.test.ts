import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createUniverseRegistry } from "./universe-registry.js";
import type { UniverseRegistry } from "./universe-registry.js";
import type { AddUniverseRequest } from "../types/protocol.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";
import { rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makeRequest(overrides: Partial<AddUniverseRequest> = {}): AddUniverseRequest {
  return {
    name: "Stage Left",
    devicePath: "/dev/ttyUSB0",
    driverType: "enttec-usb-dmx-pro",
    ...overrides,
  };
}

describe("createUniverseRegistry", () => {
  let registry: UniverseRegistry;
  let filePath: string;

  beforeEach(() => {
    filePath = join(tmpdir(), `dmxr-universe-test-${Date.now()}.json`);
    registry = createUniverseRegistry(filePath);
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
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe("add", () => {
    it("creates a universe with a generated id", () => {
      const universe = registry.add(makeRequest());

      expect(universe.id).toBeDefined();
      expect(universe.id).not.toBe("");
      expect(universe.name).toBe("Stage Left");
      expect(universe.devicePath).toBe("/dev/ttyUSB0");
      expect(universe.driverType).toBe("enttec-usb-dmx-pro");
    });

    it("adds universe to the registry", () => {
      registry.add(makeRequest());
      expect(registry.getAll()).toHaveLength(1);
    });

    it("rejects duplicate names", () => {
      registry.add(makeRequest({ name: "Stage Left" }));
      expect(() => registry.add(makeRequest({ name: "Stage Left" }))).toThrow(
        /name.*already exists/i,
      );
    });

    it("rejects duplicate devicePath except null", () => {
      registry.add(makeRequest({ devicePath: "/dev/ttyUSB0" }));
      expect(() =>
        registry.add(makeRequest({ name: "Other", devicePath: "/dev/ttyUSB0" })),
      ).toThrow(/device.*already assigned/i);
    });

    it("allows multiple null driver universes", () => {
      registry.add(makeRequest({ name: "Test 1", devicePath: "null", driverType: "null" }));
      registry.add(makeRequest({ name: "Test 2", devicePath: "null", driverType: "null" }));

      expect(registry.getAll()).toHaveLength(2);
    });

    it("stores serialNumber when provided", () => {
      const universe = registry.add(makeRequest({ serialNumber: "EN466833" }));
      expect(universe.serialNumber).toBe("EN466833");
    });
  });

  describe("getById", () => {
    it("returns universe by id", () => {
      const added = registry.add(makeRequest());
      const found = registry.getById(added.id);
      expect(found).toEqual(added);
    });

    it("returns undefined for unknown id", () => {
      expect(registry.getById("nonexistent")).toBeUndefined();
    });
  });

  describe("getByDevicePath", () => {
    it("returns matching universe", () => {
      const added = registry.add(makeRequest({ devicePath: "/dev/ttyUSB1" }));
      const found = registry.getByDevicePath("/dev/ttyUSB1");
      expect(found).toEqual(added);
    });

    it("returns undefined when no match", () => {
      expect(registry.getByDevicePath("/dev/ttyUSB99")).toBeUndefined();
    });
  });

  describe("update", () => {
    it("returns updated universe without mutating original", () => {
      const original = registry.add(makeRequest());
      const updated = registry.update(original.id, { name: "New Name" });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe("New Name");
      expect(updated!.id).toBe(original.id);
      expect(updated!.devicePath).toBe(original.devicePath);
      // Verify immutability: original reference in registry should be replaced
      expect(registry.getById(original.id)!.name).toBe("New Name");
    });

    it("returns undefined for unknown id", () => {
      expect(registry.update("nonexistent", { name: "X" })).toBeUndefined();
    });

    it("rejects name collision with another universe", () => {
      registry.add(makeRequest({ name: "First" }));
      const second = registry.add(
        makeRequest({ name: "Second", devicePath: "/dev/ttyUSB1" }),
      );

      expect(() => registry.update(second.id, { name: "First" })).toThrow(
        /name.*already exists/i,
      );
    });

    it("allows updating to the same name (no self-collision)", () => {
      const universe = registry.add(makeRequest({ name: "Keep Me" }));
      const updated = registry.update(universe.id, { name: "Keep Me" });
      expect(updated!.name).toBe("Keep Me");
    });
  });

  describe("remove", () => {
    it("removes universe and returns true", () => {
      const universe = registry.add(makeRequest());
      const removed = registry.remove(universe.id);

      expect(removed).toBe(true);
      expect(registry.getAll()).toHaveLength(0);
    });

    it("returns false for unknown id", () => {
      expect(registry.remove("nonexistent")).toBe(false);
    });

    it("rejects deletion of default universe", () => {
      // Load creates default universe
      expect(() => registry.remove(DEFAULT_UNIVERSE_ID)).toThrow(
        /cannot remove.*default/i,
      );
    });
  });

  describe("save and load", () => {
    it("persists universes to disk and loads them back", async () => {
      registry.add(makeRequest({ name: "Saved Universe" }));
      await registry.save();

      const registry2 = createUniverseRegistry(filePath);
      await registry2.load();

      // load() adds a default universe if not present in the file
      const saved = registry2.getAll().find((u) => u.name === "Saved Universe");
      expect(saved).toBeDefined();
      expect(saved!.devicePath).toBe("/dev/ttyUSB0");
      expect(registry2.getDefault()).toBeDefined();
    });

    it("creates default universe if file is missing", async () => {
      const missingRegistry = createUniverseRegistry("/tmp/does-not-exist-uni.json");
      await missingRegistry.load();

      const defaultUni = missingRegistry.getDefault();
      expect(defaultUni).toBeDefined();
      expect(defaultUni.id).toBe(DEFAULT_UNIVERSE_ID);
    });

    it("handles corrupt JSON gracefully and creates default", async () => {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(filePath, "not valid json{{{", "utf-8");

      const registry2 = createUniverseRegistry(filePath);
      await registry2.load();

      expect(registry2.getDefault()).toBeDefined();
      expect(registry2.getDefault().id).toBe(DEFAULT_UNIVERSE_ID);
    });

    it("writes valid JSON", async () => {
      registry.add(makeRequest());
      await registry.save();

      const raw = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(Array.isArray(parsed)).toBe(true);
    });
  });

  describe("getDefault", () => {
    it("returns the default universe after load", async () => {
      await registry.load();

      const defaultUni = registry.getDefault();
      expect(defaultUni).toBeDefined();
      expect(defaultUni.id).toBe(DEFAULT_UNIVERSE_ID);
      expect(defaultUni.name).toBe("Default");
    });

    it("throws if no default exists (before load)", () => {
      expect(() => registry.getDefault()).toThrow(/default universe not found/i);
    });
  });
});
