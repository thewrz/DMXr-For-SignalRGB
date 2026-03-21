import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "./server-config.js";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns defaults when no env vars set", () => {
    delete process.env["PORT"];
    delete process.env["HOST"];
    delete process.env["DMX_DRIVER"];
    delete process.env["DMX_DEVICE_PATH"];
    delete process.env["LOG_LEVEL"];
    delete process.env["MDNS_ENABLED"];

    const config = loadConfig();

    expect(config.port).toBe(8080);
    expect(config.host).toBe("0.0.0.0");
    expect(config.dmxDriver).toBe("null");
    expect(config.dmxDevicePath).toBe("auto");
    expect(config.logLevel).toBe("info");
    expect(config.mdnsEnabled).toBe(true);
    expect(config.portRangeSize).toBe(10);
  });

  it("uses persisted settings as base layer", () => {
    delete process.env["PORT"];
    delete process.env["HOST"];
    delete process.env["DMX_DRIVER"];
    delete process.env["DMX_DEVICE_PATH"];
    delete process.env["MDNS_ENABLED"];

    const config = loadConfig({
      port: 9090,
      host: "192.168.1.50",
      dmxDriver: "enttec-usb-dmx-pro",
      dmxDevicePath: "COM3",
      mdnsEnabled: false,
    });

    expect(config.port).toBe(9090);
    expect(config.host).toBe("192.168.1.50");
    expect(config.dmxDriver).toBe("enttec-usb-dmx-pro");
    expect(config.dmxDevicePath).toBe("COM3");
    expect(config.mdnsEnabled).toBe(false);
  });

  it("env vars override persisted settings", () => {
    process.env["PORT"] = "3000";
    process.env["DMX_DRIVER"] = "null";

    const config = loadConfig({
      port: 9090,
      dmxDriver: "enttec-usb-dmx-pro",
    });

    expect(config.port).toBe(3000);
    expect(config.dmxDriver).toBe("null");
  });

  it("reads MDNS_ENABLED from environment", () => {
    process.env["MDNS_ENABLED"] = "false";

    const config = loadConfig();

    expect(config.mdnsEnabled).toBe(false);
  });

  it("reads PORT_RANGE_SIZE from environment", () => {
    process.env["PORT_RANGE_SIZE"] = "5";

    const config = loadConfig();

    expect(config.portRangeSize).toBe(5);
  });

  it("throws on invalid PORT_RANGE_SIZE", () => {
    process.env["PORT_RANGE_SIZE"] = "0";

    expect(() => loadConfig()).toThrow("Invalid PORT_RANGE_SIZE");
  });

  it("reads PORT from environment", () => {
    process.env["PORT"] = "3000";

    const config = loadConfig();

    expect(config.port).toBe(3000);
  });

  it("reads HOST from environment", () => {
    process.env["HOST"] = "0.0.0.0";

    const config = loadConfig();

    expect(config.host).toBe("0.0.0.0");
  });

  it("reads DMX_DRIVER from environment", () => {
    process.env["DMX_DRIVER"] = "enttec-usb-dmx-pro";

    const config = loadConfig();

    expect(config.dmxDriver).toBe("enttec-usb-dmx-pro");
  });

  it("reads DMX_DEVICE_PATH from environment", () => {
    process.env["DMX_DEVICE_PATH"] = "COM3";

    const config = loadConfig();

    expect(config.dmxDevicePath).toBe("COM3");
  });

  it("reads LOG_LEVEL from environment", () => {
    process.env["LOG_LEVEL"] = "debug";

    const config = loadConfig();

    expect(config.logLevel).toBe("debug");
  });

  it("throws on non-numeric PORT", () => {
    process.env["PORT"] = "notanumber";

    expect(() => loadConfig()).toThrow("Invalid PORT");
  });

  it("throws on out-of-range PORT", () => {
    process.env["PORT"] = "99999";

    expect(() => loadConfig()).toThrow("Invalid PORT");
  });

  it("throws on invalid DMX_DRIVER", () => {
    process.env["DMX_DRIVER"] = "unknown-driver";

    expect(() => loadConfig()).toThrow("Invalid DMX_DRIVER");
  });

  it("accepts artnet as a valid driver", () => {
    process.env["DMX_DRIVER"] = "artnet";

    const config = loadConfig();

    expect(config.dmxDriver).toBe("artnet");
  });

  it("accepts sacn as a valid driver", () => {
    process.env["DMX_DRIVER"] = "sacn";

    const config = loadConfig();

    expect(config.dmxDriver).toBe("sacn");
  });

  it("includes driverOptions from persisted settings", () => {
    delete process.env["DMX_DRIVER"];

    const config = loadConfig({
      dmxDriver: "artnet",
      dmxDevicePath: "192.168.1.100",
      driverOptions: { universe: 2, port: 1 },
    });

    expect(config.driverOptions).toEqual({ universe: 2, port: 1 });
  });

  it("driverOptions is undefined when not provided", () => {
    delete process.env["DMX_DRIVER"];

    const config = loadConfig({ dmxDriver: "null" });

    expect(config.driverOptions).toBeUndefined();
  });
});
