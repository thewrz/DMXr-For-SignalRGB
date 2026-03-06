import type { FastifyInstance } from "fastify";
import type { HealthResponse, UniverseConfig } from "../types/protocol.js";
import type { UniverseManager } from "../dmx/universe-manager.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { ConnectionStatus } from "../dmx/connection-state.js";
import type { LatencyTracker } from "../metrics/latency-tracker.js";
import type { UdpColorServer } from "../udp/udp-color-server.js";
import type { MultiUniverseCoordinator } from "../dmx/multi-universe-coordinator.js";
import { resolveAddress } from "../fixtures/channel-remap.js";

interface UniverseStatusProvider {
  readonly getUniverseConfigs: () => readonly UniverseConfig[];
  readonly getConnectionStatuses: () => ReadonlyMap<string, ConnectionStatus>;
  readonly coordinator: MultiUniverseCoordinator;
}

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
  readonly universeStatus?: UniverseStatusProvider;
}

export function registerHealthRoute(
  app: FastifyInstance,
  deps: HealthDeps,
): void {
  app.get("/health", async (): Promise<HealthResponse> => {
    const dmxStatus = deps.manager.getDmxSendStatus();
    const connStatus = deps.getConnectionStatus?.();

    // Build per-universe status if provider is available
    let universeStatuses: HealthResponse["universes"] | undefined;
    if (deps.universeStatus) {
      const configs = deps.universeStatus.getUniverseConfigs();
      const statuses = deps.universeStatus.getConnectionStatuses();
      universeStatuses = configs.map((config) => {
        const uniStatus = statuses.get(config.id);
        return {
          id: config.id,
          name: config.name,
          state: uniStatus?.state ?? "disconnected" as const,
          activeChannels: deps.universeStatus!.coordinator.getActiveChannelCount(config.id),
        };
      });
    }

    const anyUniverseDegraded = universeStatuses?.some((u) => u.state !== "connected") ?? false;

    const isDegraded =
      dmxStatus.lastSendError !== null ||
      (connStatus !== undefined && connStatus.state !== "connected") ||
      anyUniverseDegraded;

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
      controlMode: deps.manager.getControlMode(),
      latencyAvgMs: latency !== undefined
        ? Math.round((latency.totalProcessing.avg) * 100) / 100
        : undefined,
      serverId: deps.serverId,
      serverName: deps.serverName,
      universes: universeStatuses,
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
          channels: f.channels.map((ch) => {
            const addr = resolveAddress(f, ch.offset);
            return {
              offset: ch.offset,
              name: ch.name,
              type: ch.type,
              color: ch.color,
              dmxAddr: addr,
              value: snapshot[addr] ?? 0,
            };
          }),
        };
      }),
    };
  });
}
