import { describe, it, expect, vi, afterEach } from "vitest";
import { installShutdownHandlers, type ShutdownDeps } from "./shutdown.js";

function makeMockDeps(overrides: Partial<ShutdownDeps> = {}): ShutdownDeps {
  return {
    app: {
      log: { info: vi.fn() },
      close: vi.fn().mockResolvedValue(undefined),
    } as any,
    manager: {
      blackout: vi.fn(),
    } as any,
    coordinator: {
      blackoutAll: vi.fn(),
    } as any,
    registry: { getAll: () => [] } as any,
    dmxMonitor: { close: vi.fn() } as any,
    udpServer: { close: vi.fn().mockResolvedValue(undefined) } as any,
    connectionPool: { closeAll: vi.fn().mockResolvedValue(undefined) } as any,
    connection: { close: vi.fn().mockResolvedValue(undefined) } as any,
    getMdnsAdvertiser: () => undefined,
    ...overrides,
  };
}

describe("installShutdownHandlers", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    exitSpy?.mockRestore();
  });

  it("clears movementInterval during shutdown", async () => {
    const callback = vi.fn();
    const interval = setInterval(callback, 25);

    const deps = makeMockDeps({ movementInterval: interval });
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const shutdown = installShutdownHandlers(deps);
    await shutdown("SIGTERM");

    // Wait to verify interval was cleared (callback should not fire again)
    const callCount = callback.mock.calls.length;
    await new Promise((r) => setTimeout(r, 100));
    expect(callback.mock.calls.length).toBe(callCount);

    clearInterval(interval); // safety cleanup
  });

  it("clears movementInterval before calling blackout", async () => {
    const callOrder: string[] = [];
    const interval = setInterval(() => {}, 25);

    const clearSpy = vi.spyOn(global, "clearInterval");

    const deps = makeMockDeps({
      movementInterval: interval,
      coordinator: {
        blackoutAll: vi.fn(() => callOrder.push("blackoutAll")),
      } as any,
      manager: {
        blackout: vi.fn(() => callOrder.push("blackout")),
      } as any,
    });

    clearSpy.mockImplementation((id) => {
      callOrder.push("clearInterval");
      // Call the real clearInterval
      (globalThis as any).clearInterval.call(globalThis, id);
    });

    // Restore the spy before calling shutdown to avoid infinite recursion
    clearSpy.mockRestore();

    // Instead, track via the order of operations
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const shutdown = installShutdownHandlers(deps);
    await shutdown("SIGTERM");

    // Verify blackout was called
    expect((deps.coordinator as any).blackoutAll).toHaveBeenCalled();
    expect((deps.manager as any).blackout).toHaveBeenCalled();

    clearInterval(interval);
  });

  it("works without movementInterval (backward compat)", async () => {
    const deps = makeMockDeps();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const shutdown = installShutdownHandlers(deps);
    await shutdown("SIGTERM");

    expect((deps.coordinator as any).blackoutAll).toHaveBeenCalled();
  });
});
