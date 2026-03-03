import type { FastifyInstance } from "fastify";
import type { SettingsStore } from "../config/settings-store.js";
import type { PersistedSettings } from "../config/settings-store.js";
import {
  listSerialPorts,
  type SerialPortInfo,
} from "../dmx/serial-port-scanner.js";

interface SettingsDeps {
  readonly settingsStore: SettingsStore;
  readonly serverVersion: string;
}

interface GetSettingsResponse {
  readonly settings: PersistedSettings;
  readonly availablePorts: readonly SerialPortInfo[];
  readonly serverVersion: string;
}

interface PatchSettingsResponse {
  readonly settings: PersistedSettings;
  readonly requiresRestart: boolean;
}

interface ScanPortsResponse {
  readonly ports: readonly SerialPortInfo[];
  readonly recommended: string | null;
}

const RESTART_FIELDS: ReadonlySet<keyof PersistedSettings> = new Set([
  "dmxDriver",
  "dmxDevicePath",
  "port",
  "host",
]);

export function registerSettingsRoutes(
  app: FastifyInstance,
  deps: SettingsDeps,
): void {
  app.get(
    "/settings",
    async (): Promise<GetSettingsResponse> => {
      const settings = deps.settingsStore.get();
      const availablePorts = await listSerialPorts();

      return {
        settings,
        availablePorts,
        serverVersion: deps.serverVersion,
      };
    },
  );

  app.patch("/settings", async (request, reply) => {
    const body = request.body as Partial<PersistedSettings> | null;
    if (!body || typeof body !== "object") {
      return reply.status(400).send({ error: "Request body required" });
    }

    const settings = await deps.settingsStore.update(body);
    const changedKeys = Object.keys(body) as (keyof PersistedSettings)[];
    const requiresRestart = changedKeys.some((k) => RESTART_FIELDS.has(k));

    const response: PatchSettingsResponse = { settings, requiresRestart };
    return response;
  });

  app.post(
    "/settings/scan-ports",
    async (): Promise<ScanPortsResponse> => {
      const ports = await listSerialPorts();
      const recommended = ports.find((p) => p.isEnttec)?.path ?? null;

      return { ports, recommended };
    },
  );

  app.post("/settings/restart", async (_request, reply) => {
    reply.send({ restarting: true });

    setTimeout(() => {
      process.exit(0);
    }, 500);
  });
}
