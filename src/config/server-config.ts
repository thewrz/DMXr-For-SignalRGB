import { findSoundswitchDb } from "../soundswitch/ss-db-finder.js";

export interface ServerConfig {
  readonly port: number;
  readonly host: string;
  readonly dmxDriver: string;
  readonly dmxDevicePath: string;
  readonly logLevel: string;
  readonly fixturesPath: string;
  readonly mdnsEnabled: boolean;
  readonly portRangeSize: number;
  readonly localDbPath?: string;
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

  const rawPortRangeSize = parseInt(
    process.env["PORT_RANGE_SIZE"] ?? "10",
    10,
  );

  if (
    !Number.isFinite(rawPortRangeSize) ||
    rawPortRangeSize < 1 ||
    rawPortRangeSize > 100
  ) {
    throw new Error(
      `Invalid PORT_RANGE_SIZE: "${process.env["PORT_RANGE_SIZE"]}". Must be a number between 1 and 100.`,
    );
  }

  return {
    port: rawPort,
    host: process.env["HOST"] ?? "127.0.0.1",
    dmxDriver,
    dmxDevicePath: process.env["DMX_DEVICE_PATH"] ?? "/dev/ttyUSB0",
    logLevel: process.env["LOG_LEVEL"] ?? "info",
    fixturesPath: process.env["FIXTURES_PATH"] ?? "./config/fixtures.json",
    mdnsEnabled: process.env["MDNS_ENABLED"] !== "false",
    portRangeSize: rawPortRangeSize,
    localDbPath: resolveLocalDbPath(),
  };
}

function resolveLocalDbPath(): string | undefined {
  const envPath = process.env["FIXTURE_DB_PATH"];
  if (envPath) return envPath;

  const { path } = findSoundswitchDb();
  return path ?? undefined;
}
