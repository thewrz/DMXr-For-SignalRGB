/**
 * Rolling latency statistics using a circular buffer.
 * Tracks each segment of the pipeline independently.
 */

const DEFAULT_BUFFER_SIZE = 1000;

interface RollingStats {
  readonly min: number;
  readonly avg: number;
  readonly p95: number;
  readonly p99: number;
  readonly count: number;
}

function createCircularBuffer(size: number) {
  const buffer = new Float64Array(size);
  let head = 0;
  let count = 0;

  return {
    push(value: number): void {
      buffer[head] = value;
      head = (head + 1) % size;
      if (count < size) count++;
    },

    stats(): RollingStats {
      if (count === 0) {
        return { min: 0, avg: 0, p95: 0, p99: 0, count: 0 };
      }

      // Copy active entries and sort
      const active = new Float64Array(count);
      const start = count < size ? 0 : head;
      for (let i = 0; i < count; i++) {
        active[i] = buffer[(start + i) % size];
      }
      active.sort();

      const sum = active.reduce((a, b) => a + b, 0);

      return {
        min: active[0],
        avg: sum / count,
        p95: active[Math.floor(count * 0.95)],
        p99: active[Math.floor(count * 0.99)],
        count,
      };
    },

    reset(): void {
      head = 0;
      count = 0;
    },
  };
}

export interface LatencyMetrics {
  readonly network: RollingStats;
  readonly colorMap: RollingStats;
  readonly dmxSend: RollingStats;
  readonly totalProcessing: RollingStats;
  readonly packetsPerSecond: number;
}

export interface LatencyTracker {
  readonly recordNetwork: (ms: number) => void;
  readonly recordColorMap: (ms: number) => void;
  readonly recordDmxSend: (ms: number) => void;
  readonly recordProcessed: (receiveTimestamp: number) => void;
  readonly getMetrics: () => LatencyMetrics;
  readonly reset: () => void;
}

export function createLatencyTracker(
  bufferSize: number = DEFAULT_BUFFER_SIZE,
): LatencyTracker {
  const networkBuf = createCircularBuffer(bufferSize);
  const colorMapBuf = createCircularBuffer(bufferSize);
  const dmxSendBuf = createCircularBuffer(bufferSize);
  const totalBuf = createCircularBuffer(bufferSize);

  // Packets-per-second tracking
  let ppsCount = 0;
  let ppsWindowStart = performance.now();
  let currentPps = 0;

  function updatePps(): void {
    const now = performance.now();
    const elapsed = now - ppsWindowStart;

    if (elapsed >= 1000) {
      currentPps = ppsCount / (elapsed / 1000);
      ppsCount = 0;
      ppsWindowStart = now;
    }
  }

  return {
    recordNetwork(ms: number): void {
      networkBuf.push(ms);
    },

    recordColorMap(ms: number): void {
      colorMapBuf.push(ms);
    },

    recordDmxSend(ms: number): void {
      dmxSendBuf.push(ms);
    },

    recordProcessed(receiveTimestamp: number): void {
      const total = performance.now() - receiveTimestamp;
      totalBuf.push(total);
      ppsCount++;
      updatePps();
    },

    getMetrics(): LatencyMetrics {
      updatePps();
      return {
        network: networkBuf.stats(),
        colorMap: colorMapBuf.stats(),
        dmxSend: dmxSendBuf.stats(),
        totalProcessing: totalBuf.stats(),
        packetsPerSecond: Math.round(currentPps * 10) / 10,
      };
    },

    reset(): void {
      networkBuf.reset();
      colorMapBuf.reset();
      dmxSendBuf.reset();
      totalBuf.reset();
      ppsCount = 0;
      ppsWindowStart = performance.now();
      currentPps = 0;
    },
  };
}
