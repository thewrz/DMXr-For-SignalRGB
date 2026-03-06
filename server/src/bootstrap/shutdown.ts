import type { FastifyInstance } from "fastify";
import type { UniverseManager } from "../dmx/universe-manager.js";
import type { MultiUniverseCoordinator } from "../dmx/multi-universe-coordinator.js";
import type { LibraryRegistry } from "../libraries/types.js";
import type { DmxMonitor } from "../dmx/dmx-monitor.js";
import type { UdpColorServer } from "../udp/udp-color-server.js";
import type { ConnectionPool } from "../dmx/connection-pool.js";
import type { ResilientConnection } from "../dmx/resilient-connection.js";
import type { MdnsAdvertiser } from "../mdns/advertiser.js";

export interface ShutdownDeps {
  readonly app: FastifyInstance;
  readonly manager: UniverseManager;
  readonly coordinator: MultiUniverseCoordinator;
  readonly registry: LibraryRegistry;
  readonly dmxMonitor: DmxMonitor;
  readonly udpServer: UdpColorServer;
  readonly connectionPool: ConnectionPool;
  readonly connection: ResilientConnection;
  readonly getMdnsAdvertiser: () => MdnsAdvertiser | undefined;
}

/**
 * Install process signal handlers and return a shutdown function.
 * Also installs a synchronous "exit" handler for last-resort blackout.
 */
export function installShutdownHandlers(deps: ShutdownDeps): (signal: string) => Promise<void> {
  let exitBlackoutDone = false;
  let shuttingDown = false;

  // Last-resort synchronous blackout for unexpected exits
  process.on("exit", () => {
    if (!exitBlackoutDone) {
      exitBlackoutDone = true;
      deps.coordinator.blackoutAll();
      deps.manager.blackout();
    }
  });

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    deps.app.log.info(`Received ${signal}, shutting down...`);
    exitBlackoutDone = true;
    deps.getMdnsAdvertiser()?.unpublishAll();
    for (const provider of deps.registry.getAll()) {
      provider.close?.();
    }
    deps.dmxMonitor.close();
    deps.coordinator.blackoutAll();
    deps.manager.blackout();
    await deps.udpServer.close();
    await deps.app.close();
    await deps.connectionPool.closeAll();
    await deps.connection.close();
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

  return (signal: string) => shutdown(signal);
}
