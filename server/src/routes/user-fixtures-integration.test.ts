import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildServer } from "../server.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import {
  createMockUniverse,
  createTestConfig,
  createTestFixtureStore,
  createTestUserFixtureStore,
  createMockOflClient,
} from "../test-helpers.js";
import { createUserFixtureProvider } from "../libraries/user-fixture-provider.js";
import { createLibraryRegistry } from "../libraries/registry.js";
import type { UserFixtureStore } from "../fixtures/user-fixture-store.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { FastifyInstance } from "fastify";

const templatePayload = {
  name: "My RGB PAR",
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
};

describe("Custom fixture integration: create → browse → import", () => {
  let app: FastifyInstance;
  let userStore: UserFixtureStore;
  let fixtureStore: FixtureStore;

  beforeEach(async () => {
    const universe = createMockUniverse();
    const manager = createUniverseManager(universe);
    manager.resumeNormal();

    userStore = createTestUserFixtureStore();
    fixtureStore = createTestFixtureStore();

    const userProvider = createUserFixtureProvider(userStore);
    const registry = createLibraryRegistry([
      {
        id: "ofl",
        displayName: "Open Fixture Library",
        description: "OFL",
        type: "api",
        status: () => ({ available: true, state: "connected" }),
        getManufacturers: () => [],
        getFixtures: () => [],
        getFixtureModes: () => [],
        getModeChannels: () => [],
        searchFixtures: () => [],
      },
      userProvider,
    ]);

    app = await buildServer({
      config: createTestConfig(),
      manager,
      driver: "null",
      startTime: Date.now(),
      fixtureStore,
      oflClient: createMockOflClient(),
      registry,
      userFixtureStore: userStore,
    });
  });

  afterEach(async () => {
    userStore.dispose();
    await app.close();
  });

  it("full flow: create template → browse library → import to fixtures", async () => {
    // 1. Create template via API
    const createRes = await app.inject({
      method: "POST",
      url: "/user-fixtures",
      payload: templatePayload,
    });
    expect(createRes.statusCode).toBe(201);
    const template = createRes.json();
    expect(template.id).toBeDefined();

    // 2. Browse via library — see manufacturer
    const mfrsRes = await app.inject({
      method: "GET",
      url: "/libraries/custom/manufacturers",
    });
    expect(mfrsRes.statusCode).toBe(200);
    const mfrs = mfrsRes.json();
    expect(mfrs).toHaveLength(1);
    expect(mfrs[0].name).toBe("DIY");
    const mfrId = mfrs[0].id;

    // 3. Browse fixtures for manufacturer
    const fixturesRes = await app.inject({
      method: "GET",
      url: `/libraries/custom/manufacturers/${mfrId}/fixtures`,
    });
    expect(fixturesRes.statusCode).toBe(200);
    const fixtures = fixturesRes.json();
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0].name).toBe("My RGB PAR");
    const fixtureId = fixtures[0].id;

    // 4. Get modes
    const modesRes = await app.inject({
      method: "GET",
      url: `/libraries/custom/fixtures/${fixtureId}/modes`,
    });
    expect(modesRes.statusCode).toBe(200);
    const modesData = modesRes.json();
    expect(modesData.modes).toHaveLength(1);
    expect(modesData.modes[0].name).toBe("3-channel");
    expect(modesData.modes[0].channelCount).toBe(3);
    const modeId = modesData.modes[0].id;

    // 5. Get channels
    const channelsRes = await app.inject({
      method: "GET",
      url: `/libraries/custom/fixtures/${fixtureId}/modes/${modeId}/channels`,
    });
    expect(channelsRes.statusCode).toBe(200);
    const channels = channelsRes.json();
    expect(channels).toHaveLength(3);
    expect(channels[0].name).toBe("Red");

    // 6. Import fixture via library import endpoint
    const importRes = await app.inject({
      method: "POST",
      url: `/libraries/custom/fixtures/${fixtureId}/modes/${modeId}/import`,
      payload: { name: "Stage Left PAR", dmxStartAddress: 1 },
    });
    expect(importRes.statusCode).toBe(201);
    const imported = importRes.json();
    expect(imported.name).toBe("Stage Left PAR");
    expect(imported.source).toBe("custom");
    expect(imported.channelCount).toBe(3);
    expect(imported.channels).toHaveLength(3);

    // 7. Verify in fixture store
    const allFixtures = await app.inject({ method: "GET", url: "/fixtures" });
    expect(allFixtures.json()).toHaveLength(1);
    expect(allFixtures.json()[0].id).toBe(imported.id);
    expect(allFixtures.json()[0].source).toBe("custom");
  });

  it("custom library shows in /libraries listing", async () => {
    const res = await app.inject({ method: "GET", url: "/libraries" });
    expect(res.statusCode).toBe(200);
    const libs = res.json();
    const custom = libs.find((l: { id: string }) => l.id === "custom");
    expect(custom).toBeDefined();
    expect(custom.displayName).toBe("My Fixtures");
    expect(custom.status.available).toBe(true);
  });
});
