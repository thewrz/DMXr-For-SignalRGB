import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../../server.js";
import { createFixtureStore, type FixtureStore } from "../../fixtures/fixture-store.js";
import { createGroupStore, type GroupStore } from "../../fixtures/group-store.js";
import { createSettingsStore, type SettingsStore } from "../../config/settings-store.js";
import { createRemapPresetStore } from "../../config/remap-preset-store.js";
import { createUserFixtureStore } from "../../fixtures/user-fixture-store.js";
import { createMockUniverse, createTestConfig, createMockOflClient, createMockRegistry } from "../../test-helpers.js";
import { createUniverseManager } from "../../dmx/universe-manager.js";
import { MovementEngine } from "../../fixtures/movement-interpolator.js";

export interface TestServer {
  readonly app: FastifyInstance;
  readonly port: number;
  readonly baseUrl: string;
  readonly fixtureStore: FixtureStore;
  readonly groupStore: GroupStore;
  readonly settingsStore: SettingsStore;
  readonly cleanup: () => Promise<void>;
}

const tmpFiles: string[] = [];

function tmpPath(prefix: string): string {
  const path = `/tmp/dmxr-ui-test-${prefix}-${randomUUID()}.json`;
  tmpFiles.push(path);
  return path;
}

export async function startTestServer(): Promise<TestServer> {
  const fixturesPath = tmpPath("fixtures");
  const groupsPath = tmpPath("groups");
  const settingsPath = tmpPath("settings");
  const remapPresetsPath = tmpPath("remap-presets");
  const userFixturesPath = tmpPath("user-fixtures");

  const fixtureStore = createFixtureStore(fixturesPath);
  const groupStore = createGroupStore(groupsPath);
  const settingsStore = createSettingsStore(settingsPath);
  const remapPresetStore = createRemapPresetStore(remapPresetsPath);
  const userFixtureStore = createUserFixtureStore(userFixturesPath);

  // Mark setup + onboarding as completed so wizard/tour don't appear
  await settingsStore.load();
  await settingsStore.update({ setupCompleted: true, onboardingCompleted: true });

  await fixtureStore.load();
  await groupStore.load();
  await remapPresetStore.load();
  await userFixtureStore.load();

  const universe = createMockUniverse();
  const manager = createUniverseManager(universe);
  const movementEngine = new MovementEngine();

  const config = createTestConfig({
    port: 0,
    host: "127.0.0.1",
    dmxDriver: "null",
    fixturesPath,
    userFixturesPath,
  });

  const app = await buildServer({
    config,
    manager,
    driver: "null",
    startTime: Date.now(),
    fixtureStore,
    userFixtureStore,
    oflClient: createMockOflClient(),
    registry: createMockRegistry(),
    settingsStore,
    serverVersion: "0.0.0-test",
    serverId: "test-server",
    serverName: "Test DMXr",
    remapPresetStore,
    groupStore,
    movementEngine,
  });

  const address = await app.listen({ port: 0, host: "127.0.0.1" });
  const port = (app.server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const paths = [fixturesPath, groupsPath, settingsPath, remapPresetsPath, userFixturesPath];

  return {
    app,
    port,
    baseUrl,
    fixtureStore,
    groupStore,
    settingsStore,
    async cleanup() {
      await app.close();
      for (const p of paths) {
        await rm(p, { force: true }).catch(() => {});
      }
    },
  };
}
