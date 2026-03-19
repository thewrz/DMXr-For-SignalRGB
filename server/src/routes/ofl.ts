import type { FastifyInstance } from "fastify";
import type { OflClient } from "../ofl/ofl-client.js";
import type { LogBuffer, LogLevel } from "../logging/log-buffer.js";

const SAFE_KEY_PATTERN = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;

interface OflRouteDeps {
  readonly oflClient: OflClient;
  readonly logBuffer?: LogBuffer;
}

function isValidKey(key: string): boolean {
  return SAFE_KEY_PATTERN.test(key) && key.length <= 100;
}

interface OflErrorResult {
  readonly status: number;
  readonly message: string;
  readonly logDetail: string;
  readonly logLevel: LogLevel;
}

function classifyOflError(error: unknown): OflErrorResult {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (lower.includes("not found") || lower.includes("manufacturer not found")) {
    return { status: 404, message: raw, logDetail: raw, logLevel: "warn" };
  }
  if (lower.includes("econnrefused") || lower.includes("econnreset") || lower.includes("etimedout")) {
    return { status: 502, message: "Could not connect to the fixture library — check that the server has internet access", logDetail: `Connection error: ${raw}`, logLevel: "error" };
  }
  if (lower.includes("enotfound") || lower.includes("getaddrinfo")) {
    return { status: 502, message: "Could not connect to the fixture library — DNS lookup failed (no internet?)", logDetail: `DNS resolution failed: ${raw}`, logLevel: "error" };
  }
  if (lower.includes("fetch failed")) {
    return { status: 502, message: "Could not connect to the fixture library — the server may not have internet access", logDetail: `Fetch failed: ${raw}`, logLevel: "error" };
  }
  if (lower.includes("ofl api error")) {
    return { status: 502, message: "The fixture library (open-fixture-library.org) is having issues — try again later", logDetail: `Upstream OFL API error: ${raw}`, logLevel: "error" };
  }
  return { status: 503, message: "Fixture library temporarily unavailable — try again in a moment", logDetail: `Unexpected OFL error: ${raw}`, logLevel: "error" };
}

export function registerOflRoutes(
  app: FastifyInstance,
  deps: OflRouteDeps,
): void {
  app.get("/ofl/manufacturers", async (request, reply) => {
    try {
      return await deps.oflClient.getManufacturers();
    } catch (error) {
      const { status, message, logDetail, logLevel } = classifyOflError(error);
      request.log.error({ err: error, detail: logDetail }, "OFL manufacturers fetch failed");
      deps.logBuffer?.push({
        timestamp: new Date().toISOString(),
        level: logLevel,
        source: "api",
        message,
        details: { endpoint: "/ofl/manufacturers", logDetail },
      });
      return reply.status(status).send({ error: message });
    }
  });

  app.get<{ Params: { key: string } }>(
    "/ofl/manufacturers/:key",
    async (request, reply) => {
      if (!isValidKey(request.params.key)) {
        return reply.status(400).send({ error: "Invalid manufacturer key" });
      }

      try {
        return await deps.oflClient.getManufacturerFixtures(
          request.params.key,
        );
      } catch (error) {
        const { status, message, logDetail, logLevel } = classifyOflError(error);
        request.log.error({ err: error, key: request.params.key, detail: logDetail }, "OFL manufacturer lookup failed");
        deps.logBuffer?.push({
          timestamp: new Date().toISOString(),
          level: logLevel,
          source: "api",
          message,
          details: { endpoint: `/ofl/manufacturers/${request.params.key}`, logDetail },
        });
        return reply.status(status).send({ error: message });
      }
    },
  );

  app.get<{ Params: { mfr: string; model: string } }>(
    "/ofl/fixture/:mfr/:model",
    async (request, reply) => {
      if (!isValidKey(request.params.mfr) || !isValidKey(request.params.model)) {
        return reply.status(400).send({ error: "Invalid manufacturer or model key" });
      }

      try {
        return await deps.oflClient.getFixture(
          request.params.mfr,
          request.params.model,
        );
      } catch (error) {
        const { status, message, logDetail, logLevel } = classifyOflError(error);
        request.log.error({ err: error, mfr: request.params.mfr, model: request.params.model, detail: logDetail }, "OFL fixture lookup failed");
        deps.logBuffer?.push({
          timestamp: new Date().toISOString(),
          level: logLevel,
          source: "api",
          message,
          details: { endpoint: `/ofl/fixture/${request.params.mfr}/${request.params.model}`, logDetail },
        });
        return reply.status(status).send({ error: message });
      }
    },
  );
}
