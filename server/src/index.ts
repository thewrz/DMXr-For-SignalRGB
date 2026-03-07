import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config/server-config.js";
import { createSettingsStore } from "./config/settings-store.js";
import { createRemapPresetStore } from "./config/remap-preset-store.js";
import { createFixtureStore } from "./fixtures/fixture-store.js";
import { createGroupStore } from "./fixtures/group-store.js";
import { createUserFixtureStore } from "./fixtures/user-fixture-store.js";
import { autoDetectDmxPort } from "./dmx/serial-port-scanner.js";
import { createMdnsAdvertiser, type MdnsAdvertiser } from "./mdns/advertiser.js";
import { createOflClient } from "./ofl/ofl-client.js";
import { createOflDiskCache } from "./ofl/ofl-disk-cache.js";
import { createCachedOflClient } from "./ofl/cached-ofl-client.js";
import { buildServer } from "./server.js";
import { createUdpColorServer } from "./udp/udp-color-server.js";
import { createDmxMonitor } from "./dmx/dmx-monitor.js";
import { shortId } from "./utils/format.js";
import { setPipelineLogLevel, parsePipelineLogLevel, pipeLog } from "./logging/pipeline-logger.js";
import { createDmxStack } from "./bootstrap/dmx-setup.js";
import { createMultiUniverseStack } from "./bootstrap/multi-universe-setup.js";
import { createLibraryStack } from "./bootstrap/library-setup.js";
import { initializeFixtureDefaults } from "./bootstrap/fixture-init.js";
import { installShutdownHandlers } from "./bootstrap/shutdown.js";

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
  const pipelineLevel = parsePipelineLogLevel(process.env["PIPELINE_LOG"]);
  setPipelineLogLevel(pipelineLevel);
  pipeLog("info", `Pipeline logging initialized at level: ${pipelineLevel}`);

  const serverVersion = await readServerVersion();
  const settingsStore = createSettingsStore("./config/settings.json");
  const persistedSettings = await settingsStore.load();
  const { serverId, serverName } = persistedSettings;
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

  const effectiveConfig = resolvedDevicePath !== config.dmxDevicePath
    ? { ...config, dmxDevicePath: resolvedDevicePath }
    : config;

  const finalConfig =
    effectiveConfig.dmxDevicePath === "auto" && effectiveConfig.dmxDriver !== "null"
      ? { ...effectiveConfig, dmxDriver: "null" }
      : effectiveConfig;

  const consoleLogger = {
    info: (msg: string) => process.stdout.write(`[DMX] ${msg}\n`),
    warn: (msg: string) => process.stderr.write(`[DMX] WARN: ${msg}\n`),
    error: (msg: string) => process.stderr.write(`[DMX] ERROR: ${msg}\n`),
  };

  // ── DMX Stack ──
  const { connection, manager, latencyTracker } = await createDmxStack(finalConfig, consoleLogger);

  // ── Remap Presets ──
  const remapPresetStore = createRemapPresetStore("./config/remap-presets.json");
  await remapPresetStore.load();

  // ── Fixture Stores ──
  const fixtureStore = createFixtureStore(finalConfig.fixturesPath);
  await fixtureStore.load();
  const userFixtureStore = createUserFixtureStore(finalConfig.userFixturesPath);
  await userFixtureStore.load();

  // ── Group Store ──
  const groupStore = createGroupStore("./config/groups.json");
  await groupStore.load();

  // ── Fixture Defaults ──
  initializeFixtureDefaults(fixtureStore, manager);

  // ── Multi-Universe Stack ──
  const { registry: universeRegistry, pool: connectionPool, coordinator } =
    await createMultiUniverseStack(finalConfig, consoleLogger, latencyTracker);

  // ── Library Stack ──
  const diskCache = createOflDiskCache();
  const oflClient = createCachedOflClient({
    inner: createOflClient(),
    diskCache,
  });
  const registry = createLibraryStack(finalConfig, oflClient, userFixtureStore);

  // ── UDP + Monitor ──
  const udpServer = createUdpColorServer({
    fixtureStore,
    manager,
    coordinator,
    latencyTracker,
    logger: consoleLogger,
  });
  const dmxMonitor = createDmxMonitor({ manager, coordinator });

  // ── HTTP Server ──
  const app = await buildServer({
    config: finalConfig,
    manager,
    driver: finalConfig.dmxDriver,
    startTime,
    fixtureStore,
    oflClient,
    registry,
    userFixtureStore,
    getConnectionStatus: () => connection.getStatus(),
    settingsStore,
    serverVersion,
    latencyTracker,
    udpServer,
    serverId,
    serverName,
    getMdnsAdvertiser: () => mdnsAdvertiser,
    dmxMonitor,
    coordinator,
    universeRegistry,
    connectionPool,
    remapPresetStore,
    groupStore,
    diskCache,
  });

  // ── Shutdown Handling ──
  let mdnsAdvertiser: MdnsAdvertiser | undefined;

  installShutdownHandlers({
    app,
    manager,
    coordinator,
    registry,
    dmxMonitor,
    udpServer,
    connectionPool,
    connection,
    getMdnsAdvertiser: () => mdnsAdvertiser,
  });

  // ── Start Listeners ──
  const boundPort = await listenWithRetry(app, finalConfig);
  const udpPortTarget = finalConfig.udpPort > 0 ? finalConfig.udpPort : boundPort + 1;
  const boundUdpPort = await udpServer.start(udpPortTarget, finalConfig.host);

  if (finalConfig.mdnsEnabled) {
    mdnsAdvertiser = createMdnsAdvertiser({
      port: boundPort,
      udpPort: boundUdpPort,
      serverId,
      serverName,
    });
  }

  // ── Startup Banner ──
  const devicePathLabel =
    finalConfig.dmxDevicePath === config.dmxDevicePath
      ? finalConfig.dmxDevicePath
      : `${finalConfig.dmxDevicePath} (auto-detected)`;

  const serverLabel = serverName || "DMXr-" + shortId(serverId);

  process.stdout.write(
    "\n" +
    "  ╔══════════════════════════════════════╗\n" +
    `  ║  DMXr Server v${serverVersion.padEnd(22)}║\n` +
    "  ╚══════════════════════════════════════╝\n" +
    "\n" +
    `  Server ID:   ${shortId(serverId)} (${serverLabel})\n` +
    `  HTTP Port:   ${boundPort}\n` +
    `  UDP Port:    ${boundUdpPort}\n` +
    `  DMX Driver:  ${finalConfig.dmxDriver}\n` +
    `  COM Port:    ${devicePathLabel}\n` +
    `  Web Manager: http://localhost:${boundPort}\n` +
    "\n",
  );

  if (finalConfig.mdnsEnabled) {
    app.log.info(`mDNS: advertising _dmxr._tcp on port ${boundPort} (UDP: ${boundUdpPort})`);
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
