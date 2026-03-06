import type { FastifyInstance } from "fastify";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { SettingsStore, PersistedSettings } from "../config/settings-store.js";
import type { FixtureConfig, AddFixtureRequest } from "../types/protocol.js";
import { validateFixtureAddress } from "../fixtures/fixture-validator.js";

const CONFIG_VERSION = 1;

/** Machine-specific settings that should not overwrite on import */
const MACHINE_SPECIFIC_KEYS: ReadonlySet<keyof PersistedSettings> = new Set([
  "dmxDevicePath",
  "port",
  "udpPort",
  "host",
  "serverId",
  "setupCompleted",
]);

interface ConfigExport {
  readonly version: number;
  readonly exportedAt: string;
  readonly serverName: string;
  readonly fixtures: readonly FixtureConfig[];
  readonly settings: PersistedSettings;
}

interface ImportBody {
  readonly config: ConfigExport;
  readonly mode: "merge" | "replace";
}

interface ImportResult {
  readonly success: boolean;
  readonly mode: "merge" | "replace";
  readonly fixturesAdded: number;
  readonly fixturesSkipped: number;
  readonly settingsApplied: boolean;
}

interface PreviewResult {
  readonly valid: boolean;
  readonly version: number;
  readonly serverName: string;
  readonly fixtureCount: number;
  readonly fixtures: readonly { name: string; dmxStartAddress: number; channelCount: number }[];
  readonly error?: string;
}

interface ConfigDeps {
  readonly fixtureStore: FixtureStore;
  readonly settingsStore: SettingsStore;
  readonly serverVersion: string;
}

function isValidConfigExport(data: unknown): data is ConfigExport {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.version === "number" &&
    typeof obj.exportedAt === "string" &&
    typeof obj.serverName === "string" &&
    Array.isArray(obj.fixtures) &&
    typeof obj.settings === "object" &&
    obj.settings !== null
  );
}

export function registerConfigRoutes(
  app: FastifyInstance,
  deps: ConfigDeps,
): void {
  // GET /config/export — download full configuration
  app.get("/config/export", async (_request, reply) => {
    const fixtures = deps.fixtureStore.getAll();
    const settings = deps.settingsStore.get();

    const exportData: ConfigExport = {
      version: CONFIG_VERSION,
      exportedAt: new Date().toISOString(),
      serverName: settings.serverName || "DMXr",
      fixtures,
      settings,
    };

    const filename = `dmxr-config-${(settings.serverName || "dmxr").replace(/[^a-zA-Z0-9-_]/g, "_")}-${new Date().toISOString().slice(0, 10)}.json`;

    return reply
      .header("Content-Type", "application/json")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(exportData);
  });

  // POST /config/preview — validate import file without applying
  app.post("/config/preview", async (request, reply) => {
    const body = request.body as { config?: unknown } | null;
    if (!body?.config) {
      return reply.status(400).send({ valid: false, error: "No config provided" });
    }

    if (!isValidConfigExport(body.config)) {
      return reply.status(400).send({ valid: false, error: "Invalid config format" });
    }

    const config = body.config;
    if (config.version > CONFIG_VERSION) {
      return reply.status(400).send({
        valid: false,
        error: `Config version ${config.version} is newer than supported (${CONFIG_VERSION}). Update DMXr first.`,
      });
    }

    const result: PreviewResult = {
      valid: true,
      version: config.version,
      serverName: config.serverName,
      fixtureCount: config.fixtures.length,
      fixtures: config.fixtures.map((f) => ({
        name: f.name,
        dmxStartAddress: f.dmxStartAddress,
        channelCount: f.channelCount,
      })),
    };

    return reply.send(result);
  });

  // POST /config/import — apply configuration
  app.post("/config/import", async (request, reply) => {
    const body = request.body as ImportBody | null;
    if (!body?.config || !body.mode) {
      return reply.status(400).send({ success: false, error: "config and mode required" });
    }

    if (body.mode !== "merge" && body.mode !== "replace") {
      return reply.status(400).send({ success: false, error: "mode must be 'merge' or 'replace'" });
    }

    if (!isValidConfigExport(body.config)) {
      return reply.status(400).send({ success: false, error: "Invalid config format" });
    }

    const config = body.config;
    if (config.version > CONFIG_VERSION) {
      return reply.status(400).send({
        success: false,
        error: `Config version ${config.version} is newer than supported (${CONFIG_VERSION})`,
      });
    }

    if (body.mode === "replace") {
      // Remove all existing fixtures
      const existing = deps.fixtureStore.getAll();
      for (const f of existing) {
        deps.fixtureStore.remove(f.id);
      }

      // Add all imported fixtures
      const requests: AddFixtureRequest[] = config.fixtures.map((f) => ({
        name: f.name,
        universeId: f.universeId,
        oflKey: f.oflKey,
        oflFixtureName: f.oflFixtureName,
        source: f.source,
        category: f.category,
        mode: f.mode,
        dmxStartAddress: f.dmxStartAddress,
        channelCount: f.channelCount,
        channels: [...f.channels],
      }));

      const created = deps.fixtureStore.addBatch(requests);

      // Restore per-fixture settings (overrides, motor guard, etc.) by patching
      for (let i = 0; i < config.fixtures.length; i++) {
        const src = config.fixtures[i];
        const target = created[i];
        if (!target) continue;

        const patch: Record<string, unknown> = {};
        if (src.channelOverrides) patch.channelOverrides = src.channelOverrides;
        if (src.channelRemap) patch.channelRemap = src.channelRemap;
        if (src.whiteGateThreshold !== undefined) patch.whiteGateThreshold = src.whiteGateThreshold;
        if (src.motorGuardEnabled !== undefined) patch.motorGuardEnabled = src.motorGuardEnabled;
        if (src.motorGuardBuffer !== undefined) patch.motorGuardBuffer = src.motorGuardBuffer;
        if (src.resetConfig) patch.resetConfig = src.resetConfig;

        if (Object.keys(patch).length > 0) {
          deps.fixtureStore.update(target.id, patch);
        }
      }

      await deps.fixtureStore.save();

      // Apply non-machine-specific settings
      const settingsPatch: Partial<PersistedSettings> = {};
      for (const [key, value] of Object.entries(config.settings)) {
        if (!MACHINE_SPECIFIC_KEYS.has(key as keyof PersistedSettings)) {
          (settingsPatch as Record<string, unknown>)[key] = value;
        }
      }
      if (Object.keys(settingsPatch).length > 0) {
        await deps.settingsStore.update(settingsPatch);
      }

      const result: ImportResult = {
        success: true,
        mode: "replace",
        fixturesAdded: created.length,
        fixturesSkipped: 0,
        settingsApplied: Object.keys(settingsPatch).length > 0,
      };
      return reply.send(result);
    }

    // Merge mode: add non-conflicting fixtures
    const existingFixtures = deps.fixtureStore.getAll();
    let added = 0;
    let skipped = 0;

    for (const f of config.fixtures) {
      // Check for address conflicts with existing + already-added fixtures
      const allFixtures = deps.fixtureStore.getAll();
      const validation = validateFixtureAddress(
        f.dmxStartAddress,
        f.channelCount,
        allFixtures,
        undefined,
        f.universeId,
      );

      if (!validation.valid) {
        skipped++;
        continue;
      }

      const created = deps.fixtureStore.add({
        name: f.name,
        universeId: f.universeId,
        oflKey: f.oflKey,
        oflFixtureName: f.oflFixtureName,
        source: f.source,
        category: f.category,
        mode: f.mode,
        dmxStartAddress: f.dmxStartAddress,
        channelCount: f.channelCount,
        channels: [...f.channels],
      });

      // Restore per-fixture settings
      const patch: Record<string, unknown> = {};
      if (f.channelOverrides) patch.channelOverrides = f.channelOverrides;
      if (f.channelRemap) patch.channelRemap = f.channelRemap;
      if (f.whiteGateThreshold !== undefined) patch.whiteGateThreshold = f.whiteGateThreshold;
      if (f.motorGuardEnabled !== undefined) patch.motorGuardEnabled = f.motorGuardEnabled;
      if (f.motorGuardBuffer !== undefined) patch.motorGuardBuffer = f.motorGuardBuffer;
      if (f.resetConfig) patch.resetConfig = f.resetConfig;

      if (Object.keys(patch).length > 0) {
        deps.fixtureStore.update(created.id, patch);
      }

      added++;
    }

    await deps.fixtureStore.save();

    const result: ImportResult = {
      success: true,
      mode: "merge",
      fixturesAdded: added,
      fixturesSkipped: skipped,
      settingsApplied: false,
    };
    return reply.send(result);
  });
}
