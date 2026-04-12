import { findSoundswitchDb } from "../soundswitch/ss-db-finder.js";
import type { PersistedSettings } from "./settings-store.js";

export interface ServerConfig {
  readonly port: number;
  readonly udpPort: number;
  readonly host: string;
  readonly dmxDriver: string;
  readonly dmxDevicePath: string;
  readonly logLevel: string;
  readonly logFormat: "pretty" | "json";
  readonly fixturesPath: string;
  readonly mdnsEnabled: boolean;
  readonly portRangeSize: number;
  readonly localDbPath?: string;
  readonly userFixturesPath: string;
  readonly corsOrigin?: string;
  readonly apiKey?: string;
  readonly driverOptions?: {
    readonly universe?: number;
    readonly port?: number;
    readonly sourceName?: string;
    readonly priority?: number;
  };
}

export const VALID_DRIVERS = [
  "null",
  "enttec-usb-dmx-pro",
  "enttec-open-usb-dmx",
  "artnet",
  "sacn",
] as const;

export function loadConfig(
  persisted?: Partial<PersistedSettings>,
): ServerConfig {
  const base = persisted ?? {};

  const rawPort = parseInt(
    process.env["PORT"] ?? String(base.port ?? 8080),
    10,
  );

  if (!Number.isFinite(rawPort) || rawPort < 1 || rawPort > 65535) {
    throw new Error(
      `Invalid PORT: "${process.env["PORT"] ?? base.port}". Must be a number between 1 and 65535.`,
    );
  }

  const dmxDriver =
    process.env["DMX_DRIVER"] ?? base.dmxDriver ?? "null";

  if (!(VALID_DRIVERS as readonly string[]).includes(dmxDriver)) {
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

  const rawUdpPort = parseInt(
    process.env["UDP_PORT"] ?? String(base.udpPort ?? 0),
    10,
  );

  return {
    port: rawPort,
    udpPort: Number.isFinite(rawUdpPort) && rawUdpPort >= 0 ? rawUdpPort : 0,
    // DMX-C1: default to loopback. Use HOST=0.0.0.0 or settings.host to
    // bind to all interfaces (requires API_KEY or explicit INSECURE_NO_AUTH=1).
    host: process.env["HOST"] ?? base.host ?? "127.0.0.1",
    dmxDriver,
    dmxDevicePath:
      process.env["DMX_DEVICE_PATH"] ?? base.dmxDevicePath ?? "auto",
    logLevel: process.env["LOG_LEVEL"] ?? "info",
    logFormat: process.env["LOG_FORMAT"] === "json" ? "json" : "pretty",
    fixturesPath: process.env["FIXTURES_PATH"] ?? "./config/fixtures.json",
    userFixturesPath: process.env["USER_FIXTURES_PATH"] ?? "./config/user-fixtures.json",
    mdnsEnabled:
      process.env["MDNS_ENABLED"] !== undefined
        ? process.env["MDNS_ENABLED"] !== "false"
        : (base.mdnsEnabled ?? true),
    portRangeSize: rawPortRangeSize,
    localDbPath: resolveLocalDbPath(),
    corsOrigin: process.env["CORS_ORIGIN"] || undefined,
    apiKey: process.env["API_KEY"] || undefined,
    driverOptions: base.driverOptions,
  };
}

function resolveLocalDbPath(): string | undefined {
  const envPath = process.env["FIXTURE_DB_PATH"];
  if (envPath) return envPath;

  const { path } = findSoundswitchDb();
  return path ?? undefined;
}
