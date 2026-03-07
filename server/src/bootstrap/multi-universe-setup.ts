import type { ServerConfig } from "../config/server-config.js";
import type { DmxLogger, UniverseManager } from "../dmx/universe-manager.js";
import type { LatencyTracker } from "../metrics/latency-tracker.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import { createResilientConnection } from "../dmx/resilient-connection.js";
import { createUniverseRegistry, type UniverseRegistry } from "../dmx/universe-registry.js";
import { createConnectionPool, type ConnectionPool } from "../dmx/connection-pool.js";
import { createMultiUniverseCoordinator, type MultiUniverseCoordinator } from "../dmx/multi-universe-coordinator.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";
import { shortId } from "../utils/format.js";
import { pipeLog } from "../logging/pipeline-logger.js";
import { createConnectionLog, mapStatusToEvent, type ConnectionLog } from "../dmx/connection-log.js";

export interface MultiUniverseStack {
  readonly registry: UniverseRegistry;
  readonly pool: ConnectionPool;
  readonly coordinator: MultiUniverseCoordinator;
  readonly connectionLog: ConnectionLog;
}

export async function createMultiUniverseStack(
  config: ServerConfig,
  logger: DmxLogger,
  latencyTracker: LatencyTracker,
  fallbackManager?: UniverseManager,
): Promise<MultiUniverseStack> {
  const registry = createUniverseRegistry("./config/universes.json");
  await registry.load();

  const connectionLog = createConnectionLog();

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
        onStateChange: (status) => {
          connectionLog.push(mapStatusToEvent(status, uniConfig.id));
        },
      });
    },
    createManager: (universe) =>
      createUniverseManager(universe, {
        logger,
        onDmxError: (err) => logger.error(`Send error: ${err}`),
        onDmxSendTiming: (ms) => latencyTracker.recordDmxSend(ms),
      }),
  });

  const coordinator = createMultiUniverseCoordinator(() => {
    const managers = pool.getAllManagers();
    if (fallbackManager && !managers.has(DEFAULT_UNIVERSE_ID)) {
      const merged = new Map(managers);
      merged.set(DEFAULT_UNIVERSE_ID, fallbackManager);
      return merged;
    }
    return managers;
  });
  pipeLog("info", `Universe registry loaded: ${registry.getAll().length} universe(s)`);

  // Bootstrap connections for all persisted universes
  for (const uniConfig of registry.getAll()) {
    if (uniConfig.devicePath === "auto") {
      pipeLog("info", `Universe "${uniConfig.name}" (${shortId(uniConfig.id)}) skipped — device path not configured`);
      continue;
    }
    try {
      await pool.create(uniConfig);
      pipeLog("info", `Universe "${uniConfig.name}" (${shortId(uniConfig.id)}) connected`);
    } catch (err) {
      logger.warn(`Failed to initialize universe "${uniConfig.name}": ${err}`);
    }
  }

  return { registry, pool, coordinator, connectionLog };
}
