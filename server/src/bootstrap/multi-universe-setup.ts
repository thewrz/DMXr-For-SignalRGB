import type { ServerConfig } from "../config/server-config.js";
import type { DmxLogger } from "../dmx/universe-manager.js";
import type { LatencyTracker } from "../metrics/latency-tracker.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import { createResilientConnection } from "../dmx/resilient-connection.js";
import { createUniverseRegistry, type UniverseRegistry } from "../dmx/universe-registry.js";
import { createConnectionPool, type ConnectionPool } from "../dmx/connection-pool.js";
import { createMultiUniverseCoordinator, type MultiUniverseCoordinator } from "../dmx/multi-universe-coordinator.js";
import { shortId } from "../utils/format.js";
import { pipeLog } from "../logging/pipeline-logger.js";

export interface MultiUniverseStack {
  readonly registry: UniverseRegistry;
  readonly pool: ConnectionPool;
  readonly coordinator: MultiUniverseCoordinator;
}

export async function createMultiUniverseStack(
  config: ServerConfig,
  logger: DmxLogger,
  latencyTracker: LatencyTracker,
): Promise<MultiUniverseStack> {
  const registry = createUniverseRegistry("./config/universes.json");
  await registry.load();

  const pool = createConnectionPool({
    createConnection: async (uniConfig) => {
      const uniServerConfig = {
        ...config,
        dmxDriver: uniConfig.driverType,
        dmxDevicePath: uniConfig.devicePath,
      };
      return createResilientConnection({
        config: uniServerConfig,
        logger,
        getChannelSnapshot: () =>
          pool.getManager(uniConfig.id)?.getFullSnapshot() ?? {},
      });
    },
    createManager: (universe) =>
      createUniverseManager(universe, {
        logger,
        onDmxError: (err) => logger.error(`Send error: ${err}`),
        onDmxSendTiming: (ms) => latencyTracker.recordDmxSend(ms),
      }),
  });

  const coordinator = createMultiUniverseCoordinator(() => pool.getAllManagers());
  pipeLog("info", `Universe registry loaded: ${registry.getAll().length} universe(s)`);

  // Bootstrap connections for all persisted universes
  for (const uniConfig of registry.getAll()) {
    try {
      await pool.create(uniConfig);
      pipeLog("info", `Universe "${uniConfig.name}" (${shortId(uniConfig.id)}) connected`);
    } catch (err) {
      logger.warn(`Failed to initialize universe "${uniConfig.name}": ${err}`);
    }
  }

  return { registry, pool, coordinator };
}
