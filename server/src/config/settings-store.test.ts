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
    it("returns defaults with auto-generated serverId when file does not exist", async () => {
      const settings = await store.load();
      const defaults = getDefaults();

      expect(settings.dmxDriver).toBe(defaults.dmxDriver);
      expect(settings.port).toBe(defaults.port);
      expect(settings.host).toBe(defaults.host);
      expect(settings.mdnsEnabled).toBe(defaults.mdnsEnabled);
      expect(settings.setupCompleted).toBe(defaults.setupCompleted);
      expect(settings.serverName).toBe("");
      expect(settings.serverId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it("returns defaults with auto-generated serverId when file contains invalid JSON", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, "not-json", "utf-8");

      const settings = await store.load();

      expect(settings.dmxDriver).toBe(getDefaults().dmxDriver);
      expect(settings.serverId).toMatch(/^[0-9a-f]{8}-/);
    });

    it("returns defaults with auto-generated serverId when file contains non-object JSON", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, '"just a string"', "utf-8");

      const settings = await store.load();

      expect(settings.dmxDriver).toBe(getDefaults().dmxDriver);
      expect(settings.serverId).toMatch(/^[0-9a-f]{8}-/);
    });

    it("returns defaults with auto-generated serverId when file contains invalid field types", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify({ port: "not-a-number" }), "utf-8");

      const settings = await store.load();

      expect(settings.dmxDriver).toBe(getDefaults().dmxDriver);
      expect(settings.serverId).toMatch(/^[0-9a-f]{8}-/);
    });

    it("merges partial settings with defaults", async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify({ dmxDriver: "enttec-usb-dmx-pro", port: 9090 }), "utf-8");

      const settings = await store.load();

      expect(settings.dmxDriver).toBe("enttec-usb-dmx-pro");
      expect(settings.port).toBe(9090);
      expect(settings.host).toBe("127.0.0.1");
      expect(settings.mdnsEnabled).toBe(true);
      expect(settings.setupCompleted).toBe(false);
      expect(settings.serverId).toMatch(/^[0-9a-f]{8}-/);
    });

    it("loads fully saved settings", async () => {
      const full = {
        dmxDriver: "enttec-usb-dmx-pro",
        dmxDevicePath: "COM3",
        port: 9090,
        host: "192.168.1.100",
        mdnsEnabled: false,
        setupCompleted: true,
        serverId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        serverName: "Studio A",
      };
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(full), "utf-8");

      const settings = await store.load();

      expect(settings).toEqual({ ...full, udpPort: 0, onboardingCompleted: false });
    });

    it("auto-generates serverId on first load and persists it", async () => {
      const settings = await store.load();

      expect(settings.serverId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

      // Verify it was persisted
      const raw = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.serverId).toBe(settings.serverId);
    });

    it("preserves existing serverId across reloads", async () => {
      const existingId = "11111111-2222-3333-4444-555555555555";
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify({ serverId: existingId }), "utf-8");

      const settings = await store.load();

      expect(settings.serverId).toBe(existingId);
    });

    it("generates stable serverId across reloads", async () => {
      const first = await store.load();
      const firstId = first.serverId;

      const store2 = createSettingsStore(filePath);
      const second = await store2.load();

      expect(second.serverId).toBe(firstId);
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

  describe("AUTH-C3 update input validation", () => {
    beforeEach(async () => {
      await store.load();
    });

    it("strips unknown keys from partial (prototype-pollution defense)", async () => {
      // Cast through unknown because the type forbids extra keys, but at
      // runtime a malicious PATCH body can carry them.
      await store.update({
        port: 9001,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        foo: "bar",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        __proto__: { polluted: true },
      } as unknown as Partial<PersistedSettings>);

      const current = store.get();
      expect(current.port).toBe(9001);
      expect((current as unknown as Record<string, unknown>).foo).toBeUndefined();
      // Proto pollution check
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it("rejects wrong-type values by throwing", async () => {
      await expect(
        store.update({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          port: "evil" as any,
        }),
      ).rejects.toThrow();
    });

    it("ignores attempts to change serverId (read-only)", async () => {
      const before = store.get().serverId;
      await store.update({ serverId: "attacker-chosen-id" });
      const after = store.get().serverId;
      expect(after).toBe(before);
    });

    it("accepts valid partial updates", async () => {
      await store.update({ port: 8090, serverName: "Studio B" });
      const current = store.get();
      expect(current.port).toBe(8090);
      expect(current.serverName).toBe("Studio B");
    });
  });
});

describe("getDefaults", () => {
  it("returns expected default values", () => {
    const defaults = getDefaults();

    expect(defaults.dmxDriver).toBe("null");
    expect(defaults.dmxDevicePath).toBe("auto");
    expect(defaults.port).toBe(8080);
    expect(defaults.host).toBe("127.0.0.1");
    expect(defaults.mdnsEnabled).toBe(true);
    expect(defaults.setupCompleted).toBe(false);
    expect(defaults.serverId).toBe("");
    expect(defaults.serverName).toBe("");
    expect(defaults.onboardingCompleted).toBe(false);
  });
});

describe("onboardingCompleted", () => {
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

  it("defaults onboardingCompleted to false", async () => {
    const settings = await store.load();
    expect(settings.onboardingCompleted).toBe(false);
  });

  it("persists onboardingCompleted through update", async () => {
    await store.load();
    await store.update({ onboardingCompleted: true });

    const store2 = createSettingsStore(filePath);
    const reloaded = await store2.load();
    expect(reloaded.onboardingCompleted).toBe(true);
  });

  it("rejects non-boolean onboardingCompleted", async () => {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify({ onboardingCompleted: "yes" }), "utf-8");

    const settings = await store.load();
    expect(settings.onboardingCompleted).toBe(false);
  });
});
