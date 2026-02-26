import type { FastifyInstance } from "fastify";
import type { OflClient } from "../ofl/ofl-client.js";

const SAFE_KEY_PATTERN = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;

interface OflRouteDeps {
  readonly oflClient: OflClient;
}

function isValidKey(key: string): boolean {
  return SAFE_KEY_PATTERN.test(key) && key.length <= 100;
}

export function registerOflRoutes(
  app: FastifyInstance,
  deps: OflRouteDeps,
): void {
  app.get("/ofl/manufacturers", async () => {
    return deps.oflClient.getManufacturers();
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
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return reply.status(404).send({ error: message });
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
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return reply.status(404).send({ error: message });
      }
    },
  );
}
