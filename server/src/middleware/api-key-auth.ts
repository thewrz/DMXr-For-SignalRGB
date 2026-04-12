import type { FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";

// AUTH-C1: Fail-closed auth. Everything requires `x-api-key` EXCEPT the
// explicit public exemptions below. Previously this module used a prefix
// allowlist and returned early on any URL not in the list, which meant
// ~60% of state-mutating routes (settings, universes, groups, config,
// metrics, logs, diagnostics, SSE streams) were unauthenticated.
//
// Public exemptions must be strictly enumerated and minimal:
//   - `/health`           — operator liveness probe
//   - `/favicon.ico`      — browser chrome; no security implications
//   - `/` (static root)   — Alpine.js SPA entry (public by design; sensitive
//                            actions require an API key from the same UI)
//   - `/css/`, `/js/`,
//     `/images/`          — static assets served by @fastify/static
const PUBLIC_EXEMPT_PATHS: ReadonlySet<string> = new Set([
  "/",
  "/health",
  "/favicon.ico",
]);

const PUBLIC_EXEMPT_PREFIXES: readonly string[] = [
  "/css/",
  "/js/",
  "/images/",
];

export function isPublicRoute(url: string): boolean {
  const path = url.split("?", 1)[0] ?? url;
  if (PUBLIC_EXEMPT_PATHS.has(path)) return true;
  return PUBLIC_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function keysMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided, "utf-8");
  const expectedBuf = Buffer.from(expected, "utf-8");
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}

export function registerApiKeyAuth(
  app: FastifyInstance,
  apiKey: string,
): void {
  app.addHook("onRequest", async (request, reply) => {
    if (isPublicRoute(request.url)) {
      return;
    }

    const provided = request.headers["x-api-key"];
    if (typeof provided !== "string" || !keysMatch(provided, apiKey)) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });
}
