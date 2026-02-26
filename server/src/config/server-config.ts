export interface ServerConfig {
  readonly port: number;
  readonly host: string;
  readonly dmxDriver: string;
  readonly dmxDevicePath: string;
  readonly logLevel: string;
  readonly fixturesPath: string;
}

const VALID_DRIVERS = ["null", "enttec-usb-dmx-pro"];

export function loadConfig(): ServerConfig {
  const rawPort = parseInt(process.env["PORT"] ?? "8080", 10);

  if (!Number.isFinite(rawPort) || rawPort < 1 || rawPort > 65535) {
    throw new Error(
      `Invalid PORT: "${process.env["PORT"]}". Must be a number between 1 and 65535.`,
    );
  }

  const dmxDriver = process.env["DMX_DRIVER"] ?? "null";

  if (!VALID_DRIVERS.includes(dmxDriver)) {
    throw new Error(
      `Invalid DMX_DRIVER: "${dmxDriver}". Must be one of: ${VALID_DRIVERS.join(", ")}`,
    );
  }

  return {
    port: rawPort,
    host: process.env["HOST"] ?? "127.0.0.1",
    dmxDriver,
    dmxDevicePath: process.env["DMX_DEVICE_PATH"] ?? "/dev/ttyUSB0",
    logLevel: process.env["LOG_LEVEL"] ?? "info",
    fixturesPath: process.env["FIXTURES_PATH"] ?? "./config/fixtures.json",
  };
}
