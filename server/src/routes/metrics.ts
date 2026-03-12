import type { FastifyInstance, FastifyReply } from "fastify";
import type { LatencyTracker, LatencyMetrics } from "../metrics/latency-tracker.js";
import type { UdpColorServer } from "../udp/udp-color-server.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";

interface MetricsDeps {
  readonly latencyTracker: LatencyTracker;
  readonly udpServer?: UdpColorServer;
  readonly fixtureStore?: FixtureStore;
}

export function registerMetricsRoute(
  app: FastifyInstance,
  deps: MetricsDeps,
): void {
  app.get("/metrics", { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async () => {
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

  app.get("/metrics/prometheus", { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async (_req, reply: FastifyReply) => {
    const latency = deps.latencyTracker.getMetrics();
    const udpStats = deps.udpServer?.getStats();
    const fixtureCount = deps.fixtureStore?.getAll().length ?? 0;

    const lines = formatPrometheusMetrics(latency, udpStats, fixtureCount);
    return reply.type("text/plain; version=0.0.4; charset=utf-8").send(lines);
  });
}

function formatPrometheusMetrics(
  latency: LatencyMetrics,
  udpStats: { packetsReceived: number; packetsProcessed: number; parseErrors: number; sequenceGaps: number } | undefined,
  fixtureCount: number,
): string {
  const lines: string[] = [];

  // Latency metrics
  for (const [segment, stats] of Object.entries({
    network: latency.network,
    color_map: latency.colorMap,
    dmx_send: latency.dmxSend,
    total_processing: latency.totalProcessing,
  })) {
    lines.push(`# HELP dmxr_${segment}_latency_seconds ${segment.replace(/_/g, " ")} latency in seconds`);
    lines.push(`# TYPE dmxr_${segment}_latency_seconds summary`);
    lines.push(`dmxr_${segment}_latency_seconds{quantile="0.95"} ${(stats.p95 / 1000).toFixed(6)}`);
    lines.push(`dmxr_${segment}_latency_seconds{quantile="0.99"} ${(stats.p99 / 1000).toFixed(6)}`);
    lines.push(`dmxr_${segment}_latency_seconds_count ${stats.count}`);
  }

  // Packets per second
  lines.push("# HELP dmxr_packets_per_second current UDP packet processing rate");
  lines.push("# TYPE dmxr_packets_per_second gauge");
  lines.push(`dmxr_packets_per_second ${latency.packetsPerSecond}`);

  // UDP counters
  if (udpStats) {
    lines.push("# HELP dmxr_udp_packets_received_total total UDP packets received");
    lines.push("# TYPE dmxr_udp_packets_received_total counter");
    lines.push(`dmxr_udp_packets_received_total ${udpStats.packetsReceived}`);

    lines.push("# HELP dmxr_udp_packets_processed_total total UDP packets processed");
    lines.push("# TYPE dmxr_udp_packets_processed_total counter");
    lines.push(`dmxr_udp_packets_processed_total ${udpStats.packetsProcessed}`);

    lines.push("# HELP dmxr_udp_parse_errors_total total UDP parse errors");
    lines.push("# TYPE dmxr_udp_parse_errors_total counter");
    lines.push(`dmxr_udp_parse_errors_total ${udpStats.parseErrors}`);

    lines.push("# HELP dmxr_udp_sequence_gaps_total total UDP sequence gaps");
    lines.push("# TYPE dmxr_udp_sequence_gaps_total counter");
    lines.push(`dmxr_udp_sequence_gaps_total ${udpStats.sequenceGaps}`);
  }

  // Active fixtures gauge
  lines.push("# HELP dmxr_active_fixtures number of configured fixtures");
  lines.push("# TYPE dmxr_active_fixtures gauge");
  lines.push(`dmxr_active_fixtures ${fixtureCount}`);

  return lines.join("\n") + "\n";
}
