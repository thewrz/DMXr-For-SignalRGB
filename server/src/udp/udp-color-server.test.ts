import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSocket } from "node:dgram";
import { createUdpColorServer, type UdpColorServer } from "./udp-color-server.js";
import { encodeColorPacket, FLAG_BLACKOUT, type ColorPacket } from "./packet-parser.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import { createMockUniverse, createTestFixtureStore } from "../test-helpers.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";

function addRgbFixture(store: FixtureStore, name: string, startAddr: number) {
  return store.add({
    name,
    mode: "3ch",
    dmxStartAddress: startAddr,
    channels: [
      { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
      { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
      { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
    ],
  });
}

function makePacket(overrides: Partial<ColorPacket> = {}): ColorPacket {
  return {
    version: 1,
    flags: 0,
    sequence: 1,
    timestamp: Date.now(),
    fixtures: [{ index: 0, r: 255, g: 128, b: 64, brightness: 255 }],
    ...overrides,
  };
}

function sendUdpPacket(port: number, buf: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = createSocket("udp4");
    client.send(buf, port, "127.0.0.1", (err) => {
      client.close();
      if (err) reject(err);
      else resolve();
    });
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("UdpColorServer", () => {
  let server: UdpColorServer;
  let store: FixtureStore;
  let universe: ReturnType<typeof createMockUniverse>;
  let boundPort: number;

  beforeEach(async () => {
    universe = createMockUniverse();
    const manager = createUniverseManager(universe);
    store = createTestFixtureStore();
    addRgbFixture(store, "Fixture1", 1);
    addRgbFixture(store, "Fixture2", 10);

    server = createUdpColorServer({
      fixtureStore: store,
      manager,
    });
    boundPort = await server.start(0); // random port
  });

  afterEach(async () => {
    await server.close();
  });

  it("starts and reports stats", () => {
    const stats = server.getStats();
    expect(stats.packetsReceived).toBe(0);
    expect(stats.packetsProcessed).toBe(0);
    expect(stats.parseErrors).toBe(0);
  });

  it("processes a valid color packet", async () => {
    const packet = makePacket({
      fixtures: [{ index: 0, r: 255, g: 128, b: 64, brightness: 255 }],
    });
    const buf = encodeColorPacket(packet);

    await sendUdpPacket(boundPort, buf);
    await waitMs(50);

    const stats = server.getStats();
    expect(stats.packetsReceived).toBe(1);
    expect(stats.packetsProcessed).toBe(1);
    expect(stats.parseErrors).toBe(0);

    // DMX should have been updated
    expect(universe.updateCalls.length).toBeGreaterThan(0);
    expect(universe.updateCalls[0][1]).toBe(255); // Red channel at addr 1
    expect(universe.updateCalls[0][2]).toBe(128); // Green channel at addr 2
    expect(universe.updateCalls[0][3]).toBe(64);  // Blue channel at addr 3
  });

  it("increments parseErrors for garbage data", async () => {
    await sendUdpPacket(boundPort, Buffer.from("hello"));
    await waitMs(50);

    const stats = server.getStats();
    expect(stats.packetsReceived).toBe(1);
    expect(stats.parseErrors).toBe(1);
    expect(stats.packetsProcessed).toBe(0);
  });

  it("handles blackout flag", async () => {
    const packet = makePacket({
      flags: FLAG_BLACKOUT,
      fixtures: [],
    });
    await sendUdpPacket(boundPort, encodeColorPacket(packet));
    await waitMs(50);

    const stats = server.getStats();
    expect(stats.packetsProcessed).toBe(1);
    expect(universe.updateAllCalls).toContain(0);
  });

  it("does not count forward jumps as gaps (interleaved fixtures)", async () => {
    const pkt1 = encodeColorPacket(makePacket({ sequence: 1 }));
    const pkt2 = encodeColorPacket(makePacket({ sequence: 5 })); // forward jump from interleaved fixtures

    await sendUdpPacket(boundPort, pkt1);
    await waitMs(20);
    await sendUdpPacket(boundPort, pkt2);
    await waitMs(50);

    const stats = server.getStats();
    expect(stats.packetsReceived).toBe(2);
    expect(stats.sequenceGaps).toBe(0);
  });

  it("counts reordered packets as gaps", async () => {
    const pkt1 = encodeColorPacket(makePacket({ sequence: 100 }));
    const pkt2 = encodeColorPacket(makePacket({ sequence: 50 })); // old packet arrived late

    await sendUdpPacket(boundPort, pkt1);
    await waitMs(20);
    await sendUdpPacket(boundPort, pkt2);
    await waitMs(50);

    const stats = server.getStats();
    expect(stats.packetsReceived).toBe(2);
    expect(stats.sequenceGaps).toBe(1);
  });

  it("processes multiple fixtures in one packet", async () => {
    const packet = makePacket({
      fixtures: [
        { index: 0, r: 100, g: 50, b: 25, brightness: 255 },
        { index: 1, r: 200, g: 150, b: 75, brightness: 255 },
      ],
    });
    await sendUdpPacket(boundPort, encodeColorPacket(packet));
    await waitMs(50);

    const stats = server.getStats();
    expect(stats.packetsProcessed).toBe(1);
    // Should have updated both fixtures
    expect(universe.updateCalls.length).toBe(1);
    expect(universe.updateCalls[0][1]).toBe(100);   // Fixture1 Red
    expect(universe.updateCalls[0][10]).toBe(200);  // Fixture2 Red
  });

  it("drops color packets during active blackout", async () => {
    // Send a color packet first to confirm it works
    const pkt1 = makePacket({ sequence: 1, fixtures: [{ index: 0, r: 255, g: 128, b: 64, brightness: 255 }] });
    await sendUdpPacket(boundPort, encodeColorPacket(pkt1));
    await waitMs(50);
    expect(universe.updateCalls.length).toBeGreaterThan(0);

    // Trigger blackout via FLAG_BLACKOUT packet
    const blackoutPkt = makePacket({ sequence: 2, flags: FLAG_BLACKOUT, fixtures: [] });
    await sendUdpPacket(boundPort, encodeColorPacket(blackoutPkt));
    await waitMs(50);
    expect(universe.updateAllCalls).toContain(0);

    // Clear recorded calls to isolate the next check
    const updateCountBefore = universe.updateCalls.length;

    // Send another color packet — should be dropped
    const pkt2 = makePacket({ sequence: 3, fixtures: [{ index: 0, r: 100, g: 50, b: 25, brightness: 255 }] });
    await sendUdpPacket(boundPort, encodeColorPacket(pkt2));
    await waitMs(50);

    // No new universe.update calls — color data was dropped
    expect(universe.updateCalls.length).toBe(updateCountBefore);

    const stats = server.getStats();
    expect(stats.packetsProcessed).toBe(3); // pkt1 + blackout + pkt2 (dropped but counted)
  });

  it("close is idempotent", async () => {
    await server.close();
    await server.close(); // should not throw
  });
});

describe("UdpColorServer source filter (DMX-C1)", () => {
  let store: FixtureStore;
  let universe: ReturnType<typeof createMockUniverse>;
  let filteredServer: UdpColorServer;

  afterEach(async () => {
    await filteredServer?.close();
  });

  it("drops packets from disallowed source IPs", async () => {
    universe = createMockUniverse();
    const manager = createUniverseManager(universe);
    store = createTestFixtureStore();
    addRgbFixture(store, "Fixture1", 1);

    // Create server with allow list that excludes 127.0.0.1 (localhost)
    filteredServer = createUdpColorServer({
      fixtureStore: store,
      manager,
      allowedSources: ["10.0.0.0/8"], // only 10.x.x.x allowed
    });
    const port = await filteredServer.start(0);

    // Send a valid color packet from localhost (127.0.0.1)
    const packet = makePacket({
      fixtures: [{ index: 0, r: 255, g: 128, b: 64, brightness: 255 }],
    });
    await sendUdpPacket(port, encodeColorPacket(packet));
    await waitMs(50);

    // Packet should be dropped — not processed, not counted as processed
    const stats = filteredServer.getStats();
    expect(stats.packetsReceived).toBe(1);
    expect(stats.packetsProcessed).toBe(0);
    expect(universe.updateCalls.length).toBe(0);
  });

  it("accepts packets from allowed source IPs (default RFC1918 + loopback)", async () => {
    universe = createMockUniverse();
    const manager = createUniverseManager(universe);
    store = createTestFixtureStore();
    addRgbFixture(store, "Fixture1", 1);

    // Default allow list includes 127.0.0.0/8
    filteredServer = createUdpColorServer({
      fixtureStore: store,
      manager,
      allowedSources: ["127.0.0.0/8", "192.168.0.0/16"],
    });
    const port = await filteredServer.start(0);

    const packet = makePacket({
      fixtures: [{ index: 0, r: 255, g: 128, b: 64, brightness: 255 }],
    });
    await sendUdpPacket(port, encodeColorPacket(packet));
    await waitMs(50);

    expect(filteredServer.getStats().packetsProcessed).toBe(1);
    expect(universe.updateCalls.length).toBeGreaterThan(0);
  });
});
