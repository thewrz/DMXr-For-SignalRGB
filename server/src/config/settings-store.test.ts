import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSettingsStore, getDefaults } from "./settings-store.js";
import type { SettingsStore, PersistedSettings } from "./settings-store.js";
import { rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

describe("createSettingsStore", () => {
  let store: SettingsStore;
  let filePath: string;

  beforeEach(() => {
    filePath = join(tmpdir(), `dmxr-settings-test-${Date.now()}.json`);
    store = createSettingsStore(filePath);
  });

  afterEach(async () => {
    try {
      await rm(filePath);
      await rm(filePath + ".tmp");
    } catch {
      // may not exist
    }
  });

  describe("load", () => {
    it("returns defaults when file does not exist", async () => {
      const settings = await store.load();

      expect(settings).toEqual(getDefaults());
    });

    it("returns defaults when file contains invalid JSON", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, "not-json", "utf-8");

      const settings = await store.load();

      expect(settings).toEqual(getDefaults());
    });

    it("returns defaults when file contains non-object JSON", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, '"just a string"', "utf-8");

      const settings = await store.load();

      expect(settings).toEqual(getDefaults());
    });

    it("returns defaults when file contains invalid field types", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify({ port: "not-a-number" }), "utf-8");

      const settings = await store.load();

      expect(settings).toEqual(getDefaults());
    });

    it("merges partial settings with defaults", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify({ dmxDriver: "enttec-usb-dmx-pro", port: 9090 }), "utf-8");

      const settings = await store.load();

      expect(settings.dmxDriver).toBe("enttec-usb-dmx-pro");
      expect(settings.port).toBe(9090);
      expect(settings.host).toBe("0.0.0.0");
      expect(settings.mdnsEnabled).toBe(true);
      expect(settings.setupCompleted).toBe(false);
    });

    it("loads fully saved settings", async () => {
      const full: PersistedSettings = {
        dmxDriver: "enttec-usb-dmx-pro",
        dmxDevicePath: "COM3",
        port: 9090,
        host: "192.168.1.100",
        mdnsEnabled: false,
        setupCompleted: true,
      };
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(full), "utf-8");

      const settings = await store.load();

      expect(settings).toEqual(full);
    });
  });

  describe("update", () => {
    it("merges partial update with current settings", async () => {
      await store.load();

      const updated = await store.update({ dmxDriver: "enttec-usb-dmx-pro" });

      expect(updated.dmxDriver).toBe("enttec-usb-dmx-pro");
      expect(updated.port).toBe(8080);
    });

    it("persists to disk", async () => {
      await store.load();
      await store.update({ port: 3000 });

      const raw = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw);

      expect(parsed.port).toBe(3000);
    });

    it("successive updates accumulate", async () => {
      await store.load();
      await store.update({ dmxDriver: "enttec-usb-dmx-pro" });
      const result = await store.update({ port: 4000 });

      expect(result.dmxDriver).toBe("enttec-usb-dmx-pro");
      expect(result.port).toBe(4000);
    });

    it("survives round-trip through save and load", async () => {
      await store.load();
      await store.update({ dmxDevicePath: "COM5", setupCompleted: true });

      const store2 = createSettingsStore(filePath);
      const reloaded = await store2.load();

      expect(reloaded.dmxDevicePath).toBe("COM5");
      expect(reloaded.setupCompleted).toBe(true);
    });
  });

  describe("get", () => {
    it("returns current settings without disk I/O", async () => {
      await store.load();
      await store.update({ port: 7777 });

      const current = store.get();

      expect(current.port).toBe(7777);
    });

    it("returns a copy (not the internal reference)", async () => {
      await store.load();
      const a = store.get();
      const b = store.get();

      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });
  });
});

describe("getDefaults", () => {
  it("returns expected default values", () => {
    const defaults = getDefaults();

    expect(defaults.dmxDriver).toBe("null");
    expect(defaults.dmxDevicePath).toBe("auto");
    expect(defaults.port).toBe(8080);
    expect(defaults.host).toBe("0.0.0.0");
    expect(defaults.mdnsEnabled).toBe(true);
    expect(defaults.setupCompleted).toBe(false);
  });
});
