import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSettingsStore, getDefaults } from "./settings-store.js";
import type { SettingsStore } from "./settings-store.js";
import { rm, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

describe("settings-store edge cases", () => {
  let store: SettingsStore;
  let filePath: string;

  beforeEach(() => {
    filePath = join(tmpdir(), `dmxr-settings-edge-${Date.now()}.json`);
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

  describe("validation edge cases", () => {
    it("rejects array as top-level JSON", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, "[1,2,3]", "utf-8");

      const settings = await store.load();

      expect(settings.dmxDriver).toBe(getDefaults().dmxDriver);
      expect(settings.serverId).toMatch(/^[0-9a-f]{8}-/);
    });

    it("rejects null as top-level JSON", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, "null", "utf-8");

      const settings = await store.load();

      expect(settings.dmxDriver).toBe(getDefaults().dmxDriver);
    });

    it("rejects wrong type for dmxDriver (number)", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify({ dmxDriver: 42 }), "utf-8");

      const settings = await store.load();

      expect(settings.dmxDriver).toBe(getDefaults().dmxDriver);
    });

    it("rejects wrong type for dmxDevicePath (boolean)", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify({ dmxDevicePath: true }), "utf-8");

      const settings = await store.load();

      expect(settings.dmxDevicePath).toBe(getDefaults().dmxDevicePath);
    });

    it("rejects wrong type for udpPort (string)", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify({ udpPort: "8081" }), "utf-8");

      const settings = await store.load();

      expect(settings.udpPort).toBe(getDefaults().udpPort);
    });

    it("rejects wrong type for host (number)", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify({ host: 12345 }), "utf-8");

      const settings = await store.load();

      expect(settings.host).toBe(getDefaults().host);
    });

    it("rejects wrong type for mdnsEnabled (string)", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify({ mdnsEnabled: "true" }), "utf-8");

      const settings = await store.load();

      expect(settings.mdnsEnabled).toBe(getDefaults().mdnsEnabled);
    });

    it("rejects wrong type for setupCompleted (number)", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify({ setupCompleted: 1 }), "utf-8");

      const settings = await store.load();

      expect(settings.setupCompleted).toBe(getDefaults().setupCompleted);
    });

    it("rejects wrong type for serverId (number)", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify({ serverId: 12345 }), "utf-8");

      const settings = await store.load();

      // serverId was invalid, so defaults apply, then auto-generates a new one
      expect(settings.serverId).toMatch(/^[0-9a-f]{8}-/);
    });

    it("rejects wrong type for serverName (number)", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify({ serverName: 42 }), "utf-8");

      const settings = await store.load();

      expect(settings.serverName).toBe(getDefaults().serverName);
    });

    it("accepts valid partial settings with unknown extra fields", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify({
        port: 9090,
        unknownField: "whatever",
      }), "utf-8");

      const settings = await store.load();

      expect(settings.port).toBe(9090);
    });
  });

  describe("atomic write safety", () => {
    it("get returns defaults before load is called", () => {
      const defaults = getDefaults();
      const current = store.get();

      expect(current.dmxDriver).toBe(defaults.dmxDriver);
      expect(current.port).toBe(defaults.port);
      expect(current.serverId).toBe(""); // no auto-generation without load()
    });

    it("update works even if load was not called first", async () => {
      const result = await store.update({ port: 3333 });

      expect(result.port).toBe(3333);
      expect(result.dmxDriver).toBe(getDefaults().dmxDriver);
    });

    it("successive loads from the same file yield the same serverId", async () => {
      const first = await store.load();
      const firstId = first.serverId;

      const store2 = createSettingsStore(filePath);
      const second = await store2.load();

      expect(second.serverId).toBe(firstId);
    });
  });

  describe("udpPort field", () => {
    it("defaults to 0", async () => {
      const settings = await store.load();
      expect(settings.udpPort).toBe(0);
    });

    it("persists custom udpPort", async () => {
      await store.load();
      await store.update({ udpPort: 9999 });

      const store2 = createSettingsStore(filePath);
      const reloaded = await store2.load();
      expect(reloaded.udpPort).toBe(9999);
    });
  });
});

describe("getDefaults immutability", () => {
  it("returns a fresh copy each call", () => {
    const a = getDefaults();
    const b = getDefaults();

    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});
