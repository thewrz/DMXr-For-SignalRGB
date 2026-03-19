import { describe, it, expect } from "vitest";
import { createInitialStatus } from "./connection-state.js";

describe("createInitialStatus", () => {
  it("sets state to 'connected' and lastConnectedAt to a number", () => {
    const status = createInitialStatus("connected");

    expect(status.state).toBe("connected");
    expect(status.lastConnectedAt).toBeTypeOf("number");
  });

  it("sets state to 'disconnected' and lastConnectedAt to null", () => {
    const status = createInitialStatus("disconnected");

    expect(status.state).toBe("disconnected");
    expect(status.lastConnectedAt).toBeNull();
  });

  it("sets state to 'reconnecting' and lastConnectedAt to null", () => {
    const status = createInitialStatus("reconnecting");

    expect(status.state).toBe("reconnecting");
    expect(status.lastConnectedAt).toBeNull();
  });

  it("initializes all statuses with reconnectAttempts 0 and null error fields", () => {
    for (const state of ["connected", "disconnected", "reconnecting"] as const) {
      const status = createInitialStatus(state);

      expect(status.reconnectAttempts).toBe(0);
      expect(status.lastDisconnectedAt).toBeNull();
      expect(status.lastError).toBeNull();
      expect(status.lastErrorTitle).toBeNull();
      expect(status.lastErrorSuggestion).toBeNull();
    }
  });

  it("returns a fresh object each time (no shared references)", () => {
    const a = createInitialStatus("connected");
    const b = createInitialStatus("connected");

    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
