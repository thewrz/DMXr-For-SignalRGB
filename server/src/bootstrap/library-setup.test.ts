import { describe, it, expect } from "vitest";
import { createTestConfig, createMockOflClient, createTestUserFixtureStore } from "../test-helpers.js";
import { createLibraryStack } from "./library-setup.js";

describe("createLibraryStack", () => {
  it("creates a registry with at least 4 providers", () => {
    const config = createTestConfig();
    const oflClient = createMockOflClient();
    const userFixtureStore = createTestUserFixtureStore();

    const registry = createLibraryStack(config, oflClient, userFixtureStore);
    const providers = registry.getAll();

    expect(providers.length).toBeGreaterThanOrEqual(4);
  });

  it("includes the OFL provider", () => {
    const config = createTestConfig();
    const oflClient = createMockOflClient();
    const userFixtureStore = createTestUserFixtureStore();

    const registry = createLibraryStack(config, oflClient, userFixtureStore);

    expect(registry.getById("ofl")).toBeDefined();
  });

  it("includes the builtin template provider", () => {
    const config = createTestConfig();
    const oflClient = createMockOflClient();
    const userFixtureStore = createTestUserFixtureStore();

    const registry = createLibraryStack(config, oflClient, userFixtureStore);

    expect(registry.getById("builtin")).toBeDefined();
  });

  it("includes the local-db provider", () => {
    const config = createTestConfig();
    const oflClient = createMockOflClient();
    const userFixtureStore = createTestUserFixtureStore();

    const registry = createLibraryStack(config, oflClient, userFixtureStore);

    expect(registry.getById("local-db")).toBeDefined();
  });

  it("includes the custom (user fixture) provider", () => {
    const config = createTestConfig();
    const oflClient = createMockOflClient();
    const userFixtureStore = createTestUserFixtureStore();

    const registry = createLibraryStack(config, oflClient, userFixtureStore);

    expect(registry.getById("custom")).toBeDefined();
  });

  it("works without SoundSwitch DB configured (localDbPath undefined)", () => {
    const config = createTestConfig(); // no localDbPath by default
    const oflClient = createMockOflClient();
    const userFixtureStore = createTestUserFixtureStore();

    const registry = createLibraryStack(config, oflClient, userFixtureStore);

    // local-db provider exists but should report as unavailable
    const localDb = registry.getById("local-db");
    expect(localDb).toBeDefined();
    expect(localDb!.status().available).toBe(false);
  });

  it("returns a registry where getAvailable excludes unavailable providers", () => {
    const config = createTestConfig();
    const oflClient = createMockOflClient();
    const userFixtureStore = createTestUserFixtureStore();

    const registry = createLibraryStack(config, oflClient, userFixtureStore);
    const available = registry.getAvailable();

    // Without a real SoundSwitch DB, local-db should not be in the available list
    const localDbAvailable = available.find((p) => p.id === "local-db");
    expect(localDbAvailable).toBeUndefined();
  });
});
