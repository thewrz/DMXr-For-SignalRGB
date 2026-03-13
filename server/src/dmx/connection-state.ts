export type ConnectionState = "connected" | "disconnected" | "reconnecting";

export interface ConnectionStatus {
  readonly state: ConnectionState;
  readonly lastConnectedAt: number | null;
  readonly lastDisconnectedAt: number | null;
  readonly reconnectAttempts: number;
  readonly lastError: string | null;
  readonly lastErrorTitle: string | null;
  readonly lastErrorSuggestion: string | null;
}

export type ConnectionEventType =
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "reconnect_failed"
  | "reconnect_success"
  | "port_changed"
  | "control_mode_changed";

export interface ConnectionEvent {
  readonly timestamp: string;
  readonly type: ConnectionEventType;
  readonly universeId: string;
  readonly details: {
    readonly devicePath?: string;
    readonly driver?: string;
    readonly error?: string;
    readonly suggestion?: string;
    readonly attempt?: number;
    readonly backoffMs?: number;
    readonly downtimeMs?: number;
    readonly controlMode?: string;
  };
}

export function createInitialStatus(state: ConnectionState): ConnectionStatus {
  return {
    state,
    lastConnectedAt: state === "connected" ? Date.now() : null,
    lastDisconnectedAt: null,
    reconnectAttempts: 0,
    lastError: null,
    lastErrorTitle: null,
    lastErrorSuggestion: null,
  };
}
