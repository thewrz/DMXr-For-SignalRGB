/**
 * Pipeline logger — verbose DMX pipeline tracing for debugging
 * channel mapping, color processing, and DMX output issues.
 *
 * Levels: error < warn < info < debug < verbose
 * Set via PIPELINE_LOG env var (default: "verbose" for MVP debugging).
 *
 * Hot-path functions (mapColor, processColorBatch) use sampled logging
 * to avoid flooding the journal — logs first frame then every N seconds.
 */

export type PipelineLogLevel = "error" | "warn" | "info" | "debug" | "verbose";

const LEVEL_RANK: Record<PipelineLogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  verbose: 4,
};

const LEVEL_TAG: Record<PipelineLogLevel, string> = {
  error: "ERROR",
  warn: "WARN",
  info: "INFO",
  debug: "DEBUG",
  verbose: "TRACE",
};

let activeLevel: PipelineLogLevel = "verbose";

export function setPipelineLogLevel(level: PipelineLogLevel): void {
  activeLevel = level;
}

export function getPipelineLogLevel(): PipelineLogLevel {
  return activeLevel;
}

export function parsePipelineLogLevel(raw: string | undefined): PipelineLogLevel {
  const normalized = (raw ?? "verbose").toLowerCase().trim();
  if (normalized in LEVEL_RANK) {
    return normalized as PipelineLogLevel;
  }
  return "verbose";
}

function isEnabled(level: PipelineLogLevel): boolean {
  return LEVEL_RANK[level] <= LEVEL_RANK[activeLevel];
}

export function pipeLog(level: PipelineLogLevel, msg: string): void {
  if (!isEnabled(level)) return;
  process.stdout.write(`[PIPE:${LEVEL_TAG[level]}] ${msg}\n`);
}

// --- Sampled logging for hot paths ---

const sampleTimestamps = new Map<string, number>();

/**
 * Returns true if a sampled log with this key should fire now.
 * Fires on first call, then every `intervalMs` thereafter.
 */
export function shouldSample(
  key: string,
  intervalMs = 5000,
): boolean {
  if (!isEnabled("verbose")) return false;
  const now = Date.now();
  const last = sampleTimestamps.get(key);
  if (last === undefined || now - last >= intervalMs) {
    sampleTimestamps.set(key, now);
    return true;
  }
  return false;
}

/**
 * Force the next sampled log for a key to fire (e.g. after config change).
 */
export function resetSample(key: string): void {
  sampleTimestamps.delete(key);
}

/**
 * Reset all sample timers (e.g. on reconnect or resume).
 */
export function resetAllSamples(): void {
  sampleTimestamps.clear();
}
