import type { FastifyInstance } from "fastify";
import type { UniverseManager } from "../dmx/universe-manager.js";
import type { MultiUniverseCoordinator } from "../dmx/multi-universe-coordinator.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import { createDmxDispatcher } from "../dmx/dmx-dispatcher.js";
import { registerControlModeRoutes } from "./control-modes.js";
import { registerFixtureTestRoutes } from "./fixture-test.js";
import { registerFixtureResetRoutes } from "./fixture-reset.js";
import { registerDebugRoutes } from "./debug.js";

interface ControlRouteDeps {
  readonly manager: UniverseManager;
  readonly store: FixtureStore;
  readonly coordinator?: MultiUniverseCoordinator;
}

export function registerControlRoutes(
  app: FastifyInstance,
  deps: ControlRouteDeps,
): { activeTimers: Map<string, NodeJS.Timeout> } {
  const dispatcher = createDmxDispatcher(deps.manager, deps.coordinator);

  registerControlModeRoutes(app, { dispatcher, store: deps.store });

  const { activeTimers } = registerFixtureTestRoutes(app, deps);

  registerFixtureResetRoutes(app, deps, activeTimers);

  registerDebugRoutes(app, { dispatcher, store: deps.store });

  return { activeTimers };
}
