import type { FastifyInstance } from "fastify";
import type { OflDiskCache } from "../ofl/ofl-disk-cache.js";

interface OflCacheRouteDeps {
  readonly diskCache: OflDiskCache;
}

export function registerOflCacheRoutes(
  app: FastifyInstance,
  deps: OflCacheRouteDeps,
): void {
  app.get("/api/settings/ofl-cache", async () => {
    return deps.diskCache.getStats();
  });

  app.post("/api/settings/ofl-cache/clear", async () => {
    await deps.diskCache.clear();
    return { success: true };
  });
}
