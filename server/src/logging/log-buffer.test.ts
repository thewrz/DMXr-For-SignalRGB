import { describe, it, expect, vi } from "vitest";
import {
  createLogBuffer,
  mapConnectionEventToLogEntry,
  type LogEntry,
} from "./log-buffer.js";
import type { ConnectionEvent } from "../dmx/connection-state.js";

function entry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level: "info",
    source: "server",
    message: "test",
    ...overrides,
  };
}

describe("createLogBuffer", () => {
  it("stores and retrieves entries in newest-first order", () => {
    const buf = createLogBuffer();
    const e1 = entry({ message: "first" });
    const e2 = entry({ message: "second" });
    buf.push(e1);
    buf.push(e2);
    const result = buf.getEntries();
    expect(result).toHaveLength(2);
    expect(result[0].message).toBe("second");
    expect(result[1].message).toBe("first");
  });

  it("evicts oldest entries when maxSize is exceeded", () => {
    const buf = createLogBuffer({ maxSize: 3 });
    for (let i = 0; i < 5; i++) {
      buf.push(entry({ message: `msg-${i}` }));
    }
    const result = buf.getEntries();
    expect(result).toHaveLength(3);
    expect(result[0].message).toBe("msg-4");
    expect(result[2].message).toBe("msg-2");
  });

  it("filters by level rank (info includes error + warn + info)", () => {
    const buf = createLogBuffer();
    buf.push(entry({ level: "debug", message: "debug" }));
    buf.push(entry({ level: "info", message: "info" }));
    buf.push(entry({ level: "warn", message: "warn" }));
    buf.push(entry({ level: "error", message: "error" }));

    const result = buf.getEntries({ level: "info" });
    expect(result).toHaveLength(3);
    expect(result.map((e) => e.level)).toEqual(["error", "warn", "info"]);
  });

  it("filters by level rank (error returns only errors)", () => {
    const buf = createLogBuffer();
    buf.push(entry({ level: "info" }));
    buf.push(entry({ level: "error" }));
    expect(buf.getEntries({ level: "error" })).toHaveLength(1);
  });

  it("filters by level rank (debug returns all levels)", () => {
    const buf = createLogBuffer();
    buf.push(entry({ level: "error" }));
    buf.push(entry({ level: "warn" }));
    buf.push(entry({ level: "info" }));
    buf.push(entry({ level: "debug" }));
    expect(buf.getEntries({ level: "debug" })).toHaveLength(4);
  });

  it("filters by source", () => {
    const buf = createLogBuffer();
    buf.push(entry({ source: "pipeline" }));
    buf.push(entry({ source: "connection" }));
    buf.push(entry({ source: "pipeline" }));

    const result = buf.getEntries({ source: "pipeline" });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.source === "pipeline")).toBe(true);
  });

  it("filters by since timestamp", () => {
    const buf = createLogBuffer();
    buf.push(entry({ timestamp: "2026-01-01T00:00:00Z" }));
    buf.push(entry({ timestamp: "2026-06-01T00:00:00Z" }));

    const result = buf.getEntries({ since: "2026-03-01T00:00:00Z" });
    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe("2026-06-01T00:00:00Z");
  });

  it("applies limit", () => {
    const buf = createLogBuffer();
    for (let i = 0; i < 10; i++) buf.push(entry({ message: `m${i}` }));
    expect(buf.getEntries({ limit: 3 })).toHaveLength(3);
  });

  it("combines filters", () => {
    const buf = createLogBuffer();
    buf.push(entry({ level: "error", source: "pipeline" }));
    buf.push(entry({ level: "info", source: "pipeline" }));
    buf.push(entry({ level: "error", source: "server" }));

    const result = buf.getEntries({ level: "error", source: "pipeline" });
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("pipeline");
    expect(result[0].level).toBe("error");
  });

  it("subscribe notifies on push", () => {
    const buf = createLogBuffer();
    const cb = vi.fn();
    buf.subscribe(cb);

    const e = entry({ message: "hello" });
    buf.push(e);
    expect(cb).toHaveBeenCalledWith(e);
  });

  it("unsubscribe stops notifications", () => {
    const buf = createLogBuffer();
    const cb = vi.fn();
    const unsub = buf.subscribe(cb);
    unsub();

    buf.push(entry());
    expect(cb).not.toHaveBeenCalled();
  });

  it("clear removes all entries", () => {
    const buf = createLogBuffer();
    buf.push(entry());
    buf.push(entry());
    buf.clear();
    expect(buf.getEntries()).toHaveLength(0);
  });

  it("getEntries with filter returns a new array each call", () => {
    const buf = createLogBuffer();
    buf.push(entry({ level: "info" }));
    const a = buf.getEntries({ level: "info" });
    const b = buf.getEntries({ level: "info" });
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("defaults maxSize to 1000", () => {
    const buf = createLogBuffer();
    for (let i = 0; i < 1050; i++) buf.push(entry({ message: `m${i}` }));
    expect(buf.getEntries()).toHaveLength(1000);
  });
});

describe("mapConnectionEventToLogEntry", () => {
  it("maps connected event to info level with connection source", () => {
    const event: ConnectionEvent = {
      timestamp: "2026-01-01T00:00:00Z",
      type: "connected",
      universeId: "default",
      details: {},
    };
    const result = mapConnectionEventToLogEntry(event);
    expect(result.level).toBe("info");
    expect(result.source).toBe("connection");
    expect(result.message).toBe("DMX connected");
    expect(result.timestamp).toBe(event.timestamp);
    expect(result.details).toEqual({ universeId: "default" });
  });

  it("maps disconnected event to warn level", () => {
    const event: ConnectionEvent = {
      timestamp: "2026-01-01T00:00:00Z",
      type: "disconnected",
      universeId: "u1",
      details: { error: "device lost" },
    };
    const result = mapConnectionEventToLogEntry(event);
    expect(result.level).toBe("warn");
    expect(result.message).toBe("DMX disconnected");
    expect(result.details).toEqual({ universeId: "u1", error: "device lost" });
  });

  it("maps reconnect_failed event to warn level", () => {
    const event: ConnectionEvent = {
      timestamp: "2026-01-01T00:00:00Z",
      type: "reconnect_failed",
      universeId: "u1",
      details: { attempt: 3 },
    };
    const result = mapConnectionEventToLogEntry(event);
    expect(result.level).toBe("warn");
    expect(result.message).toBe("DMX reconnect failed");
  });

  it("maps reconnecting event to info level", () => {
    const event: ConnectionEvent = {
      timestamp: "2026-01-01T00:00:00Z",
      type: "reconnecting",
      universeId: "u1",
      details: { attempt: 1 },
    };
    const result = mapConnectionEventToLogEntry(event);
    expect(result.level).toBe("info");
    expect(result.message).toBe("DMX reconnecting");
  });

  it("maps control_mode_changed event", () => {
    const event: ConnectionEvent = {
      timestamp: "2026-01-01T00:00:00Z",
      type: "control_mode_changed",
      universeId: "default",
      details: { controlMode: "blackout" },
    };
    const result = mapConnectionEventToLogEntry(event);
    expect(result.level).toBe("info");
    expect(result.message).toBe("Control mode changed");
    expect(result.details).toEqual({ universeId: "default", controlMode: "blackout" });
  });
});
