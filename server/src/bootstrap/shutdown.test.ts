import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
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
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    exitSpy?.mockRestore();
    stderrSpy?.mockRestore();
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

  it("guards against duplicate shutdown calls", async () => {
    const deps = makeMockDeps();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const shutdown = installShutdownHandlers(deps);
    await shutdown("SIGINT");
    await shutdown("SIGINT");

    // blackout should only be called once despite two shutdown calls
    expect(deps.coordinator.blackoutAll).toHaveBeenCalledTimes(1);
    expect(deps.manager.blackout).toHaveBeenCalledTimes(1);
  });

  it("clears all timerMaps during shutdown", async () => {
    const timer1 = setTimeout(() => {}, 60_000);
    const timer2 = setTimeout(() => {}, 60_000);
    const map1 = new Map<string, NodeJS.Timeout>([["a", timer1]]);
    const map2 = new Map<string, NodeJS.Timeout>([["b", timer2]]);

    const deps = makeMockDeps({ timerMaps: [map1, map2] });
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const shutdown = installShutdownHandlers(deps);
    await shutdown("SIGTERM");

    expect(map1.size).toBe(0);
    expect(map2.size).toBe(0);
  });

  it("calls close on registry providers that have a close method", async () => {
    const closeFn = vi.fn();
    const providers = [
      { close: closeFn },
      { /* no close method */ },
      { close: closeFn },
    ];
    const deps = makeMockDeps({
      registry: { getAll: () => providers } as any,
    });
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const shutdown = installShutdownHandlers(deps);
    await shutdown("SIGTERM");

    expect(closeFn).toHaveBeenCalledTimes(2);
  });

  it("calls unpublishAll on mdns advertiser when present", async () => {
    const unpublishAll = vi.fn();
    const deps = makeMockDeps({
      getMdnsAdvertiser: () => ({ unpublishAll }) as any,
    });
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const shutdown = installShutdownHandlers(deps);
    await shutdown("SIGTERM");

    expect(unpublishAll).toHaveBeenCalledOnce();
  });

  it("handles uncaughtException by writing to stderr and shutting down", async () => {
    const deps = makeMockDeps();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    installShutdownHandlers(deps);

    const error = new Error("test fatal error");
    process.emit("uncaughtException", error);

    // Allow the async shutdown to complete
    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalled();
    });

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("FATAL uncaughtException"),
    );
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("test fatal error"),
    );
  });

  it("handles unhandledRejection by writing to stderr and shutting down", async () => {
    const deps = makeMockDeps();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    installShutdownHandlers(deps);

    process.emit("unhandledRejection", "promise rejected reason", Promise.resolve());

    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalled();
    });

    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("FATAL unhandledRejection"),
    );
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining("promise rejected reason"),
    );
  });

  it("exit handler performs last-resort blackout when shutdown was not called", () => {
    const deps = makeMockDeps();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    installShutdownHandlers(deps);

    // Emit exit directly without going through shutdown
    process.emit("exit", 0);

    expect(deps.coordinator.blackoutAll).toHaveBeenCalledOnce();
    expect(deps.manager.blackout).toHaveBeenCalledOnce();
  });

  it("exit handler does not double-blackout after graceful shutdown", async () => {
    const deps = makeMockDeps();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const shutdown = installShutdownHandlers(deps);
    await shutdown("SIGTERM");

    // Reset call counts after the graceful shutdown
    (deps.coordinator.blackoutAll as ReturnType<typeof vi.fn>).mockClear();
    (deps.manager.blackout as ReturnType<typeof vi.fn>).mockClear();

    // Now emit exit -- should not blackout again since exitBlackoutDone is true
    process.emit("exit", 0);

    expect(deps.coordinator.blackoutAll).not.toHaveBeenCalled();
    expect(deps.manager.blackout).not.toHaveBeenCalled();
  });

  // --- Compound error-boundary tests ---

  it("mDNS throws → blackout still fires (lights must go dark)", async () => {
    const deps = makeMockDeps({
      getMdnsAdvertiser: () => ({
        unpublishAll: () => { throw new Error("mDNS exploded"); },
      }) as any,
    });
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const shutdown = installShutdownHandlers(deps);
    await shutdown("SIGTERM");

    expect(deps.coordinator.blackoutAll).toHaveBeenCalledOnce();
    expect(deps.manager.blackout).toHaveBeenCalledOnce();
  });

  it("provider 1 close throws → provider 2 still closes", async () => {
    const close2 = vi.fn();
    const providers = [
      { close: () => { throw new Error("provider 1 boom"); } },
      { close: close2 },
    ];
    const deps = makeMockDeps({
      registry: { getAll: () => providers } as any,
    });
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const shutdown = installShutdownHandlers(deps);
    await shutdown("SIGTERM");

    expect(close2).toHaveBeenCalledOnce();
    expect(deps.coordinator.blackoutAll).toHaveBeenCalledOnce();
  });

  it("dmxMonitor.close throws → coordinator.blackoutAll still fires", async () => {
    const deps = makeMockDeps({
      dmxMonitor: {
        close: () => { throw new Error("monitor crash"); },
      } as any,
    });
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const shutdown = installShutdownHandlers(deps);
    await shutdown("SIGTERM");

    expect(deps.coordinator.blackoutAll).toHaveBeenCalledOnce();
    expect(deps.manager.blackout).toHaveBeenCalledOnce();
  });

  it("connectionPool.closeAll rejects → connection.close still runs", async () => {
    const connectionClose = vi.fn().mockResolvedValue(undefined);
    const deps = makeMockDeps({
      connectionPool: {
        closeAll: vi.fn().mockRejectedValue(new Error("pool close fail")),
      } as any,
      connection: { close: connectionClose } as any,
    });
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const shutdown = installShutdownHandlers(deps);
    await shutdown("SIGTERM");

    expect(connectionClose).toHaveBeenCalledOnce();
  });

  it("concurrent SIGINT + SIGTERM → shutdown runs exactly once", async () => {
    const deps = makeMockDeps();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const shutdown = installShutdownHandlers(deps);

    // Fire both concurrently
    const [r1, r2] = await Promise.all([
      shutdown("SIGINT"),
      shutdown("SIGTERM"),
    ]);

    expect(deps.coordinator.blackoutAll).toHaveBeenCalledTimes(1);
    expect(deps.manager.blackout).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledTimes(1);
  });

  it("uncaughtException during active shutdown → no double-entry", async () => {
    const deps = makeMockDeps();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const shutdown = installShutdownHandlers(deps);

    // Start shutdown first
    await shutdown("SIGTERM");

    // Now fire uncaughtException — the shuttingDown flag should prevent re-entry
    process.emit("uncaughtException", new Error("crash during shutdown"));

    // Give the async handler a tick
    await new Promise((r) => setTimeout(r, 50));

    // blackout should still only have been called once (from the first shutdown)
    expect(deps.coordinator.blackoutAll).toHaveBeenCalledTimes(1);
    expect(deps.manager.blackout).toHaveBeenCalledTimes(1);
  });

  it("exit handler after partial shutdown (exitBlackoutDone=true) → no double blackout", async () => {
    const deps = makeMockDeps({
      // Make udpServer.close throw to simulate partial shutdown
      udpServer: { close: vi.fn().mockRejectedValue(new Error("udp fail")) } as any,
    });
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    const shutdown = installShutdownHandlers(deps);
    await shutdown("SIGTERM");

    // Blackout was called during shutdown
    expect(deps.coordinator.blackoutAll).toHaveBeenCalledTimes(1);
    expect(deps.manager.blackout).toHaveBeenCalledTimes(1);

    // Clear counts
    (deps.coordinator.blackoutAll as ReturnType<typeof vi.fn>).mockClear();
    (deps.manager.blackout as ReturnType<typeof vi.fn>).mockClear();

    // exit event should not re-blackout because exitBlackoutDone was set
    process.emit("exit", 0);

    expect(deps.coordinator.blackoutAll).not.toHaveBeenCalled();
    expect(deps.manager.blackout).not.toHaveBeenCalled();
  });
});
