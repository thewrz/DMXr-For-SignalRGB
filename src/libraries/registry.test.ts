import { describe, it, expect } from "vitest";
import { createLibraryRegistry } from "./registry.js";
import type { FixtureLibraryProvider } from "./types.js";

function createMockProvider(overrides: Partial<FixtureLibraryProvider> = {}): FixtureLibraryProvider {
  return {
    id: "test",
    displayName: "Test Library",
    description: "A test library",
    type: "local-db",
    status: () => ({ available: true, state: "connected" }),
    getManufacturers: () => [],
    getFixtures: () => [],
    getFixtureModes: () => [],
    getModeChannels: () => [],
    searchFixtures: () => [],
    ...overrides,
  };
}

describe("createLibraryRegistry", () => {
  it("getAll returns all providers", () => {
    const p1 = createMockProvider({ id: "a" });
    const p2 = createMockProvider({ id: "b" });
    const registry = createLibraryRegistry([p1, p2]);

    expect(registry.getAll()).toHaveLength(2);
    expect(registry.getAll()[0].id).toBe("a");
    expect(registry.getAll()[1].id).toBe("b");
  });

  it("getById returns matching provider", () => {
    const p1 = createMockProvider({ id: "ofl" });
    const p2 = createMockProvider({ id: "local-db" });
    const registry = createLibraryRegistry([p1, p2]);

    expect(registry.getById("local-db")?.id).toBe("local-db");
    expect(registry.getById("ofl")?.id).toBe("ofl");
  });

  it("getById returns undefined for unknown id", () => {
    const registry = createLibraryRegistry([createMockProvider({ id: "ofl" })]);

    expect(registry.getById("unknown")).toBeUndefined();
  });

  it("getAvailable filters by status", () => {
    const available = createMockProvider({
      id: "a",
      status: () => ({ available: true, state: "connected" }),
    });
    const unavailable = createMockProvider({
      id: "b",
      status: () => ({ available: false, state: "not_configured" }),
    });
    const registry = createLibraryRegistry([available, unavailable]);

    const result = registry.getAvailable();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });

  it("works with empty providers list", () => {
    const registry = createLibraryRegistry([]);

    expect(registry.getAll()).toHaveLength(0);
    expect(registry.getAvailable()).toHaveLength(0);
    expect(registry.getById("x")).toBeUndefined();
  });
});
