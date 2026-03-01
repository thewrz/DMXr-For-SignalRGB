import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import type { ServerConfig } from "./config/server-config.js";
import type { UniverseManager } from "./dmx/universe-manager.js";
import type { FixtureStore } from "./fixtures/fixture-store.js";
import type { OflClient } from "./ofl/ofl-client.js";
import type { SsClient, SsStatus } from "./soundswitch/ss-client.js";
import type { ConnectionStatus } from "./dmx/connection-state.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerUpdateRoute } from "./routes/update.js";
import { registerFixtureRoutes } from "./routes/fixtures.js";
import { registerOflRoutes } from "./routes/ofl.js";
import { registerControlRoutes } from "./routes/control.js";
import { registerSoundswitchRoutes } from "./routes/soundswitch.js";
import { registerSignalRgbRoutes } from "./routes/signalrgb.js";
import { registerSearchRoutes } from "./routes/search.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface BuildServerDeps {
  readonly config: ServerConfig;
  readonly manager: UniverseManager;
  readonly driver: string;
  readonly startTime: number;
  readonly fixtureStore: FixtureStore;
  readonly oflClient: OflClient;
  readonly ssClient?: SsClient | null;
  readonly ssStatus?: SsStatus;
  readonly getConnectionStatus?: () => ConnectionStatus;
}

export async function buildServer(
  deps: BuildServerDeps,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: deps.config.logLevel,
    },
  });

  await app.register(fastifyStatic, {
    root: join(__dirname, "..", "public"),
    prefix: "/",
    decorateReply: false,
  });

  registerHealthRoute(app, {
    manager: deps.manager,
    driver: deps.driver,
    startTime: deps.startTime,
    fixtureStore: deps.fixtureStore,
    getConnectionStatus: deps.getConnectionStatus,
  });

  registerUpdateRoute(app, {
    manager: deps.manager,
    fixtureStore: deps.fixtureStore,
  });

  registerFixtureRoutes(app, {
    store: deps.fixtureStore,
  });

  registerOflRoutes(app, {
    oflClient: deps.oflClient,
  });

  registerControlRoutes(app, {
    manager: deps.manager,
    store: deps.fixtureStore,
  });

  registerSoundswitchRoutes(app, {
    ssClient: deps.ssClient ?? null,
    ssStatus: deps.ssStatus ?? { available: false, state: "not_configured" },
    store: deps.fixtureStore,
  });

  registerSignalRgbRoutes(app, {
    store: deps.fixtureStore,
  });

  registerSearchRoutes(app, {
    oflClient: deps.oflClient,
    ssClient: deps.ssClient ?? null,
  });

  return app;
}
