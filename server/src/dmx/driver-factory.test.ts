import { describe, it, expect } from "vitest";
import { createDmxConnection } from "./driver-factory.js";
import type { ServerConfig } from "../config/server-config.js";

const baseConfig: ServerConfig = {
  port: 8080,
  udpPort: 0,
  host: "0.0.0.0",
  dmxDriver: "null",
  dmxDevicePath: "auto",
  logLevel: "info",
  logFormat: "pretty",
  fixturesPath: "./config/fixtures.json",
  mdnsEnabled: false,
  portRangeSize: 10,
  userFixturesPath: "./config/user-fixtures.json",
};

describe("createDmxConnection", () => {
  it("creates a null driver connection", async () => {
    const conn = await createDmxConnection(baseConfig);

    expect(conn.driver).toBe("null");
    expect(conn.universe).toBeDefined();
    expect(conn.close).toBeDefined();
    expect(conn.onDisconnect).toBeUndefined();

    await conn.close();
  });

  it("throws on unknown driver", async () => {
    await expect(
      createDmxConnection({ ...baseConfig, dmxDriver: "fake-driver" }),
    ).rejects.toThrow('Unknown DMX driver: "fake-driver"');
  });

  it("returns artnet driver string for artnet config", async () => {
    const conn = await createDmxConnection({
      ...baseConfig,
      dmxDriver: "artnet",
      dmxDevicePath: "127.0.0.1",
      driverOptions: { universe: 0, port: 0 },
    });

    expect(conn.driver).toBe("artnet");
    expect(conn.onDisconnect).toBeUndefined();

    await conn.close();
  });

  it("returns sacn driver string for sacn config", async () => {
    const conn = await createDmxConnection({
      ...baseConfig,
      dmxDriver: "sacn",
      driverOptions: { universe: 1, sourceName: "Test", priority: 100 },
    });

    expect(conn.driver).toBe("sacn");
    expect(conn.onDisconnect).toBeUndefined();

    await conn.close();
  });

  it("artnet defaults to broadcast address when devicePath is empty", async () => {
    const conn = await createDmxConnection({
      ...baseConfig,
      dmxDriver: "artnet",
      dmxDevicePath: "",
    });

    expect(conn.driver).toBe("artnet");

    await conn.close();
  });

  it("sacn defaults universe to 1 when no driverOptions", async () => {
    const conn = await createDmxConnection({
      ...baseConfig,
      dmxDriver: "sacn",
    });

    expect(conn.driver).toBe("sacn");

    await conn.close();
  });
});
