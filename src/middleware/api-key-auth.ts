import type { FastifyInstance } from "fastify";

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

export function registerApiKeyAuth(
  app: FastifyInstance,
  apiKey: string,
): void {
  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/health" || !isApiRoute(request.url)) {
      return;
    }

    const provided = request.headers["x-api-key"];
    if (provided !== apiKey) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });
}
