import type { ServerConfig } from "../config/server-config.js";
import type { DmxLogger } from "../dmx/universe-manager.js";
import { createUniverseManager, type UniverseManager } from "../dmx/universe-manager.js";
import { createResilientConnection, type ResilientConnection } from "../dmx/resilient-connection.js";
import { createLatencyTracker, type LatencyTracker } from "../metrics/latency-tracker.js";
import { mapStatusToEvent, type ConnectionLog } from "../dmx/connection-log.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";

export interface DmxStack {
  readonly connection: ResilientConnection;
  readonly manager: UniverseManager;
  readonly latencyTracker: LatencyTracker;
}

export async function createDmxStack(
  config: ServerConfig,
  logger: DmxLogger,
  connectionLog?: ConnectionLog,
): Promise<DmxStack> {
  // Late-binding: manager reference filled after creation
  let managerRef: UniverseManager | null = null;

  const connection = await createResilientConnection({
    config,
    logger,
    getChannelSnapshot: () => {
      if (!managerRef) return {};
      // When in blackout, return an empty snapshot so the reconnect
      // zero-flush + onReconnect blackout is the only thing sent.
      // This prevents stale defaults (e.g. Strobe: 255) from leaking
      // through the reconnect replay while the server is blacked out.
      if (managerRef.isBlackoutActive()) return {};
      return managerRef.getFullSnapshot();
    },
    onReconnect: () => {
      // Re-apply blackout on the fresh connection so fixtures go dark
      // immediately instead of showing stale values from the snapshot.
      if (managerRef?.isBlackoutActive()) {
        managerRef.blackout();
        logger.info("Re-applied blackout after reconnect");
        connectionLog?.push({
          timestamp: new Date().toISOString(),
          type: "control_mode_changed",
          universeId: DEFAULT_UNIVERSE_ID,
          details: { controlMode: "blackout" },
        });
      }
    },
    onStateChange: (status) => {
      logger.info(
        `Connection state: ${status.state}` +
        (status.reconnectAttempts > 0 ? ` (attempt ${status.reconnectAttempts})` : "") +
        (status.lastError ? ` — ${status.lastError}` : ""),
      );
      connectionLog?.push(mapStatusToEvent(status, DEFAULT_UNIVERSE_ID));
    },
  });

  const latencyTracker = createLatencyTracker();

  const manager = createUniverseManager(connection.universe, {
    logger,
    onDmxError: (err) => logger.error(`Send error: ${err}`),
    onDmxSendTiming: (ms) => latencyTracker.recordDmxSend(ms),
  });
  managerRef = manager;

  return { connection, manager, latencyTracker };
}
