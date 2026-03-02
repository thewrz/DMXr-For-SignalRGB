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
