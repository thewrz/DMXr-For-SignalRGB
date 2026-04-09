import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerConfigRoutes } from "./config.js";
import { createFixtureStore } from "../fixtures/fixture-store.js";
import { createSettingsStore } from "../config/settings-store.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import type { SettingsStore } from "../config/settings-store.js";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rm } from "node:fs/promises";

describe("config routes", () => {
  let app: FastifyInstance;
  let fixtureStore: FixtureStore;
  let settingsStore: SettingsStore;
  let fixturePath: string;
  let settingsPath: string;

  beforeEach(async () => {
    const id = Date.now() + "-" + Math.random().toString(36).slice(2);
    fixturePath = join(tmpdir(), `dmxr-config-test-fixtures-${id}.json`);
    settingsPath = join(tmpdir(), `dmxr-config-test-settings-${id}.json`);

    fixtureStore = createFixtureStore(fixturePath);
    await fixtureStore.load();

    settingsStore = createSettingsStore(settingsPath);
    await settingsStore.load();
    await settingsStore.update({ serverName: "Test Server" });

    app = Fastify({ logger: false });
    registerConfigRoutes(app, {
      fixtureStore,
      settingsStore,
      serverVersion: "1.0.0-test",
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    try { await rm(fixturePath); } catch { /* */ }
    try { await rm(settingsPath); } catch { /* */ }
  });

  function addTestFixture(name: string, address: number) {
    return fixtureStore.add({
      name,
      mode: "7-channel",
      dmxStartAddress: address,
      channelCount: 3,
      channels: [
        { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
        { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
        { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
      ],
    });
  }

  describe("GET /config/export", () => {
    it("exports config with version and fixtures", async () => {
      addTestFixture("PAR 1", 1);
      addTestFixture("PAR 2", 10);

      const res = await app.inject({ method: "GET", url: "/config/export" });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.version).toBe(1);
      expect(body.exportedAt).toBeDefined();
      expect(body.serverName).toBe("Test Server");
      expect(body.fixtures).toHaveLength(2);
      expect(body.settings).toBeDefined();
      expect(body.settings.serverName).toBe("Test Server");
    });

    it("sets Content-Disposition header for download", async () => {
      const res = await app.inject({ method: "GET", url: "/config/export" });
      const disposition = res.headers["content-disposition"] as string;
      expect(disposition).toContain("attachment");
      expect(disposition).toContain("dmxr-config-");
    });

    it("exports empty config when no fixtures", async () => {
      const res = await app.inject({ method: "GET", url: "/config/export" });

      expect(res.statusCode).toBe(200);
      expect(res.json().fixtures).toHaveLength(0);
    });
  });

  describe("POST /config/preview", () => {
    it("validates a valid config", async () => {
      addTestFixture("PAR 1", 1);
      const exportRes = await app.inject({ method: "GET", url: "/config/export" });
      const config = exportRes.json();

      const res = await app.inject({
        method: "POST",
        url: "/config/preview",
        payload: { config },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.valid).toBe(true);
      expect(body.fixtureCount).toBe(1);
      expect(body.fixtures[0].name).toBe("PAR 1");
    });

    it("rejects invalid format", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/config/preview",
        payload: { config: { bad: true } },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().valid).toBe(false);
    });

    it("rejects newer config version", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/config/preview",
        payload: {
          config: {
            version: 999,
            exportedAt: new Date().toISOString(),
            serverName: "Future",
            fixtures: [],
            settings: {},
          },
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("newer than supported");
    });

    it("rejects missing config", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/config/preview",
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /config/import — replace mode", () => {
    it("replaces all fixtures", async () => {
      addTestFixture("Old PAR", 1);
      await fixtureStore.save();

      // Export from a "different" config with different fixtures
      const config = {
        version: 1,
        exportedAt: new Date().toISOString(),
        serverName: "Other Server",
        fixtures: [
          {
            id: "imported-1",
            name: "New PAR",
            mode: "3-channel",
            dmxStartAddress: 20,
            channelCount: 3,
            channels: [
              { offset: 0, name: "R", type: "ColorIntensity", color: "Red", defaultValue: 0 },
              { offset: 1, name: "G", type: "ColorIntensity", color: "Green", defaultValue: 0 },
              { offset: 2, name: "B", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
            ],
          },
        ],
        settings: {
          dmxDriver: "enttec-usb-dmx-pro",
          serverName: "Other Server",
          mdnsEnabled: false,
          port: 9999,
          host: "192.168.1.100",
        },
      };

      const res = await app.inject({
        method: "POST",
        url: "/config/import",
        payload: { config, mode: "replace" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.mode).toBe("replace");
      expect(body.fixturesAdded).toBe(1);
      expect(body.settingsApplied).toBe(true);

      // Verify old fixture is gone, new one exists
      const fixtures = fixtureStore.getAll();
      expect(fixtures).toHaveLength(1);
      expect(fixtures[0].name).toBe("New PAR");
      expect(fixtures[0].dmxStartAddress).toBe(20);

      // Verify non-machine-specific settings were applied
      const settings = settingsStore.get();
      expect(settings.dmxDriver).toBe("enttec-usb-dmx-pro");
      expect(settings.serverName).toBe("Other Server");
      expect(settings.mdnsEnabled).toBe(false);

      // Machine-specific settings should NOT be overwritten
      expect(settings.port).not.toBe(9999);
      expect(settings.host).not.toBe("192.168.1.100");
    });

    it("preserves per-fixture settings like overrides", async () => {
      const config = {
        version: 1,
        exportedAt: new Date().toISOString(),
        serverName: "Test",
        fixtures: [
          {
            id: "f1",
            name: "Mover",
            mode: "13ch",
            dmxStartAddress: 40,
            channelCount: 2,
            channels: [
              { offset: 0, name: "Pan", type: "Pan", defaultValue: 128 },
              { offset: 1, name: "Tilt", type: "Tilt", defaultValue: 128 },
            ],
            motorGuardEnabled: true,
            motorGuardBuffer: 8,
            channelOverrides: { 0: { value: 128, enabled: true } },
            resetConfig: { channelOffset: 12, value: 200, holdMs: 5000 },
          },
        ],
        settings: { serverName: "Test" },
      };

      const res = await app.inject({
        method: "POST",
        url: "/config/import",
        payload: { config, mode: "replace" },
      });

      expect(res.statusCode).toBe(200);
      const fixtures = fixtureStore.getAll();
      expect(fixtures[0].motorGuardEnabled).toBe(true);
      expect(fixtures[0].motorGuardBuffer).toBe(8);
      expect(fixtures[0].channelOverrides).toBeDefined();
      expect(fixtures[0].resetConfig?.channelOffset).toBe(12);
    });
  });

  describe("POST /config/import — merge mode", () => {
    it("adds non-conflicting fixtures", async () => {
      addTestFixture("Existing PAR", 1);

      const config = {
        version: 1,
        exportedAt: new Date().toISOString(),
        serverName: "Other",
        fixtures: [
          {
            id: "new-1",
            name: "Imported PAR",
            mode: "3ch",
            dmxStartAddress: 50,
            channelCount: 3,
            channels: [
              { offset: 0, name: "R", type: "ColorIntensity", color: "Red", defaultValue: 0 },
              { offset: 1, name: "G", type: "ColorIntensity", color: "Green", defaultValue: 0 },
              { offset: 2, name: "B", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
            ],
          },
        ],
        settings: { serverName: "Other" },
      };

      const res = await app.inject({
        method: "POST",
        url: "/config/import",
        payload: { config, mode: "merge" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.fixturesAdded).toBe(1);
      expect(body.fixturesSkipped).toBe(0);
      expect(body.settingsApplied).toBe(false);

      expect(fixtureStore.getAll()).toHaveLength(2);
    });

    it("skips fixtures with address conflicts", async () => {
      addTestFixture("Existing PAR", 1);

      const config = {
        version: 1,
        exportedAt: new Date().toISOString(),
        serverName: "Other",
        fixtures: [
          {
            id: "conflict-1",
            name: "Conflicting PAR",
            mode: "3ch",
            dmxStartAddress: 2, // overlaps with existing at 1-3
            channelCount: 3,
            channels: [
              { offset: 0, name: "R", type: "ColorIntensity", color: "Red", defaultValue: 0 },
              { offset: 1, name: "G", type: "ColorIntensity", color: "Green", defaultValue: 0 },
              { offset: 2, name: "B", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
            ],
          },
          {
            id: "ok-1",
            name: "Non-conflicting PAR",
            mode: "3ch",
            dmxStartAddress: 100,
            channelCount: 3,
            channels: [
              { offset: 0, name: "R", type: "ColorIntensity", color: "Red", defaultValue: 0 },
              { offset: 1, name: "G", type: "ColorIntensity", color: "Green", defaultValue: 0 },
              { offset: 2, name: "B", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
            ],
          },
        ],
        settings: { serverName: "Other" },
      };

      const res = await app.inject({
        method: "POST",
        url: "/config/import",
        payload: { config, mode: "merge" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.fixturesAdded).toBe(1);
      expect(body.fixturesSkipped).toBe(1);
      expect(fixtureStore.getAll()).toHaveLength(2);
    });

    it("does not apply settings in merge mode", async () => {
      await settingsStore.update({ serverName: "Original" });

      const config = {
        version: 1,
        exportedAt: new Date().toISOString(),
        serverName: "Imported",
        fixtures: [],
        settings: { serverName: "Imported", dmxDriver: "enttec-usb-dmx-pro" },
      };

      await app.inject({
        method: "POST",
        url: "/config/import",
        payload: { config, mode: "merge" },
      });

      expect(settingsStore.get().serverName).toBe("Original");
    });
  });

  describe("POST /config/import — validation", () => {
    it("rejects missing config", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/config/import",
        payload: { mode: "replace" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects invalid mode", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/config/import",
        payload: {
          config: {
            version: 1,
            exportedAt: new Date().toISOString(),
            serverName: "X",
            fixtures: [],
            settings: {},
          },
          mode: "invalid",
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejects newer config version", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/config/import",
        payload: {
          config: {
            version: 999,
            exportedAt: new Date().toISOString(),
            serverName: "Future",
            fixtures: [],
            settings: {},
          },
          mode: "replace",
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("newer than supported");
    });
  });

  describe("roundtrip: export then import", () => {
    it("perfectly restores fixtures via replace", async () => {
      const f1 = addTestFixture("PAR Left", 1);
      const f2 = addTestFixture("PAR Right", 10);
      fixtureStore.update(f1.id, { motorGuardEnabled: true, motorGuardBuffer: 6 });
      fixtureStore.update(f2.id, {
        channelOverrides: { 0: { value: 200, enabled: true } },
      });

      // Export
      const exportRes = await app.inject({ method: "GET", url: "/config/export" });
      const config = exportRes.json();

      // Clear
      fixtureStore.remove(f1.id);
      fixtureStore.remove(f2.id);
      expect(fixtureStore.getAll()).toHaveLength(0);

      // Import
      const importRes = await app.inject({
        method: "POST",
        url: "/config/import",
        payload: { config, mode: "replace" },
      });

      expect(importRes.statusCode).toBe(200);
      expect(importRes.json().fixturesAdded).toBe(2);

      const restored = fixtureStore.getAll();
      expect(restored).toHaveLength(2);
      expect(restored.find((f) => f.name === "PAR Left")).toBeDefined();
      expect(restored.find((f) => f.name === "PAR Right")).toBeDefined();

      const left = restored.find((f) => f.name === "PAR Left")!;
      expect(left.motorGuardEnabled).toBe(true);
      expect(left.motorGuardBuffer).toBe(6);

      const right = restored.find((f) => f.name === "PAR Right")!;
      expect(right.channelOverrides).toBeDefined();
    });
  });
});
