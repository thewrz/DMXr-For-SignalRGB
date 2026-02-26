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

    const config = loadConfig();

    expect(config.port).toBe(8080);
    expect(config.host).toBe("127.0.0.1");
    expect(config.dmxDriver).toBe("null");
    expect(config.dmxDevicePath).toBe("/dev/ttyUSB0");
    expect(config.logLevel).toBe("info");
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
});
