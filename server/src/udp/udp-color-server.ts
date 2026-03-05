import { createSocket, type Socket } from "node:dgram";
import { parseColorPacket, isParseError, FLAG_BLACKOUT, FLAG_PING, encodeColorPacket } from "./packet-parser.js";
import { processColorBatch, processColorBatchMulti, type ColorEntry } from "../fixtures/color-pipeline.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { UniverseManager } from "../dmx/universe-manager.js";
import type { MultiUniverseCoordinator } from "../dmx/multi-universe-coordinator.js";
import type { LatencyTracker } from "../metrics/latency-tracker.js";
import { pipeLog, shouldSample } from "../logging/pipeline-logger.js";

export interface UdpColorServerDeps {
  readonly fixtureStore: FixtureStore;
  readonly manager: UniverseManager;
  readonly coordinator?: MultiUniverseCoordinator;
  readonly latencyTracker?: LatencyTracker;
  readonly logger?: {
    readonly info: (msg: string) => void;
    readonly warn: (msg: string) => void;
    readonly error: (msg: string) => void;
  };
}

export interface UdpColorServerStats {
  readonly packetsReceived: number;
  readonly packetsProcessed: number;
  readonly parseErrors: number;
  readonly lastSequence: number;
  readonly sequenceGaps: number;
}

export interface UdpColorServer {
  readonly start: (port: number, host?: string) => Promise<number>;
  readonly close: () => Promise<void>;
  readonly getStats: () => UdpColorServerStats;
  readonly getPort: () => number;
}

export function createUdpColorServer(deps: UdpColorServerDeps): UdpColorServer {
  let socket: Socket | null = null;
  let boundPort = 0;
  let packetsReceived = 0;
  let packetsProcessed = 0;
  let parseErrors = 0;
  let lastSequence = -1;
  let sequenceGaps = 0;

  return {
    start(port: number, host = "0.0.0.0"): Promise<number> {
      return new Promise((resolve, reject) => {
        const sock = createSocket("udp4");
        socket = sock;

        sock.on("error", (err) => {
          deps.logger?.error(`UDP server error: ${err.message}`);
          reject(err);
        });

        sock.on("message", (msg, rinfo) => {
          packetsReceived++;
          const receiveTime = performance.now();

          const packet = parseColorPacket(msg);

          if (isParseError(packet)) {
            parseErrors++;
            deps.logger?.warn(`UDP parse error from ${rinfo.address}:${rinfo.port}: ${packet.error}`);
            return;
          }

          // Sequence gap detection — track high-water mark.
          // The plugin shares one sequence counter across all fixtures,
          // so packets from different fixtures arrive interleaved.
          // Only count a gap when the sequence jumps backward beyond
          // normal uint16 wraparound (a true lost-packet signal).
          if (lastSequence >= 0) {
            const diff = (packet.sequence - lastSequence + 0x10000) & 0xffff;
            // diff=0 means duplicate, diff > 0x8000 means old/reordered packet
            if (diff > 0x8000) {
              sequenceGaps++;
            }
          }
          if (lastSequence < 0 || ((packet.sequence - lastSequence + 0x10000) & 0xffff) <= 0x8000) {
            lastSequence = packet.sequence;
          }

          // Record network latency (plugin timestamp → server receive)
          if (deps.latencyTracker && packet.timestamp > 0) {
            const networkMs = Date.now() - packet.timestamp;
            deps.latencyTracker.recordNetwork(networkMs);
          }

          // Handle blackout flag
          if (packet.flags & FLAG_BLACKOUT) {
            pipeLog("info", `UDP BLACKOUT packet from ${rinfo.address}:${rinfo.port} seq=${packet.sequence}`);
            if (deps.coordinator) {
              deps.coordinator.blackoutAll();
            } else {
              deps.manager.blackout();
            }
            packetsProcessed++;
            return;
          }

          // Handle ping flag — echo the packet back
          if (packet.flags & FLAG_PING) {
            pipeLog("debug", `UDP PING from ${rinfo.address}:${rinfo.port} seq=${packet.sequence}`);
            const reply = encodeColorPacket({
              ...packet,
              flags: packet.flags & ~FLAG_PING,
            });
            sock.send(reply, rinfo.port, rinfo.address);
          }

          // Skip color processing while override (blackout/whiteout) is active.
          // When coordinator is available, defer blackout enforcement to per-universe
          // managers inside processColorBatchMulti rather than doing a single check here.
          if (!deps.coordinator && deps.manager.isBlackoutActive()) {
            if (shouldSample("udp:blackout-skip")) {
              pipeLog("debug", "UDP packet skipped (blackout active)");
            }
            packetsProcessed++;
            return;
          }

          // Map fixture entries to ColorEntry format
          const entries: ColorEntry[] = packet.fixtures.map((f) => ({
            fixtureIndex: f.index,
            r: f.r,
            g: f.g,
            b: f.b,
            brightness: f.brightness / 255,
          }));

          if (shouldSample("udp:packet")) {
            const fixtureList = packet.fixtures
              .map((f) => `idx=${f.index} rgb=(${f.r},${f.g},${f.b}) br=${f.brightness}`)
              .join("; ");
            pipeLog(
              "verbose",
              `UDP packet seq=${packet.sequence} flags=0x${packet.flags.toString(16).padStart(2, "0")} ` +
              `${packet.fixtures.length} fixtures: ${fixtureList}`,
            );
          }

          const mapStart = performance.now();
          const result = deps.coordinator
            ? processColorBatchMulti(entries, deps.fixtureStore, deps.coordinator)
            : processColorBatch(entries, deps.fixtureStore, deps.manager);
          const mapDuration = performance.now() - mapStart;

          if (deps.latencyTracker) {
            deps.latencyTracker.recordColorMap(mapDuration);
          }

          deps.latencyTracker?.recordProcessed(receiveTime);

          packetsProcessed++;

          if (result.fixturesMatched === 0 && packet.fixtures.length > 0) {
            deps.logger?.warn(
              `UDP color update matched 0/${packet.fixtures.length} fixtures (seq=${packet.sequence})`,
            );
          }
        });

        sock.bind(port, host, () => {
          const addr = sock.address();
          boundPort = addr.port;
          deps.logger?.info(`UDP color server listening on ${host}:${boundPort}`);
          resolve(boundPort);
        });
      });
    },

    close(): Promise<void> {
      return new Promise((resolve) => {
        if (socket === null) {
          resolve();
          return;
        }
        socket.close(() => {
          socket = null;
          resolve();
        });
      });
    },

    getPort(): number {
      return boundPort;
    },

    getStats(): UdpColorServerStats {
      return {
        packetsReceived,
        packetsProcessed,
        parseErrors,
        lastSequence,
        sequenceGaps,
      };
    },
  };
}
