import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export interface PersistedSettings {
  readonly dmxDriver: string;
  readonly dmxDevicePath: string;
  readonly port: number;
  readonly udpPort: number;
  readonly host: string;
  readonly mdnsEnabled: boolean;
  readonly setupCompleted: boolean;
  readonly serverId: string;
  readonly serverName: string;
  readonly onboardingCompleted: boolean;
  readonly driverOptions?: {
    readonly universe?: number;
    readonly port?: number;
    readonly sourceName?: string;
    readonly priority?: number;
  };
}

const DEFAULTS: PersistedSettings = {
  dmxDriver: "null",
  dmxDevicePath: "auto",
  port: 8080,
  udpPort: 0,
  host: "127.0.0.1",
  mdnsEnabled: true,
  setupCompleted: false,
  serverId: "",
  serverName: "",
  onboardingCompleted: false,
};

export interface SettingsStore {
  readonly load: () => Promise<PersistedSettings>;
  readonly update: (partial: Partial<PersistedSettings>) => Promise<PersistedSettings>;
  readonly get: () => PersistedSettings;
}

// AUTH-C3: keys a client is allowed to patch. `serverId` is deliberately
// omitted — it is auto-generated on first load and must not be
// externally mutable.
export const UPDATABLE_SETTINGS_KEYS: ReadonlySet<keyof PersistedSettings> =
  new Set<keyof PersistedSettings>([
    "dmxDriver",
    "dmxDevicePath",
    "port",
    "udpPort",
    "host",
    "mdnsEnabled",
    "setupCompleted",
    "serverName",
    "onboardingCompleted",
    "driverOptions",
  ]);

function isValidSettings(data: unknown): data is Partial<PersistedSettings> {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return false;
  }
  const record = data as Record<string, unknown>;

  if ("dmxDriver" in record && typeof record["dmxDriver"] !== "string") return false;
  if ("dmxDevicePath" in record && typeof record["dmxDevicePath"] !== "string") return false;
  if ("port" in record && typeof record["port"] !== "number") return false;
  if ("udpPort" in record && typeof record["udpPort"] !== "number") return false;
  if ("host" in record && typeof record["host"] !== "string") return false;
  if ("mdnsEnabled" in record && typeof record["mdnsEnabled"] !== "boolean") return false;
  if ("setupCompleted" in record && typeof record["setupCompleted"] !== "boolean") return false;
  if ("serverId" in record && typeof record["serverId"] !== "string") return false;
  if ("serverName" in record && typeof record["serverName"] !== "string") return false;
  if ("onboardingCompleted" in record && typeof record["onboardingCompleted"] !== "boolean") return false;
  if ("driverOptions" in record && record["driverOptions"] !== undefined && typeof record["driverOptions"] !== "object") return false;

  return true;
}

export function createSettingsStore(filePath: string): SettingsStore {
  let current: PersistedSettings = { ...DEFAULTS };

  async function save(settings: PersistedSettings): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    const tmpPath = filePath + ".tmp";
    await writeFile(tmpPath, JSON.stringify(settings, null, 2), "utf-8");
    await rename(tmpPath, filePath);
  }

  return {
    async load(): Promise<PersistedSettings> {
      try {
        const data = await readFile(filePath, "utf-8");
        const parsed: unknown = JSON.parse(data);

        if (isValidSettings(parsed)) {
          current = { ...DEFAULTS, ...parsed };
        } else {
          current = { ...DEFAULTS };
        }
      } catch {
        current = { ...DEFAULTS };
      }

      if (!current.serverId) {
        current = { ...current, serverId: randomUUID() };
        await save(current);
      }

      return { ...current };
    },

    async update(partial: Partial<PersistedSettings>): Promise<PersistedSettings> {
      // AUTH-C3: strip unknown keys and reject wrong-type values before
      // merging. Only the allowlist keys are honored — serverId,
      // __proto__, constructor, and any attacker-supplied key are dropped.
      const filtered: Partial<PersistedSettings> = {};
      if (partial && typeof partial === "object" && !Array.isArray(partial)) {
        for (const key of UPDATABLE_SETTINGS_KEYS) {
          if (Object.prototype.hasOwnProperty.call(partial, key)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (filtered as any)[key] = (partial as any)[key];
          }
        }
      }
      if (!isValidSettings(filtered)) {
        throw new Error("Invalid settings update: type validation failed");
      }
      current = { ...current, ...filtered };
      await save(current);
      return { ...current };
    },

    get(): PersistedSettings {
      return { ...current };
    },
  };
}

export function getDefaults(): PersistedSettings {
  return { ...DEFAULTS };
}
