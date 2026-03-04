import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance, type FastifyError } from "fastify";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import type { ServerConfig } from "./config/server-config.js";
import type { UniverseManager } from "./dmx/universe-manager.js";
import type { FixtureStore } from "./fixtures/fixture-store.js";
import type { OflClient } from "./ofl/ofl-client.js";
import type { LibraryRegistry } from "./libraries/types.js";
import type { ConnectionStatus } from "./dmx/connection-state.js";
import type { SettingsStore } from "./config/settings-store.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerUpdateRoute } from "./routes/update.js";
import { registerFixtureRoutes } from "./routes/fixtures.js";
import { registerOflRoutes } from "./routes/ofl.js";
import { registerControlRoutes } from "./routes/control.js";
import { registerLibraryRoutes } from "./routes/libraries.js";
import { registerSignalRgbRoutes } from "./routes/signalrgb.js";
import { registerSearchRoutes } from "./routes/search.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerMetricsRoute } from "./routes/metrics.js";
import { registerApiKeyAuth } from "./middleware/api-key-auth.js";
import type { LatencyTracker } from "./metrics/latency-tracker.js";
import type { MdnsAdvertiser } from "./mdns/advertiser.js";
import type { UdpColorServer } from "./udp/udp-color-server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface BuildServerDeps {
  readonly config: ServerConfig;
  readonly manager: UniverseManager;
  readonly driver: string;
  readonly startTime: number;
  readonly fixtureStore: FixtureStore;
  readonly oflClient: OflClient;
  readonly registry: LibraryRegistry;
  readonly getConnectionStatus?: () => ConnectionStatus;
  readonly settingsStore?: SettingsStore;
  readonly serverVersion?: string;
  readonly latencyTracker?: LatencyTracker;
  readonly udpServer?: UdpColorServer;
  readonly serverId?: string;
  readonly serverName?: string;
  readonly getMdnsAdvertiser?: () => MdnsAdvertiser | undefined;
}

export async function buildServer(
  deps: BuildServerDeps,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: deps.config.logLevel,
    },
  });

  await app.register(rateLimit, {
    max: 600,
    timeWindow: "1 minute",
  });

  const corsOrigins = deps.config.corsOrigin
    ? deps.config.corsOrigin.split(",").map((o) => o.trim())
    : [
        /^https?:\/\/localhost(:\d+)?$/,
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
        /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
        /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
        /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
      ];

  await app.register(cors, {
    origin: corsOrigins,
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        mediaSrc: ["'self'", "data:"],
        upgradeInsecureRequests: null,
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  if (deps.config.apiKey) {
    registerApiKeyAuth(app, deps.config.apiKey);
  }

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
    serverVersion: deps.serverVersion,
    dmxDevicePath: deps.config.dmxDevicePath,
    latencyTracker: deps.latencyTracker,
    udpServer: deps.udpServer,
    serverId: deps.serverId,
    serverName: deps.serverName,
  });

  registerUpdateRoute(app, {
    manager: deps.manager,
    fixtureStore: deps.fixtureStore,
  });

  registerFixtureRoutes(app, {
    store: deps.fixtureStore,
    manager: deps.manager,
  });

  registerOflRoutes(app, {
    oflClient: deps.oflClient,
  });

  registerControlRoutes(app, {
    manager: deps.manager,
    store: deps.fixtureStore,
  });

  registerLibraryRoutes(app, {
    registry: deps.registry,
    store: deps.fixtureStore,
  });

  registerSignalRgbRoutes(app, {
    store: deps.fixtureStore,
  });

  registerSearchRoutes(app, {
    oflClient: deps.oflClient,
    registry: deps.registry,
  });

  if (deps.settingsStore) {
    registerSettingsRoutes(app, {
      settingsStore: deps.settingsStore,
      serverVersion: deps.serverVersion ?? "0.0.0",
      getMdnsAdvertiser: deps.getMdnsAdvertiser,
    });
  }

  if (deps.latencyTracker) {
    registerMetricsRoute(app, {
      latencyTracker: deps.latencyTracker,
      udpServer: deps.udpServer,
    });
  }

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, "Unhandled error");
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      return reply.status(statusCode).send({ error: "Internal server error" });
    }
    return reply
      .status(statusCode)
      .send({ error: error.message || "Request error" });
  });

  return app;
}
