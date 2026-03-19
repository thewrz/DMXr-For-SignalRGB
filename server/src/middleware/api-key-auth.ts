import type { FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";

const API_PREFIXES = [
  "/fixtures",
  "/update",
  "/control",
  "/ofl",
  "/libraries",
  "/search",
  "/signalrgb",
  "/debug",
];

function isApiRoute(url: string): boolean {
  return API_PREFIXES.some((prefix) => url.startsWith(prefix));
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
    if (request.url === "/health" || !isApiRoute(request.url)) {
      return;
    }

    const provided = request.headers["x-api-key"];
    if (typeof provided !== "string" || !keysMatch(provided, apiKey)) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });
}
