import type { ServerConfig } from "../config/server-config.js";
import type { DmxConnection, DmxUniverse } from "./driver-factory.js";
import type { DmxLogger } from "./universe-manager.js";
import type { ConnectionState, ConnectionStatus } from "./connection-state.js";
import { createInitialStatus } from "./connection-state.js";
import { createDmxConnection } from "./driver-factory.js";

/** Mutable version of ConnectionStatus for internal state tracking */
interface MutableStatus {
  state: ConnectionState;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  reconnectAttempts: number;
  lastError: string | null;
}

const MIN_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

export interface ResilientConnectionOptions {
  readonly config: ServerConfig;
  readonly logger: DmxLogger;
  readonly getChannelSnapshot: () => Record<number, number>;
  readonly onStateChange?: (status: ConnectionStatus) => void;
}

export interface ResilientConnection {
  readonly universe: DmxUniverse;
  readonly close: () => Promise<void>;
  readonly getStatus: () => ConnectionStatus;
}

/**
 * Creates a resilient DMX connection that automatically reconnects
 * on USB disconnect with exponential backoff.
 *
 * Returns a proxy DmxUniverse that:
 * - Passes through to the real universe when connected
 * - Silently drops updates when disconnected/reconnecting
 * - Replays channel state on successful reconnect
 */
export async function createResilientConnection(
  options: ResilientConnectionOptions,
): Promise<ResilientConnection> {
  const { config, logger, getChannelSnapshot, onStateChange } = options;

  let currentConnection: DmxConnection | null = null;
  let status: MutableStatus = { ...createInitialStatus("disconnected") };
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let disconnectLogged = false;

  function snapshotStatus(): ConnectionStatus {
    return { ...status };
  }

  function notifyStateChange(): void {
    onStateChange?.(snapshotStatus());
  }

  function transitionTo(state: ConnectionState): void {
    if (status.state === state) return;
    logger.info(`DMX connection: ${status.state} → ${state}`);

    status.state = state;
    if (state === "connected") {
      status.lastConnectedAt = Date.now();
      status.reconnectAttempts = 0;
      status.lastError = null;
    } else if (state === "disconnected") {
      status.lastDisconnectedAt = Date.now();
    }
    notifyStateChange();
  }

  function attachDisconnectListener(conn: DmxConnection): void {
    conn.onDisconnect?.((err) => {
      if (closed) return;
      const msg = err?.message ?? "USB device disconnected";
      logger.error(`DMX disconnect detected: ${msg}`);
      currentConnection = null;
      disconnectLogged = false;
      transitionTo("disconnected");
      scheduleReconnect();
    });
  }

  function scheduleReconnect(): void {
    if (closed || reconnectTimer !== null) return;

    const attempt = status.reconnectAttempts;
    const delay = Math.min(
      MIN_RECONNECT_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, attempt),
      MAX_RECONNECT_DELAY_MS,
    );

    transitionTo("reconnecting");
    logger.info(`Reconnect attempt ${attempt + 1} in ${delay}ms`);

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      attemptReconnect();
    }, delay);
  }

  async function attemptReconnect(): Promise<void> {
    if (closed) return;

    status.reconnectAttempts += 1;
    notifyStateChange();

    try {
      const conn = await createDmxConnection(config);
      if (closed) {
        await conn.close();
        return;
      }

      currentConnection = conn;
      attachDisconnectListener(conn);
      transitionTo("connected");

      // Replay channel state
      const snapshot = getChannelSnapshot();
      const channelCount = Object.keys(snapshot).length;
      if (channelCount > 0) {
        conn.universe.update(snapshot);
        logger.info(`Replayed ${channelCount} channels after reconnect`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Reconnect failed: ${msg}`);
      status.lastError = msg;
      notifyStateChange();
      scheduleReconnect();
    }
  }

  // Establish initial connection
  const initialConnection = await createDmxConnection(config);
  currentConnection = initialConnection;
  attachDisconnectListener(initialConnection);
  status = { ...createInitialStatus("connected") };
  onStateChange?.(snapshotStatus());

  // Proxy universe — delegates to current connection or drops silently
  const universe: DmxUniverse = {
    update: (channels) => {
      if (currentConnection) {
        currentConnection.universe.update(channels);
        return;
      }
      if (!disconnectLogged) {
        disconnectLogged = true;
        logger.warn("DMX update dropped: no active connection");
      }
    },
    updateAll: (value) => {
      if (currentConnection) {
        currentConnection.universe.updateAll(value);
        return;
      }
      if (!disconnectLogged) {
        disconnectLogged = true;
        logger.warn("DMX updateAll dropped: no active connection");
      }
    },
  };

  return {
    universe,

    async close(): Promise<void> {
      closed = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (currentConnection) {
        await currentConnection.close();
        currentConnection = null;
      }
    },

    getStatus(): ConnectionStatus {
      return snapshotStatus();
    },
  };
}
