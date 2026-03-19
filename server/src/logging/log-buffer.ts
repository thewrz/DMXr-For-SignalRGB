import type { ConnectionEvent } from "../dmx/connection-state.js";

export type LogLevel = "error" | "warn" | "info" | "debug";
export type LogSource = "connection" | "pipeline" | "server" | "api";

export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly source: LogSource;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export interface LogBufferFilters {
  readonly level?: LogLevel;
  readonly source?: LogSource;
  readonly since?: string;
  readonly limit?: number;
}

export interface LogBuffer {
  readonly getEntries: (filters?: LogBufferFilters) => readonly LogEntry[];
  readonly push: (entry: LogEntry) => void;
  readonly clear: () => void;
  readonly subscribe: (cb: (entry: LogEntry) => void) => () => void;
}

export interface LogBufferOptions {
  readonly maxSize?: number;
}

const LEVEL_RANK: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const DEFAULT_MAX_SIZE = 1000;

export function createLogBuffer(options: LogBufferOptions = {}): LogBuffer {
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  const entries: LogEntry[] = [];
  const subscribers = new Set<(entry: LogEntry) => void>();

  return {
    getEntries(filters: LogBufferFilters = {}): readonly LogEntry[] {
      let result: readonly LogEntry[] = entries;

      if (filters.level) {
        const maxRank = LEVEL_RANK[filters.level];
        result = result.filter((e) => LEVEL_RANK[e.level] <= maxRank);
      }

      if (filters.source) {
        const src = filters.source;
        result = result.filter((e) => e.source === src);
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

    push(entry: LogEntry): void {
      entries.unshift(entry);
      if (entries.length > maxSize) {
        entries.pop();
      }
      for (const cb of subscribers) {
        cb(entry);
      }
    },

    clear(): void {
      entries.length = 0;
    },

    subscribe(cb: (entry: LogEntry) => void): () => void {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
  };
}

const CONNECTION_EVENT_LEVELS: Record<string, LogLevel> = {
  connected: "info",
  reconnect_success: "info",
  disconnected: "warn",
  reconnect_failed: "warn",
  reconnecting: "info",
  port_changed: "info",
  control_mode_changed: "info",
};

const CONNECTION_EVENT_LABELS: Record<string, string> = {
  connected: "DMX connected",
  disconnected: "DMX disconnected",
  reconnecting: "DMX reconnecting",
  reconnect_failed: "DMX reconnect failed",
  reconnect_success: "DMX reconnect success",
  port_changed: "DMX port changed",
  control_mode_changed: "Control mode changed",
};

export function mapConnectionEventToLogEntry(event: ConnectionEvent): LogEntry {
  const level = CONNECTION_EVENT_LEVELS[event.type] ?? "info";
  const label = CONNECTION_EVENT_LABELS[event.type] ?? event.type;
  const details: Record<string, unknown> = {
    universeId: event.universeId,
    ...event.details,
  };

  return {
    timestamp: event.timestamp,
    level,
    source: "connection",
    message: label,
    details,
  };
}
