import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerUniverseRoutes } from "./universes.js";
import { createUniverseRegistry } from "../dmx/universe-registry.js";
import type { UniverseRegistry } from "../dmx/universe-registry.js";
import { createFixtureStore } from "../fixtures/fixture-store.js";
import type { FixtureStore } from "../fixtures/fixture-store.js";
import { DEFAULT_UNIVERSE_ID } from "../types/protocol.js";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("universe routes", () => {
  let app: FastifyInstance;
  let registry: UniverseRegistry;
  let fixtureStore: FixtureStore;
  let registryPath: string;
  let fixturePath: string;

  beforeEach(async () => {
    registryPath = join(tmpdir(), `dmxr-uni-route-${Date.now()}.json`);
    fixturePath = join(tmpdir(), `dmxr-fix-route-${Date.now()}.json`);
    registry = createUniverseRegistry(registryPath);
    await registry.load();
    fixtureStore = createFixtureStore(fixturePath);

    app = Fastify();
    registerUniverseRoutes(app, { registry, fixtureStore });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    try { await rm(registryPath); } catch { /* */ }
    try { await rm(fixturePath); } catch { /* */ }
  });

  describe("GET /universes", () => {
    it("returns all universe configs", async () => {
      const res = await app.inject({ method: "GET", url: "/universes" });
      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      // Should at least have the default universe
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body.some((u: { id: string }) => u.id === DEFAULT_UNIVERSE_ID)).toBe(true);
    });
  });

  describe("GET /universes/:id", () => {
    it("returns single universe", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/universes/${DEFAULT_UNIVERSE_ID}`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().id).toBe(DEFAULT_UNIVERSE_ID);
    });

    it("returns 404 for unknown", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/universes/nonexistent",
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /universes", () => {
    it("creates a new universe", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/universes",
        payload: {
          name: "Stage Right",
          devicePath: "/dev/ttyUSB1",
          driverType: "enttec-usb-dmx-pro",
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.name).toBe("Stage Right");
      expect(body.id).toBeDefined();
    });

    it("validates required fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/universes",
        payload: { name: "Missing Fields" },
      });
      expect(res.statusCode).toBe(400);
    });

    it("rejects duplicate name", async () => {
      await app.inject({
        method: "POST",
        url: "/universes",
        payload: { name: "Dupe", devicePath: "/dev/ttyUSB0", driverType: "null" },
      });
      const res = await app.inject({
        method: "POST",
        url: "/universes",
        payload: { name: "Dupe", devicePath: "/dev/ttyUSB1", driverType: "null" },
      });
      expect(res.statusCode).toBe(409);
    });

    describe("AUTH-C4 strict schema", () => {
      it("rejects unknown keys", async () => {
        const res = await app.inject({
          method: "POST",
          url: "/universes",
          payload: {
            name: "Good",
            devicePath: "/dev/ttyUSB0",
            driverType: "null",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            extra: "evil" as any,
          },
        });
        expect(res.statusCode).toBe(400);
      });

      it("rejects invalid driverType", async () => {
        const res = await app.inject({
          method: "POST",
          url: "/universes",
          payload: {
            name: "Bad Driver",
            devicePath: "/dev/ttyUSB0",
            driverType: "bogus",
          },
        });
        expect(res.statusCode).toBe(400);
      });

      it("rejects oversized name", async () => {
        const res = await app.inject({
          method: "POST",
          url: "/universes",
          payload: {
            name: "x".repeat(1000),
            devicePath: "/dev/ttyUSB0",
            driverType: "null",
          },
        });
        expect(res.statusCode).toBe(400);
      });

      it("rejects oversized devicePath", async () => {
        const res = await app.inject({
          method: "POST",
          url: "/universes",
          payload: {
            name: "OK",
            devicePath: "/dev/" + "x".repeat(1000),
            driverType: "null",
          },
        });
        expect(res.statusCode).toBe(400);
      });

      it("accepts a well-formed body", async () => {
        const res = await app.inject({
          method: "POST",
          url: "/universes",
          payload: {
            name: "Valid",
            devicePath: "/dev/ttyUSB0",
            driverType: "enttec-usb-dmx-pro",
          },
        });
        expect(res.statusCode).toBe(201);
      });
    });
  });

  describe("PATCH /universes/:id", () => {
    it("updates universe config", async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/universes",
        payload: { name: "Old Name", devicePath: "null", driverType: "null" },
      });
      const id = createRes.json().id;

      const res = await app.inject({
        method: "PATCH",
        url: `/universes/${id}`,
        payload: { name: "New Name" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe("New Name");
    });

    it("returns 404 for unknown", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/universes/nonexistent",
        payload: { name: "X" },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /universes/:id", () => {
    it("removes universe", async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/universes",
        payload: { name: "ToDelete", devicePath: "null", driverType: "null" },
      });
      const id = createRes.json().id;

      const res = await app.inject({
        method: "DELETE",
        url: `/universes/${id}`,
      });
      expect(res.statusCode).toBe(204);
    });

    it("rejects deleting default universe", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/universes/${DEFAULT_UNIVERSE_ID}`,
      });
      expect(res.statusCode).toBe(400);
    });

    it("returns 404 for unknown", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/universes/nonexistent",
      });
      expect(res.statusCode).toBe(404);
    });

    it("rejects deletion when fixtures are assigned", async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/universes",
        payload: { name: "HasFixtures", devicePath: "null", driverType: "null" },
      });
      const universeId = createRes.json().id;

      // Add a fixture to this universe
      fixtureStore.add({
        name: "PAR in universe",
        mode: "3ch",
        dmxStartAddress: 1,
        channelCount: 1,
        universeId,
        channels: [{ offset: 0, name: "Dim", type: "Intensity", defaultValue: 0 }],
      });

      const res = await app.inject({
        method: "DELETE",
        url: `/universes/${universeId}`,
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toMatch(/fixture/i);
    });
  });

  describe("GET /universes/:id/fixtures", () => {
    it("returns fixtures for that universe", async () => {
      fixtureStore.add({
        name: "PAR",
        mode: "3ch",
        dmxStartAddress: 1,
        channelCount: 1,
        universeId: DEFAULT_UNIVERSE_ID,
        channels: [{ offset: 0, name: "Dim", type: "Intensity", defaultValue: 0 }],
      });

      const res = await app.inject({
        method: "GET",
        url: `/universes/${DEFAULT_UNIVERSE_ID}/fixtures`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
    });

    it("returns empty array for universe with no fixtures", async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/universes",
        payload: { name: "Empty", devicePath: "null", driverType: "null" },
      });
      const id = createRes.json().id;

      const res = await app.inject({
        method: "GET",
        url: `/universes/${id}/fixtures`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });
});
