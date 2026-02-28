import { loadConfig } from "./config/server-config.js";
import { createDmxConnection } from "./dmx/driver-factory.js";
import { createUniverseManager } from "./dmx/universe-manager.js";
import { createFixtureStore } from "./fixtures/fixture-store.js";
import {
  createMdnsAdvertiser,
  type MdnsAdvertiser,
} from "./mdns/advertiser.js";
import { createOflClient } from "./ofl/ofl-client.js";
import { createSsClientIfConfigured } from "./soundswitch/ss-client.js";
import { buildServer } from "./server.js";

async function main() {
  const config = loadConfig();
  const startTime = Date.now();

  const connection = await createDmxConnection(config);

  const consoleLogger = {
    info: (msg: string) => process.stdout.write(`[DMX] ${msg}\n`),
    warn: (msg: string) => process.stderr.write(`[DMX] WARN: ${msg}\n`),
    error: (msg: string) => process.stderr.write(`[DMX] ERROR: ${msg}\n`),
  };

  const manager = createUniverseManager(connection.universe, {
    logger: consoleLogger,
    onDmxError: (err) => process.stderr.write(`[DMX] Send error: ${err}\n`),
  });

  const fixtureStore = createFixtureStore(config.fixturesPath);
  await fixtureStore.load();

  manager.blackout();

  const oflClient = createOflClient();
  const { client: ssClient, status: ssStatus } = createSsClientIfConfigured(config.soundswitchDbPath);

  const app = await buildServer({
    config,
    manager,
    driver: connection.driver,
    startTime,
    fixtureStore,
    oflClient,
    ssClient,
    ssStatus,
  });

  let mdnsAdvertiser: MdnsAdvertiser | undefined;
  let exitBlackoutDone = false;

  // Last-resort synchronous blackout for unexpected exits
  process.on("exit", () => {
    if (!exitBlackoutDone) {
      exitBlackoutDone = true;
      manager.blackout();
    }
  });

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    exitBlackoutDone = true;
    mdnsAdvertiser?.unpublishAll();
    ssClient?.close();
    manager.blackout();
    await app.close();
    await connection.close();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGHUP", () => shutdown("SIGHUP"));

  const boundPort = await listenWithRetry(app, config);

  if (config.mdnsEnabled) {
    mdnsAdvertiser = createMdnsAdvertiser(boundPort);
    app.log.info(`mDNS: advertising _dmxr._tcp on port ${boundPort}`);
  }

  app.log.info(`DMXr server running on ${config.host}:${boundPort}`);
  app.log.info(`DMX driver: ${connection.driver}`);
  app.log.info(`Fixtures loaded: ${fixtureStore.getAll().length}`);
  if (ssStatus.available) {
    app.log.info(`SoundSwitch DB: ${ssStatus.path} (${ssStatus.fixtureCount} fixtures)`);
  } else {
    app.log.info(`SoundSwitch: ${ssStatus.state}${ssStatus.error ? ` — ${ssStatus.error}` : ""}`);
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
