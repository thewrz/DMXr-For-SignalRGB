import type { DmxUniverse } from "./dmx/driver-factory.js";
import type { ServerConfig } from "./config/server-config.js";
import type { OflClient } from "./ofl/ofl-client.js";
import { createFixtureStore } from "./fixtures/fixture-store.js";
import type { FixtureStore } from "./fixtures/fixture-store.js";

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
    host: "127.0.0.1",
    dmxDriver: "null",
    dmxDevicePath: "",
    logLevel: "silent",
    fixturesPath: "/tmp/dmxr-test-fixtures.json",
    ...overrides,
  };
}

export function createTestFixtureStore(): FixtureStore {
  return createFixtureStore("/tmp/dmxr-test-fixtures.json");
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
  };
}
