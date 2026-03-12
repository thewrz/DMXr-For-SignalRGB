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
  readonly movementInterval?: ReturnType<typeof setInterval>;
  readonly timerMaps?: ReadonlyArray<Map<string, NodeJS.Timeout>>;
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
    if (deps.movementInterval) {
      clearInterval(deps.movementInterval);
    }
    if (deps.timerMaps) {
      for (const map of deps.timerMaps) {
        for (const [, timer] of map) {
          clearTimeout(timer);
        }
        map.clear();
      }
    }
    try { deps.getMdnsAdvertiser()?.unpublishAll(); } catch (e) {
      deps.app.log.info(`mDNS unpublish failed: ${e}`);
    }
    for (const provider of deps.registry.getAll()) {
      try { provider.close?.(); } catch (e) {
        deps.app.log.info(`Provider close failed: ${e}`);
      }
    }
    try { deps.dmxMonitor.close(); } catch (e) {
      deps.app.log.info(`DMX monitor close failed: ${e}`);
    }
    // Blackout is critical — must always run even if above steps fail
    deps.coordinator.blackoutAll();
    deps.manager.blackout();
    try { await deps.udpServer.close(); } catch (e) {
      deps.app.log.info(`UDP server close failed: ${e}`);
    }
    try { await deps.app.close(); } catch (e) {
      deps.app.log.info(`Fastify close failed: ${e}`);
    }
    try { await deps.connectionPool.closeAll(); } catch (e) {
      deps.app.log.info(`Connection pool close failed: ${e}`);
    }
    try { await deps.connection.close(); } catch (e) {
      deps.app.log.info(`Connection close failed: ${e}`);
    }
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
