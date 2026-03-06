import { randomUUID } from "node:crypto";
import type { DmxUniverse } from "./dmx/driver-factory.js";
import type { ServerConfig } from "./config/server-config.js";
import type { OflClient, OflSearchResult } from "./ofl/ofl-client.js";
import { createFixtureStore } from "./fixtures/fixture-store.js";
import type { FixtureStore } from "./fixtures/fixture-store.js";
import { createUserFixtureStore } from "./fixtures/user-fixture-store.js";
import type { UserFixtureStore } from "./fixtures/user-fixture-store.js";
import type { LibraryRegistry } from "./libraries/types.js";
import { createLibraryRegistry } from "./libraries/registry.js";
import { createBuiltinTemplateProvider } from "./libraries/builtin-template-provider.js";
import type { AddFixtureRequest } from "./types/protocol.js";

function uniqueFixturesPath(): string {
  return `/tmp/dmxr-test-fixtures-${randomUUID()}.json`;
}

export function createMockUniverse(): DmxUniverse & {
  updateCalls: Array<Record<number, number>>;
  updateAllCalls: number[];
} {
  const updateCalls: Array<Record<number, number>> = [];
  const updateAllCalls: number[] = [];

  return {
    updateCalls,
    updateAllCalls,
    update: (channels) => {
      updateCalls.push(channels);
    },
    updateAll: (value) => {
      updateAllCalls.push(value);
    },
  };
}

export function createTestConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    port: 0,
    udpPort: 0,
    host: "127.0.0.1",
    dmxDriver: "null",
    dmxDevicePath: "",
    logLevel: "silent",
    fixturesPath: uniqueFixturesPath(),
    userFixturesPath: `/tmp/dmxr-test-user-fixtures-${randomUUID()}.json`,
    mdnsEnabled: false,
    portRangeSize: 10,
    ...overrides,
  };
}

export function createTestFixtureStore(): FixtureStore {
  return createFixtureStore(uniqueFixturesPath());
}

export function createTestUserFixtureStore(): UserFixtureStore {
  return createUserFixtureStore(`/tmp/dmxr-test-user-fixtures-${randomUUID()}.json`);
}

export function createMockOflClient(): OflClient {
  return {
    async getManufacturers() {
      return {
        cameo: { name: "Cameo", fixtureCount: 42 },
        generic: { name: "Generic", fixtureCount: 5 },
      };
    },
    async getManufacturerFixtures(key: string) {
      if (key === "cameo") {
        return {
          name: "Cameo",
          fixtures: [
            { key: "flat-pro-18", name: "Flat Pro 18", categories: ["Color Changer"] },
          ],
        };
      }
      throw new Error(`Manufacturer not found: ${key}`);
    },
    async getFixture(mfr: string, model: string) {
      if (mfr === "cameo" && model === "flat-pro-18") {
        return {
          name: "Flat Pro 18",
          categories: ["Color Changer"],
          availableChannels: {
            Red: { type: "ColorIntensity", color: "Red", defaultValue: 0 },
            Green: { type: "ColorIntensity", color: "Green", defaultValue: 0 },
            Blue: { type: "ColorIntensity", color: "Blue", defaultValue: 0 },
          },
          modes: [
            { name: "3-channel", channels: ["Red", "Green", "Blue"] },
          ],
        };
      }
      throw new Error(`Fixture not found: ${mfr}/${model}`);
    },
    searchFixtures(query: string): OflSearchResult[] {
      const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
      if (tokens.length === 0) return [];

      const fixtures = [
        { mfrKey: "cameo", mfrName: "Cameo", fixtureKey: "flat-pro-18", fixtureName: "Flat Pro 18", categories: ["Color Changer"] as readonly string[] },
      ];

      return fixtures.filter((f) => {
        const combined = `${f.fixtureName} ${f.mfrName} ${f.categories.join(" ")}`.toLowerCase();
        return tokens.every((t) => combined.includes(t));
      });
    },
  };
}

export function createMockRegistry(
  ...extras: import("./libraries/types.js").FixtureLibraryProvider[]
): LibraryRegistry {
  return createLibraryRegistry([
    {
      id: "ofl",
      displayName: "Open Fixture Library",
      description: "Community-maintained open fixture database",
      type: "api",
      status: () => ({ available: true, state: "connected" }),
      getManufacturers: () => [],
      getFixtures: () => [],
      getFixtureModes: () => [],
      getModeChannels: () => [],
      searchFixtures: () => [],
    },
    createBuiltinTemplateProvider(),
    ...extras,
  ]);
}

// ── Test Fixture Factories ──────────────────────────────────

/** Standard 3-channel RGB PAR fixture payload. */
export function makeTestPar(
  overrides: Partial<AddFixtureRequest> & { dmxStartAddress: number },
): AddFixtureRequest {
  return {
    name: "Test PAR",
    oflKey: "test/test",
    oflFixtureName: "Test",
    mode: "3-channel",
    channelCount: 3,
    channels: [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ],
    ...overrides,
  };
}

/** 5-channel moving head with Pan/Tilt + RGB. */
export function makeTestMovingHead(
  overrides: Partial<AddFixtureRequest> & { dmxStartAddress: number },
): AddFixtureRequest {
  return {
    name: "Test Moving Head",
    oflKey: "test/mover",
    oflFixtureName: "Mover",
    mode: "5ch",
    channelCount: 5,
    channels: [
      { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
      { offset: 1, name: "Tilt", type: "Tilt", defaultValue: 128 },
      { offset: 2, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 3, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 4, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ],
    ...overrides,
  };
}

/** Basic strobe fixture (dimmer + strobe + mode). */
export function makeTestStrobe(
  overrides: Partial<AddFixtureRequest> & { dmxStartAddress: number },
): AddFixtureRequest {
  return {
    name: "Test Strobe",
    oflKey: "test/strobe",
    oflFixtureName: "Strobe",
    mode: "3ch",
    channelCount: 3,
    channels: [
      { offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 },
      { offset: 1, name: "Strobe", type: "Strobe", defaultValue: 0 },
      { offset: 2, name: "Mode", type: "Generic", defaultValue: 128 },
    ],
    ...overrides,
  };
}
