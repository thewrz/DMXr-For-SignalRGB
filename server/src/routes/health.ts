import type { FastifyInstance } from "fastify";
import type { HealthResponse } from "../types/protocol.js";
import type { UniverseManager } from "../dmx/universe-manager.js";

interface HealthDeps {
  readonly manager: UniverseManager;
  readonly driver: string;
  readonly startTime: number;
}

export function registerHealthRoute(
  app: FastifyInstance,
  deps: HealthDeps,
): void {
  app.get("/health", async (): Promise<HealthResponse> => {
    const dmxStatus = deps.manager.getDmxSendStatus();
    return {
      status: dmxStatus.lastSendError !== null ? "degraded" : "ok",
      driver: deps.driver,
      activeChannels: deps.manager.getActiveChannelCount(),
      uptime: Math.round((Date.now() - deps.startTime) / 1000),
      lastDmxSendTime: dmxStatus.lastSendTime,
      lastDmxSendError: dmxStatus.lastSendError,
    };
  });
}
