import { loadConfig } from "./config/server-config.js";
import { createDmxConnection } from "./dmx/driver-factory.js";
import { createUniverseManager } from "./dmx/universe-manager.js";
import { createFixtureStore } from "./fixtures/fixture-store.js";
import { createOflClient } from "./ofl/ofl-client.js";
import { buildServer } from "./server.js";

async function main() {
  const config = loadConfig();
  const startTime = Date.now();

  const connection = await createDmxConnection(config);
  const manager = createUniverseManager(connection.universe);

  const fixtureStore = createFixtureStore(config.fixturesPath);
  await fixtureStore.load();

  const oflClient = createOflClient();

  const app = await buildServer({
    config,
    manager,
    driver: connection.driver,
    startTime,
    fixtureStore,
    oflClient,
  });

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    manager.blackout();
    await app.close();
    await connection.close();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await app.listen({ port: config.port, host: config.host });
  app.log.info(`DMXr server running on ${config.host}:${config.port}`);
  app.log.info(`DMX driver: ${connection.driver}`);
  app.log.info(`Fixtures loaded: ${fixtureStore.getAll().length}`);
}

main().catch((err) => {
  process.stderr.write(`Failed to start DMXr server: ${err}\n`);
  process.exit(1);
});
