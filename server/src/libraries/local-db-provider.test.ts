import { describe, it, expect } from "vitest";
import { createLocalDbProvider } from "./local-db-provider.js";
import type { SsClient, SsStatus } from "../soundswitch/ss-client.js";

function createMockSsClient(): SsClient {
  return {
    getManufacturers: () => [
      { id: 1, name: "TestMfr", fixtureCount: 2 },
    ],
    getFixtures: (mfrId: number) => {
      if (mfrId === 1) return [{ id: 10, name: "TestFixture", modeCount: 1 }];
      return [];
    },
    getFixtureModes: (fixtureId: number) => {
      if (fixtureId === 10) return [{ id: 100, name: "3ch", channelCount: 3 }];
      return [];
    },
    getModeChannels: () => [],
    mapToFixtureChannels: () => [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    ],
    searchFixtures: () => [
      { fixtureId: 10, fixtureName: "TestFixture", mfrId: 1, mfrName: "TestMfr", modeCount: 1, category: "PAR" },
    ],
    close: () => {},
  };
}

describe("createLocalDbProvider", () => {
  it("has correct id and metadata", () => {
    const provider = createLocalDbProvider(null, { available: false, state: "not_configured" });

    expect(provider.id).toBe("local-db");
    expect(provider.displayName).toBe("Local Fixture Database");
    expect(provider.type).toBe("local-db");
  });

  it("returns status from SsStatus", () => {
    const status: SsStatus = { available: true, state: "connected", fixtureCount: 42 };
    const provider = createLocalDbProvider(createMockSsClient(), status);

    expect(provider.status()).toEqual(status);
  });

  it("delegates getManufacturers to client", () => {
    const status: SsStatus = { available: true, state: "connected" };
    const provider = createLocalDbProvider(createMockSsClient(), status);

    const mfrs = provider.getManufacturers();
    expect(mfrs).toHaveLength(1);
    expect(mfrs[0].name).toBe("TestMfr");
  });

  it("delegates getFixtures to client", () => {
    const status: SsStatus = { available: true, state: "connected" };
    const provider = createLocalDbProvider(createMockSsClient(), status);

    expect(provider.getFixtures(1)).toHaveLength(1);
    expect(provider.getFixtures(999)).toHaveLength(0);
  });

  it("delegates getFixtureModes to client", () => {
    const status: SsStatus = { available: true, state: "connected" };
    const provider = createLocalDbProvider(createMockSsClient(), status);

    expect(provider.getFixtureModes(10)).toHaveLength(1);
    expect(provider.getFixtureModes(999)).toHaveLength(0);
  });

  it("delegates getModeChannels to client (mapToFixtureChannels)", () => {
    const status: SsStatus = { available: true, state: "connected" };
    const provider = createLocalDbProvider(createMockSsClient(), status);

    const channels = provider.getModeChannels(100);
    expect(channels).toHaveLength(1);
    expect(channels[0].name).toBe("Red");
  });

  it("delegates searchFixtures to client", () => {
    const status: SsStatus = { available: true, state: "connected" };
    const provider = createLocalDbProvider(createMockSsClient(), status);

    const results = provider.searchFixtures("test");
    expect(results).toHaveLength(1);
    expect(results[0].fixtureName).toBe("TestFixture");
  });

  it("returns empty arrays when client is null", () => {
    const status: SsStatus = { available: false, state: "not_configured" };
    const provider = createLocalDbProvider(null, status);

    expect(provider.getManufacturers()).toHaveLength(0);
    expect(provider.getFixtures(1)).toHaveLength(0);
    expect(provider.getFixtureModes(1)).toHaveLength(0);
    expect(provider.getModeChannels(1)).toHaveLength(0);
    expect(provider.searchFixtures("test")).toHaveLength(0);
  });

  it("close delegates to client", () => {
    let closed = false;
    const client = createMockSsClient();
    client.close = () => { closed = true; };

    const provider = createLocalDbProvider(client, { available: true, state: "connected" });
    provider.close?.();

    expect(closed).toBe(true);
  });
});
