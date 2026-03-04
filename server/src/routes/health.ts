import type { FastifyInstance } from "fastify";
import type { HealthResponse } from "../types/protocol.js";
import type { UniverseManager } from "../dmx/universe-manager.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { ConnectionStatus } from "../dmx/connection-state.js";
import type { LatencyTracker } from "../metrics/latency-tracker.js";
import type { UdpColorServer } from "../udp/udp-color-server.js";

interface HealthDeps {
  readonly manager: UniverseManager;
  readonly driver: string;
  readonly startTime: number;
  readonly fixtureStore?: FixtureStore;
  readonly getConnectionStatus?: () => ConnectionStatus;
  readonly serverVersion?: string;
  readonly dmxDevicePath?: string;
  readonly latencyTracker?: LatencyTracker;
  readonly udpServer?: UdpColorServer;
  readonly serverId?: string;
  readonly serverName?: string;
}

export function registerHealthRoute(
  app: FastifyInstance,
  deps: HealthDeps,
): void {
  app.get("/health", async (): Promise<HealthResponse> => {
    const dmxStatus = deps.manager.getDmxSendStatus();
    const connStatus = deps.getConnectionStatus?.();

    const isDegraded =
      dmxStatus.lastSendError !== null ||
      (connStatus !== undefined && connStatus.state !== "connected");

    const udpStats = deps.udpServer?.getStats();
    const latency = deps.latencyTracker?.getMetrics();

    return {
      status: isDegraded ? "degraded" : "ok",
      driver: deps.driver,
      activeChannels: deps.manager.getActiveChannelCount(),
      uptime: Math.round((Date.now() - deps.startTime) / 1000),
      lastDmxSendTime: dmxStatus.lastSendTime,
      lastDmxSendError: dmxStatus.lastSendError,
      connectionState: connStatus?.state,
      reconnectAttempts: connStatus?.reconnectAttempts,
      version: deps.serverVersion,
      dmxDevicePath: deps.dmxDevicePath,
      lastErrorTitle: connStatus?.lastErrorTitle ?? undefined,
      lastErrorSuggestion: connStatus?.lastErrorSuggestion ?? undefined,
      udpActive: udpStats !== undefined ? udpStats.packetsReceived > 0 : undefined,
      udpPacketsReceived: udpStats?.packetsReceived,
      udpPort: deps.udpServer?.getPort() || undefined,
      latencyAvgMs: latency !== undefined
        ? Math.round((latency.totalProcessing.avg) * 100) / 100
        : undefined,
      serverId: deps.serverId,
      serverName: deps.serverName,
    };
  });

  app.get("/debug/dmx", async () => {
    const store = deps.fixtureStore;
    if (!store) {
      return { fixtures: [] };
    }

    const fixtures = store.getAll();
    return {
      fixtures: fixtures.map((f) => {
        const snapshot = deps.manager.getChannelSnapshot(
          f.dmxStartAddress,
          f.channelCount,
        );
        return {
          id: f.id,
          name: f.name,
          dmxStart: f.dmxStartAddress,
          channels: f.channels.map((ch) => ({
            offset: ch.offset,
            name: ch.name,
            type: ch.type,
            color: ch.color,
            dmxAddr: f.dmxStartAddress + ch.offset,
            value: snapshot[f.dmxStartAddress + ch.offset] ?? 0,
          })),
        };
      }),
    };
  });
}
