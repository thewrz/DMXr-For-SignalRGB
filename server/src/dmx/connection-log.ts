import type { ConnectionEvent, ConnectionStatus } from "./connection-state.js";

export interface ConnectionLog {
  readonly getEvents: (filters?: ConnectionLogFilters) => readonly ConnectionEvent[];
  readonly push: (event: ConnectionEvent) => void;
  readonly clear: () => void;
  readonly subscribe: (cb: (event: ConnectionEvent) => void) => () => void;
}

export interface ConnectionLogFilters {
  readonly universeId?: string;
  readonly since?: string;
  readonly limit?: number;
}

export interface ConnectionLogOptions {
  readonly maxSize?: number;
}

const DEFAULT_MAX_SIZE = 200;

export function createConnectionLog(options: ConnectionLogOptions = {}): ConnectionLog {
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  const events: ConnectionEvent[] = [];
  const subscribers = new Set<(event: ConnectionEvent) => void>();

  return {
    getEvents(filters: ConnectionLogFilters = {}): readonly ConnectionEvent[] {
      let result: readonly ConnectionEvent[] = events;

      if (filters.universeId) {
        const uid = filters.universeId;
        result = result.filter((e) => e.universeId === uid);
      }

      if (filters.since) {
        const since = filters.since;
        result = result.filter((e) => e.timestamp >= since);
      }

      if (filters.limit !== undefined) {
        result = result.slice(0, filters.limit);
      }

      return result;
    },

    push(event: ConnectionEvent): void {
      events.unshift(event);
      if (events.length > maxSize) {
        events.pop();
      }
      for (const cb of subscribers) {
        cb(event);
      }
    },

    clear(): void {
      events.length = 0;
    },

    subscribe(cb: (event: ConnectionEvent) => void): () => void {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
  };
}

export function mapStatusToEvent(
  status: ConnectionStatus,
  universeId: string,
): ConnectionEvent {
  const timestamp = new Date().toISOString();

  if (status.state === "connected") {
    return {
      timestamp,
      type: "connected",
      universeId,
      details: {},
    };
  }

  if (status.state === "disconnected") {
    const downtimeMs =
      status.lastConnectedAt !== null && status.lastDisconnectedAt !== null
        ? status.lastDisconnectedAt - status.lastConnectedAt
        : undefined;

    return {
      timestamp,
      type: "disconnected",
      universeId,
      details: {
        ...(status.lastError ? { error: status.lastError } : {}),
        ...(status.lastErrorSuggestion ? { suggestion: status.lastErrorSuggestion } : {}),
        ...(downtimeMs !== undefined ? { downtimeMs } : {}),
      },
    };
  }

  // reconnecting
  return {
    timestamp,
    type: "reconnecting",
    universeId,
    details: {
      attempt: status.reconnectAttempts,
      ...(status.lastError ? { error: status.lastError } : {}),
      ...(status.lastErrorSuggestion ? { suggestion: status.lastErrorSuggestion } : {}),
    },
  };
}
