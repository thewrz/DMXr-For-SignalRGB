import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  setPipelineLogLevel,
  getPipelineLogLevel,
  parsePipelineLogLevel,
  pipeLog,
  shouldSample,
  resetSample,
  resetAllSamples,
  type PipelineLogLevel,
} from "./pipeline-logger.js";

describe("pipeline-logger", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setPipelineLogLevel("verbose");
    resetAllSamples();
    writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    vi.restoreAllMocks();
  });

  // --- setPipelineLogLevel / getPipelineLogLevel ---

  it("sets and gets pipeline log level", () => {
    setPipelineLogLevel("warn");
    expect(getPipelineLogLevel()).toBe("warn");
  });

  it("defaults to verbose", () => {
    // reset was done in beforeEach
    expect(getPipelineLogLevel()).toBe("verbose");
  });

  // --- parsePipelineLogLevel ---

  it("parses known levels", () => {
    expect(parsePipelineLogLevel("error")).toBe("error");
    expect(parsePipelineLogLevel("warn")).toBe("warn");
    expect(parsePipelineLogLevel("info")).toBe("info");
    expect(parsePipelineLogLevel("debug")).toBe("debug");
    expect(parsePipelineLogLevel("verbose")).toBe("verbose");
  });

  it("normalizes case and whitespace", () => {
    expect(parsePipelineLogLevel("  DEBUG ")).toBe("debug");
    expect(parsePipelineLogLevel("WARN")).toBe("warn");
    expect(parsePipelineLogLevel("Info")).toBe("info");
  });

  it("returns verbose for undefined", () => {
    expect(parsePipelineLogLevel(undefined)).toBe("verbose");
  });

  it("returns verbose for unrecognised input", () => {
    expect(parsePipelineLogLevel("banana")).toBe("verbose");
    expect(parsePipelineLogLevel("")).toBe("verbose");
  });

  // --- pipeLog level filtering ---

  it("writes when level is enabled", () => {
    setPipelineLogLevel("info");
    pipeLog("error", "e");
    pipeLog("warn", "w");
    pipeLog("info", "i");

    expect(writeSpy).toHaveBeenCalledTimes(3);
    expect(writeSpy).toHaveBeenCalledWith("[PIPE:ERROR] e\n");
    expect(writeSpy).toHaveBeenCalledWith("[PIPE:WARN] w\n");
    expect(writeSpy).toHaveBeenCalledWith("[PIPE:INFO] i\n");
  });

  it("suppresses messages above the active level", () => {
    setPipelineLogLevel("warn");
    pipeLog("info", "should not appear");
    pipeLog("debug", "should not appear");
    pipeLog("verbose", "should not appear");

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("allows error through every level", () => {
    const levels: PipelineLogLevel[] = ["error", "warn", "info", "debug", "verbose"];
    for (const lvl of levels) {
      writeSpy.mockClear();
      setPipelineLogLevel(lvl);
      pipeLog("error", "always");
      expect(writeSpy).toHaveBeenCalledTimes(1);
    }
  });

  it("formats verbose messages with TRACE tag", () => {
    pipeLog("verbose", "trace msg");
    expect(writeSpy).toHaveBeenCalledWith("[PIPE:TRACE] trace msg\n");
  });

  // --- shouldSample ---

  it("fires on first call for a key", () => {
    expect(shouldSample("test-key")).toBe(true);
  });

  it("suppresses subsequent calls within interval", () => {
    shouldSample("key-a", 5000);
    expect(shouldSample("key-a", 5000)).toBe(false);
  });

  it("fires again after interval elapses", () => {
    vi.useFakeTimers();
    try {
      shouldSample("key-b", 1000);
      expect(shouldSample("key-b", 1000)).toBe(false);

      vi.advanceTimersByTime(1000);
      expect(shouldSample("key-b", 1000)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns false when verbose is disabled", () => {
    setPipelineLogLevel("info");
    expect(shouldSample("key-c")).toBe(false);
  });

  it("uses independent timers per key", () => {
    expect(shouldSample("k1")).toBe(true);
    expect(shouldSample("k2")).toBe(true);
    // k1 already fired, k2 already fired
    expect(shouldSample("k1")).toBe(false);
    expect(shouldSample("k2")).toBe(false);
  });

  // --- resetSample ---

  it("forces next sample to fire after reset", () => {
    shouldSample("r1");
    expect(shouldSample("r1")).toBe(false);

    resetSample("r1");
    expect(shouldSample("r1")).toBe(true);
  });

  it("is a no-op for unknown keys", () => {
    // should not throw
    resetSample("nonexistent");
  });

  // --- resetAllSamples ---

  it("resets all sample timers", () => {
    shouldSample("a1");
    shouldSample("a2");
    expect(shouldSample("a1")).toBe(false);
    expect(shouldSample("a2")).toBe(false);

    resetAllSamples();
    expect(shouldSample("a1")).toBe(true);
    expect(shouldSample("a2")).toBe(true);
  });
});
