import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerSettingsRoutes } from "./settings.js";
import { createSettingsStore } from "../config/settings-store.js";
import type { SettingsStore } from "../config/settings-store.js";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rm } from "node:fs/promises";

vi.mock("../dmx/serial-port-scanner.js", () => ({
  listSerialPorts: vi.fn().mockResolvedValue([
    {
      path: "COM3",
      manufacturer: "FTDI",
      vendorId: "0403",
      productId: "6001",
      serialNumber: "EN466833",
      isEnttec: true,
    },
    {
      path: "COM4",
      manufacturer: "Prolific",
      vendorId: "067B",
      productId: "2303",
      isEnttec: false,
    },
  ]),
}));

describe("settings routes", () => {
  let app: FastifyInstance;
  let store: SettingsStore;
  let filePath: string;

  beforeEach(async () => {
    filePath = join(tmpdir(), `dmxr-settings-route-test-${Date.now()}.json`);
    store = createSettingsStore(filePath);
    await store.load();

    app = Fastify({ logger: false });
    registerSettingsRoutes(app, {
      settingsStore: store,
      serverVersion: "0.2.0-test",
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    try {
      await rm(filePath);
    } catch {
      // may not exist
    }
  });

  describe("GET /settings", () => {
    it("returns settings, ports, and version", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/settings",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.settings).toBeDefined();
      expect(body.settings.dmxDriver).toBe("null");
      expect(body.availablePorts).toHaveLength(2);
      expect(body.serverVersion).toBe("0.2.0-test");
    });

    it("allows requests from any IP address", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/settings",
        remoteAddress: "192.168.1.50",
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe("PATCH /settings", () => {
    it("updates settings and returns them", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/settings",
        payload: { dmxDriver: "enttec-usb-dmx-pro" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.settings.dmxDriver).toBe("enttec-usb-dmx-pro");
      expect(body.requiresRestart).toBe(true);
    });

    it("returns requiresRestart false for non-restart fields", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/settings",
        payload: { setupCompleted: true },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().requiresRestart).toBe(false);
    });

    it("persists changes to disk", async () => {
      await app.inject({
        method: "PATCH",
        url: "/settings",
        payload: { port: 9999 },
      });

      const store2 = createSettingsStore(filePath);
      const reloaded = await store2.load();
      expect(reloaded.port).toBe(9999);
    });

    it("updates serverName and persists it", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/settings",
        payload: { serverName: "Studio A" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.settings.serverName).toBe("Studio A");
      expect(body.requiresRestart).toBe(false);

      const store2 = createSettingsStore(filePath);
      const reloaded = await store2.load();
      expect(reloaded.serverName).toBe("Studio A");
    });

    it("triggers mDNS republish when serverName changes", async () => {
      const republishMock = vi.fn();
      const mockAdvertiser = { unpublishAll: vi.fn(), republish: republishMock };

      // Re-create app with mDNS advertiser
      await app.close();
      app = Fastify({ logger: false });
      registerSettingsRoutes(app, {
        settingsStore: store,
        serverVersion: "0.2.0-test",
        getMdnsAdvertiser: () => mockAdvertiser,
      });
      await app.ready();

      await app.inject({
        method: "PATCH",
        url: "/settings",
        payload: { serverName: "New Name" },
      });

      expect(republishMock).toHaveBeenCalledOnce();
      expect(republishMock).toHaveBeenCalledWith({ serverName: "New Name" });
    });
  });

  describe("POST /settings/scan-ports", () => {
    it("returns ports with recommended ENTTEC", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/settings/scan-ports",
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.ports).toHaveLength(2);
      expect(body.recommended).toBe("COM3");
    });
  });

  describe("POST /settings/restart", () => {
    it("returns restarting response", async () => {
      // Mock process.exit to prevent actual exit
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

      const res = await app.inject({
        method: "POST",
        url: "/settings/restart",
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().restarting).toBe(true);

      // Clean up timer before it fires
      vi.useRealTimers();
      exitSpy.mockRestore();
    });
  });
});
