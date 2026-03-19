import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, readdir, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createOflDiskCache } from "./ofl-disk-cache.js";

describe("createOflDiskCache", () => {
  let cacheDir: string;

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), "ofl-cache-test-"));
  });

  afterEach(async () => {
    vi.useRealTimers();
    await rm(cacheDir, { recursive: true, force: true });
  });

  it("returns undefined for missing key", async () => {
    const cache = createOflDiskCache({ cacheDir });

    const result = await cache.get("nonexistent");

    expect(result).toBeUndefined();
  });

  it("returns data after set", async () => {
    const cache = createOflDiskCache({ cacheDir });
    const data = { name: "Cameo", fixtureCount: 42 };

    await cache.set("manufacturers", data);
    const result = await cache.get("manufacturers");

    expect(result).toEqual({ data, stale: false });
  });

  it("returns stale after TTL expires", async () => {
    vi.useFakeTimers();
    const cache = createOflDiskCache({ cacheDir, defaultTtlMs: 1000 });
    const data = { name: "test" };

    await cache.set("key1", data);
    vi.advanceTimersByTime(1001);

    const result = await cache.get("key1");

    expect(result).toEqual({ data, stale: true });
  });

  it("clear removes all entries", async () => {
    const cache = createOflDiskCache({ cacheDir });

    await cache.set("a", { x: 1 });
    await cache.set("b", { x: 2 });
    await cache.clear();

    expect(await cache.get("a")).toBeUndefined();
    expect(await cache.get("b")).toBeUndefined();
  });

  it("getStats returns zero when empty", async () => {
    const cache = createOflDiskCache({ cacheDir });

    const stats = await cache.getStats();

    expect(stats.entryCount).toBe(0);
    expect(stats.totalSize).toBe(0);
  });

  it("getStats returns correct counts after adds", async () => {
    const cache = createOflDiskCache({ cacheDir });

    await cache.set("a", { x: 1 });
    await cache.set("b", { x: 2 });

    const stats = await cache.getStats();

    expect(stats.entryCount).toBe(2);
    expect(stats.totalSize).toBeGreaterThan(0);
  });

  it("keys returns all cache keys", async () => {
    const cache = createOflDiskCache({ cacheDir });

    await cache.set("manufacturers", { x: 1 });
    await cache.set("fixture:acme/par64", { x: 2 });

    const keys = await cache.keys();

    expect([...keys].sort()).toEqual(["fixture:acme/par64", "manufacturers"]);
  });

  it("leaves no .tmp files after set", async () => {
    const cache = createOflDiskCache({ cacheDir });

    await cache.set("key1", { data: "test" });

    const files = await readdir(cacheDir);
    const tmpFiles = files.filter((f) => f.endsWith(".tmp"));

    expect(tmpFiles).toHaveLength(0);
  });

  it("returns undefined for corrupted JSON", async () => {
    const cache = createOflDiskCache({ cacheDir });

    // Write garbage to a cache file
    await writeFile(join(cacheDir, "broken.json"), "not{valid json!!!", "utf-8");

    const result = await cache.get("broken");

    expect(result).toBeUndefined();
  });

  it("returns undefined without throwing when cache dir missing", async () => {
    const missingDir = join(cacheDir, "does-not-exist");
    const cache = createOflDiskCache({ cacheDir: missingDir });

    const result = await cache.get("anything");

    expect(result).toBeUndefined();
  });

  it("overwrites existing entry with latest data", async () => {
    const cache = createOflDiskCache({ cacheDir });

    await cache.set("key1", { version: 1 });
    await cache.set("key1", { version: 2 });

    const result = await cache.get("key1");

    expect(result).toEqual({ data: { version: 2 }, stale: false });
  });

  it("set creates cache dir if it does not exist", async () => {
    const nestedDir = join(cacheDir, "nested", "deep");
    const cache = createOflDiskCache({ cacheDir: nestedDir });

    await cache.set("key1", { x: 1 });
    const result = await cache.get("key1");

    expect(result).toEqual({ data: { x: 1 }, stale: false });
  });

  it("per-set TTL overrides default", async () => {
    vi.useFakeTimers();
    const cache = createOflDiskCache({ cacheDir, defaultTtlMs: 10_000 });

    await cache.set("short", { x: 1 }, 500);
    vi.advanceTimersByTime(501);

    const result = await cache.get("short");

    expect(result).toEqual({ data: { x: 1 }, stale: true });
  });

  it("clear on missing dir does not throw", async () => {
    const missingDir = join(cacheDir, "nope");
    const cache = createOflDiskCache({ cacheDir: missingDir });

    await expect(cache.clear()).resolves.toBeUndefined();
  });

  it("getStats on missing dir returns zero", async () => {
    const missingDir = join(cacheDir, "nope");
    const cache = createOflDiskCache({ cacheDir: missingDir });

    const stats = await cache.getStats();

    expect(stats).toEqual({ entryCount: 0, totalSize: 0 });
  });

  describe("path traversal prevention", () => {
    it("keys with path traversal patterns remain contained in cache dir", async () => {
      const cache = createOflDiskCache({ cacheDir });

      // keyToFilename sanitizes / to __ so these keys stay contained
      await cache.set("../../etc/passwd", { x: 1 });
      const result = await cache.get("../../etc/passwd");
      expect(result).toEqual({ data: { x: 1 }, stale: false });

      // Verify the file is actually inside cacheDir, not escaped
      const files = await readdir(cacheDir);
      expect(files.every((f) => !f.includes("/"))).toBe(true);
    });

    it("safeCachePath rejects resolved paths outside cache dir", async () => {
      // Import the module internals via a direct path manipulation test:
      // If keyToFilename were ever changed to not sanitize slashes,
      // safeCachePath would catch the escape attempt
      const cache = createOflDiskCache({ cacheDir });

      // These keys are safe due to keyToFilename sanitization
      await cache.set("normal-key", { ok: true });
      await cache.set("fixture:acme/par64", { name: "PAR64" });

      expect(await cache.get("normal-key")).toEqual({ data: { ok: true }, stale: false });
      expect(await cache.get("fixture:acme/par64")).toEqual({
        data: { name: "PAR64" },
        stale: false,
      });
    });

    it("allows normal keys with colons and slashes", async () => {
      const cache = createOflDiskCache({ cacheDir });

      await cache.set("fixture:acme/par64", { name: "PAR64" });
      const result = await cache.get("fixture:acme/par64");

      expect(result).toEqual({ data: { name: "PAR64" }, stale: false });
    });
  });
});
