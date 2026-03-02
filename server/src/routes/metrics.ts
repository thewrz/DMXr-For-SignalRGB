import type { FastifyInstance } from "fastify";
import type { LatencyTracker } from "../metrics/latency-tracker.js";
import type { UdpColorServer } from "../udp/udp-color-server.js";

interface MetricsDeps {
  readonly latencyTracker: LatencyTracker;
  readonly udpServer?: UdpColorServer;
}

export function registerMetricsRoute(
  app: FastifyInstance,
  deps: MetricsDeps,
): void {
  app.get("/metrics", async () => {
    const latency = deps.latencyTracker.getMetrics();
    const udpStats = deps.udpServer?.getStats();

    return {
      latency,
      udp: udpStats
        ? {
            packetsReceived: udpStats.packetsReceived,
            packetsProcessed: udpStats.packetsProcessed,
            parseErrors: udpStats.parseErrors,
            sequenceGaps: udpStats.sequenceGaps,
            lastSequence: udpStats.lastSequence,
          }
        : null,
    };
  });
}
