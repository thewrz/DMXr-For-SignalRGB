import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config/server-config.js";
import { createSettingsStore } from "./config/settings-store.js";
import { createUniverseManager } from "./dmx/universe-manager.js";
import { createResilientConnection } from "./dmx/resilient-connection.js";
import { createFixtureStore } from "./fixtures/fixture-store.js";
import { autoDetectDmxPort } from "./dmx/serial-port-scanner.js";
import {
  createMdnsAdvertiser,
  type MdnsAdvertiser,
} from "./mdns/advertiser.js";
import { createOflClient } from "./ofl/ofl-client.js";
import { createSsClientIfConfigured } from "./soundswitch/ss-client.js";
import { createLocalDbProvider } from "./libraries/local-db-provider.js";
import { createOflProvider } from "./libraries/ofl-provider.js";
import { createLibraryRegistry } from "./libraries/registry.js";
import { buildServer } from "./server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function readServerVersion(): Promise<string> {
  try {
    const pkgPath = join(__dirname, "..", "package.json");
    const raw = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function main() {
  const serverVersion = await readServerVersion();
  const settingsStore = createSettingsStore("./config/settings.json");
  const persistedSettings = await settingsStore.load();
  const config = loadConfig(persistedSettings);
  const startTime = Date.now();

  // Auto-detect DMX port if set to "auto"
  let resolvedDevicePath = config.dmxDevicePath;
  if (resolvedDevicePath === "auto" && config.dmxDriver !== "null") {
    const detected = await autoDetectDmxPort();
    if (detected) {
      resolvedDevicePath = detected;
    } else {
      process.stderr.write(
        "[DMXr] No DMX adapter detected. Falling back to null driver (test mode).\n" +
        "[DMXr] Open the Web Manager to configure your DMX adapter.\n",
      );
    }
  }

  // Build an effective config with the resolved device path
  const effectiveConfig = resolvedDevicePath !== config.dmxDevicePath
    ? { ...config, dmxDevicePath: resolvedDevicePath }
    : config;

  // Fall back to null driver if auto-detect failed
  const finalConfig =
    effectiveConfig.dmxDevicePath === "auto" && effectiveConfig.dmxDriver !== "null"
      ? { ...effectiveConfig, dmxDriver: "null" }
      : effectiveConfig;

  const consoleLogger = {
    info: (msg: string) => process.stdout.write(`[DMX] ${msg}\n`),
    warn: (msg: string) => process.stderr.write(`[DMX] WARN: ${msg}\n`),
    error: (msg: string) => process.stderr.write(`[DMX] ERROR: ${msg}\n`),
  };

  // Late-binding: manager reference filled after creation
  let managerRef: ReturnType<typeof createUniverseManager> | null = null;

  const connection = await createResilientConnection({
    config: finalConfig,
    logger: consoleLogger,
    getChannelSnapshot: () => managerRef?.getFullSnapshot() ?? {},
    onStateChange: (status) => {
      consoleLogger.info(
        `Connection state: ${status.state}` +
        (status.reconnectAttempts > 0 ? ` (attempt ${status.reconnectAttempts})` : "") +
        (status.lastError ? ` — ${status.lastError}` : ""),
      );
    },
  });

  const manager = createUniverseManager(connection.universe, {
    logger: consoleLogger,
    onDmxError: (err) => process.stderr.write(`[DMX] Send error: ${err}\n`),
  });
  managerRef = manager;

  const fixtureStore = createFixtureStore(finalConfig.fixturesPath);
  await fixtureStore.load();

  manager.blackout();

  const oflClient = createOflClient();
  const { client: ssClient, status: ssStatus } = createSsClientIfConfigured(finalConfig.localDbPath);

  const oflProvider = createOflProvider(oflClient);
  const localDbProvider = createLocalDbProvider(ssClient, ssStatus);
  const registry = createLibraryRegistry([oflProvider, localDbProvider]);

  const app = await buildServer({
    config: finalConfig,
    manager,
    driver: finalConfig.dmxDriver,
    startTime,
    fixtureStore,
    oflClient,
    registry,
    getConnectionStatus: () => connection.getStatus(),
    settingsStore,
    serverVersion,
  });

  let mdnsAdvertiser: MdnsAdvertiser | undefined;
  let exitBlackoutDone = false;
  let shuttingDown = false;

  // Last-resort synchronous blackout for unexpected exits
  process.on("exit", () => {
    if (!exitBlackoutDone) {
      exitBlackoutDone = true;
      manager.blackout();
    }
  });

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    app.log.info(`Received ${signal}, shutting down...`);
    exitBlackoutDone = true;
    mdnsAdvertiser?.unpublishAll();
    for (const provider of registry.getAll()) {
      provider.close?.();
    }
    manager.blackout();
    await app.close();
    await connection.close();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGHUP", () => shutdown("SIGHUP"));

  process.on("uncaughtException", (err) => {
    process.stderr.write(`[DMXr] FATAL uncaughtException: ${err?.stack ?? err}\n`);
    shutdown("uncaughtException").catch(() => process.exit(1));
  });

  process.on("unhandledRejection", (reason) => {
    process.stderr.write(`[DMXr] FATAL unhandledRejection: ${reason}\n`);
    shutdown("unhandledRejection").catch(() => process.exit(1));
  });

  const boundPort = await listenWithRetry(app, finalConfig);

  if (finalConfig.mdnsEnabled) {
    mdnsAdvertiser = createMdnsAdvertiser(boundPort);
  }

  // Startup banner
  const devicePathLabel =
    finalConfig.dmxDevicePath === config.dmxDevicePath
      ? finalConfig.dmxDevicePath
      : `${finalConfig.dmxDevicePath} (auto-detected)`;

  process.stdout.write(
    "\n" +
    "  ╔══════════════════════════════════════╗\n" +
    `  ║  DMXr Server v${serverVersion.padEnd(22)}║\n` +
    "  ╚══════════════════════════════════════╝\n" +
    "\n" +
    `  Port:        ${boundPort}\n` +
    `  DMX Driver:  ${finalConfig.dmxDriver}\n` +
    `  COM Port:    ${devicePathLabel}\n` +
    `  Web Manager: http://localhost:${boundPort}\n` +
    "\n",
  );

  if (finalConfig.mdnsEnabled) {
    app.log.info(`mDNS: advertising _dmxr._tcp on port ${boundPort}`);
  }
  app.log.info(`Fixtures loaded: ${fixtureStore.getAll().length}`);
  for (const provider of registry.getAll()) {
    const s = provider.status();
    if (s.available) {
      app.log.info(`Library "${provider.displayName}": available${s.fixtureCount ? ` (${s.fixtureCount} fixtures)` : ""}`);
    } else {
      app.log.info(`Library "${provider.displayName}": ${s.state}${s.error ? ` — ${s.error}` : ""}`);
    }
  }
}

async function listenWithRetry(
  app: { listen: (opts: { port: number; host: string }) => Promise<string> },
  config: { port: number; host: string; portRangeSize: number },
): Promise<number> {
  const maxPort = config.port + config.portRangeSize;

  for (let port = config.port; port < maxPort; port++) {
    try {
      await app.listen({ port, host: config.host });
      return port;
    } catch (err: unknown) {
      const isAddressInUse =
        err instanceof Error && "code" in err && err.code === "EADDRINUSE";

      if (!isAddressInUse || port === maxPort - 1) {
        throw err;
      }
    }
  }

  throw new Error(
    `All ports in range ${config.port}-${maxPort - 1} are in use`,
  );
}

main().catch((err) => {
  process.stderr.write(`Failed to start DMXr server: ${err}\n`);
  process.exit(1);
});
