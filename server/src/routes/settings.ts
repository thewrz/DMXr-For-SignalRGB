import type { FastifyInstance } from "fastify";
import type { SettingsStore } from "../config/settings-store.js";
import type { PersistedSettings } from "../config/settings-store.js";
import type { MdnsAdvertiser } from "../mdns/advertiser.js";
import {
  listSerialPorts,
  type SerialPortInfo,
} from "../dmx/serial-port-scanner.js";

interface SettingsDeps {
  readonly settingsStore: SettingsStore;
  readonly serverVersion: string;
  readonly getMdnsAdvertiser?: () => MdnsAdvertiser | undefined;
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
  "driverOptions",
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

    if ("serverName" in body) {
      deps.getMdnsAdvertiser?.()?.republish({ serverName: settings.serverName });
    }

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

  app.post(
    "/settings/restart",
    {
      // AUTH-C2: at most 2 restarts per hour to prevent remote reboot loops.
      // The global rate limit (600/min) is far too permissive for an
      // endpoint that terminates the process.
      config: { rateLimit: { max: 2, timeWindow: "1 hour" } },
    },
    async (request, reply) => {
      // AUTH-C2: require an explicit confirmation header so a CSRF-triggered
      // fetch from a browser cannot restart the server. The header value is
      // not a secret — it's a simple anti-CSRF deterrent paired with the
      // fail-closed auth middleware.
      const confirm = request.headers["x-restart-confirm"];
      if (confirm !== "yes") {
        return reply.status(400).send({
          error:
            "Restart requires the header `x-restart-confirm: yes` to confirm intent.",
        });
      }

      reply.send({ restarting: true });

      setTimeout(() => {
        // Exit with non-zero code so service managers (systemd Restart=on-failure,
        // NSSM) will restart the process. Exit code 0 is treated as intentional
        // shutdown and will NOT trigger a restart.
        process.stderr.write(
          "[DMXr] Restarting server (requested via settings UI)\n",
        );
        process.exit(1);
      }, 500);
    },
  );
}
