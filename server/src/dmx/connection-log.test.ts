import { describe, it, expect, vi } from "vitest";
import { createConnectionLog } from "./connection-log.js";
import { mapStatusToEvent } from "./connection-log.js";
import type { ConnectionEvent } from "./connection-state.js";
import type { ConnectionStatus } from "./connection-state.js";

function makeEvent(overrides: Partial<ConnectionEvent> = {}): ConnectionEvent {
  return {
    timestamp: new Date().toISOString(),
    type: "connected",
    universeId: "default",
    details: {},
    ...overrides,
  };
}

describe("createConnectionLog", () => {
  it("returns empty array initially", () => {
    const log = createConnectionLog();
    expect(log.getEvents()).toEqual([]);
  });

  it("push adds events and getEvents returns newest-first", () => {
    const log = createConnectionLog();
    const e1 = makeEvent({ timestamp: "2026-01-01T00:00:00.000Z", type: "connected" });
    const e2 = makeEvent({ timestamp: "2026-01-01T00:00:01.000Z", type: "disconnected" });
    const e3 = makeEvent({ timestamp: "2026-01-01T00:00:02.000Z", type: "reconnecting" });

    log.push(e1);
    log.push(e2);
    log.push(e3);

    const events = log.getEvents();
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe("reconnecting");
    expect(events[1].type).toBe("disconnected");
    expect(events[2].type).toBe("connected");
  });

  it("ring buffer evicts oldest events at capacity", () => {
    const log = createConnectionLog({ maxSize: 3 });
    const events = Array.from({ length: 5 }, (_, i) =>
      makeEvent({ timestamp: `2026-01-01T00:00:0${i}.000Z`, type: "connected", universeId: `u${i}` }),
    );

    for (const e of events) log.push(e);

    const result = log.getEvents();
    expect(result).toHaveLength(3);
    // Should have events 4, 3, 2 (newest first), oldest (0, 1) evicted
    expect(result[0].universeId).toBe("u4");
    expect(result[1].universeId).toBe("u3");
    expect(result[2].universeId).toBe("u2");
  });

  it("filters by universeId", () => {
    const log = createConnectionLog();
    log.push(makeEvent({ universeId: "alpha" }));
    log.push(makeEvent({ universeId: "beta" }));
    log.push(makeEvent({ universeId: "alpha" }));

    const result = log.getEvents({ universeId: "alpha" });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.universeId === "alpha")).toBe(true);
  });

  it("filters by since ISO timestamp", () => {
    const log = createConnectionLog();
    log.push(makeEvent({ timestamp: "2026-01-01T00:00:00.000Z" }));
    log.push(makeEvent({ timestamp: "2026-01-01T00:00:05.000Z" }));
    log.push(makeEvent({ timestamp: "2026-01-01T00:00:10.000Z" }));

    const result = log.getEvents({ since: "2026-01-01T00:00:03.000Z" });
    expect(result).toHaveLength(2);
  });

  it("filters by limit", () => {
    const log = createConnectionLog();
    for (let i = 0; i < 10; i++) log.push(makeEvent());

    const result = log.getEvents({ limit: 3 });
    expect(result).toHaveLength(3);
  });

  it("clear empties the log", () => {
    const log = createConnectionLog();
    log.push(makeEvent());
    log.push(makeEvent());
    log.clear();
    expect(log.getEvents()).toEqual([]);
  });

  it("subscribe delivers events in real-time when pushed", () => {
    const log = createConnectionLog();
    const received: ConnectionEvent[] = [];
    log.subscribe((event) => received.push(event));

    const e = makeEvent({ type: "disconnected" });
    log.push(e);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("disconnected");
  });

  it("unsubscribe stops delivery", () => {
    const log = createConnectionLog();
    const received: ConnectionEvent[] = [];
    const unsub = log.subscribe((event) => received.push(event));

    log.push(makeEvent());
    unsub();
    log.push(makeEvent());

    expect(received).toHaveLength(1);
  });
});

describe("control_mode_changed events", () => {
  it("stores control_mode_changed events with controlMode detail", () => {
    const log = createConnectionLog();
    const event = makeEvent({
      type: "control_mode_changed",
      details: { controlMode: "blackout" },
    });
    log.push(event);

    const events = log.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("control_mode_changed");
    expect(events[0].details.controlMode).toBe("blackout");
  });

  it("delivers control_mode_changed events to subscribers", () => {
    const log = createConnectionLog();
    const received: ConnectionEvent[] = [];
    log.subscribe((event) => received.push(event));

    const event = makeEvent({
      type: "control_mode_changed",
      details: { controlMode: "blackout" },
    });
    log.push(event);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("control_mode_changed");
    expect(received[0].details.controlMode).toBe("blackout");
  });
});

describe("mapStatusToEvent", () => {
  it("maps connected status with devicePath", () => {
    const status: ConnectionStatus = {
      state: "connected",
      lastConnectedAt: Date.now(),
      lastDisconnectedAt: null,
      reconnectAttempts: 0,
      lastError: null,
      lastErrorTitle: null,
      lastErrorSuggestion: null,
    };

    const event = mapStatusToEvent(status, "uni-1");
    expect(event.type).toBe("connected");
    expect(event.universeId).toBe("uni-1");
    expect(event.timestamp).toBeTruthy();
  });

  it("maps disconnected status with downtimeMs calculation", () => {
    const now = Date.now();
    const status: ConnectionStatus = {
      state: "disconnected",
      lastConnectedAt: now - 5000,
      lastDisconnectedAt: now,
      reconnectAttempts: 0,
      lastError: "USB removed",
      lastErrorTitle: null,
      lastErrorSuggestion: null,
    };

    const event = mapStatusToEvent(status, "uni-1");
    expect(event.type).toBe("disconnected");
    expect(event.details.error).toBe("USB removed");
    expect(event.details.downtimeMs).toBeGreaterThanOrEqual(0);
  });

  it("maps reconnecting status with attempt count", () => {
    const status: ConnectionStatus = {
      state: "reconnecting",
      lastConnectedAt: null,
      lastDisconnectedAt: Date.now(),
      reconnectAttempts: 3,
      lastError: "Device busy",
      lastErrorTitle: null,
      lastErrorSuggestion: "Check cable",
    };

    const event = mapStatusToEvent(status, "uni-2");
    expect(event.type).toBe("reconnecting");
    expect(event.details.attempt).toBe(3);
    expect(event.details.error).toBe("Device busy");
    expect(event.details.suggestion).toBe("Check cable");
  });
});
