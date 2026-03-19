import { readFile, writeFile, readdir, unlink, mkdir, rename, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface CacheResult {
  readonly data: unknown;
  readonly stale: boolean;
}

export interface CacheStats {
  readonly entryCount: number;
  readonly totalSize: number;
}

export interface OflDiskCache {
  readonly get: (key: string) => Promise<CacheResult | undefined>;
  readonly set: (key: string, data: unknown, ttlMs?: number) => Promise<void>;
  readonly clear: () => Promise<void>;
  readonly getStats: () => Promise<CacheStats>;
  readonly keys: () => Promise<readonly string[]>;
}

export interface OflDiskCacheOptions {
  readonly cacheDir?: string;
  readonly defaultTtlMs?: number;
}

interface CacheEnvelope {
  readonly data: unknown;
  readonly cachedAt: string;
  readonly ttlMs: number;
}

const DEFAULT_CACHE_DIR = "./config/ofl-cache";
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function keyToFilename(key: string): string {
  return key.replace(/:/g, "_").replace(/\//g, "__") + ".json";
}

function filenameToKey(filename: string): string {
  return filename
    .replace(/\.json$/, "")
    .replace(/__/g, "/")
    .replace(/_/g, ":");
}

function safeCachePath(cacheDir: string, filename: string): string {
  const filePath = join(cacheDir, filename);
  const resolved = resolve(filePath);
  if (!resolved.startsWith(resolve(cacheDir) + "/") && resolved !== resolve(cacheDir)) {
    throw new Error("Cache key resolves outside cache directory");
  }
  return filePath;
}

async function safeReaddir(dir: string): Promise<readonly string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
}

export function createOflDiskCache(options: OflDiskCacheOptions = {}): OflDiskCache {
  const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR;
  const defaultTtlMs = options.defaultTtlMs ?? DEFAULT_TTL_MS;

  return {
    async get(key: string): Promise<CacheResult | undefined> {
      try {
        const filePath = safeCachePath(cacheDir, keyToFilename(key));
        const raw = await readFile(filePath, "utf-8");
        const envelope: unknown = JSON.parse(raw);

        if (
          typeof envelope !== "object" ||
          envelope === null ||
          !("data" in envelope) ||
          !("cachedAt" in envelope) ||
          !("ttlMs" in envelope)
        ) {
          return undefined;
        }

        const { data, cachedAt, ttlMs } = envelope as CacheEnvelope;
        const age = Date.now() - new Date(cachedAt).getTime();
        const stale = age > ttlMs;

        return { data, stale };
      } catch {
        return undefined;
      }
    },

    async set(key: string, data: unknown, ttlMs?: number): Promise<void> {
      await mkdir(cacheDir, { recursive: true });

      const envelope: CacheEnvelope = {
        data,
        cachedAt: new Date().toISOString(),
        ttlMs: ttlMs ?? defaultTtlMs,
      };

      const filePath = safeCachePath(cacheDir, keyToFilename(key));
      const tmpPath = filePath + ".tmp";
      await writeFile(tmpPath, JSON.stringify(envelope, null, 2), "utf-8");
      await rename(tmpPath, filePath);
    },

    async clear(): Promise<void> {
      const files = await safeReaddir(cacheDir);

      await Promise.all(
        files.map((f) => unlink(join(cacheDir, f)).catch(() => undefined)),
      );
    },

    async getStats(): Promise<CacheStats> {
      const files = await safeReaddir(cacheDir);

      if (files.length === 0) {
        return { entryCount: 0, totalSize: 0 };
      }

      let totalSize = 0;
      for (const f of files) {
        try {
          const s = await stat(join(cacheDir, f));
          totalSize += s.size;
        } catch {
          // file may have been removed between readdir and stat
        }
      }

      return { entryCount: files.length, totalSize };
    },

    async keys(): Promise<readonly string[]> {
      const files = await safeReaddir(cacheDir);
      return files.map(filenameToKey);
    },
  };
}
