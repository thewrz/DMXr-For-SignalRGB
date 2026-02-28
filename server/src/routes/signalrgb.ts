import type { FastifyInstance } from "fastify";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import {
  syncAllComponents,
  getComponentsDir,
  buildComponent,
} from "../signalrgb/component-writer.js";

interface SignalRgbRouteDeps {
  readonly store: FixtureStore;
}

export function registerSignalRgbRoutes(
  app: FastifyInstance,
  deps: SignalRgbRouteDeps,
): void {
  /** Sync all fixture components to SignalRGB's Components directory */
  app.post("/signalrgb/components/sync", async () => {
    const fixtures = deps.store.getAll();
    const paths = await syncAllComponents(fixtures);

    return {
      success: true,
      componentsDir: getComponentsDir(),
      synced: paths.length,
      fixtures: fixtures.map((f) => ({
        id: f.id,
        name: f.name,
        componentFile: paths[fixtures.indexOf(f)],
      })),
    };
  });

  /** Preview what component JSON would be generated for a fixture */
  app.get<{ Params: { id: string } }>(
    "/signalrgb/components/:id/preview",
    async (request, reply) => {
      const fixture = deps.store.getById(request.params.id);

      if (!fixture) {
        return reply.status(404).send({
          success: false,
          error: "Fixture not found",
        });
      }

      return buildComponent(fixture);
    },
  );
}
