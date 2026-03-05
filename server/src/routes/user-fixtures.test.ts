import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildServer } from "../server.js";
import { createUniverseManager } from "../dmx/universe-manager.js";
import {
  createMockUniverse,
  createTestConfig,
  createTestFixtureStore,
  createTestUserFixtureStore,
  createMockOflClient,
  createMockRegistry,
} from "../test-helpers.js";
import type { UserFixtureStore } from "../fixtures/user-fixture-store.js";
import type { FastifyInstance } from "fastify";

const validTemplateBody = {
  name: "My Custom PAR",
  manufacturer: "DIY",
  category: "Color Changer",
  modes: [
    {
      name: "3-channel",
      channels: [
        { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
        { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
        { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
      ],
    },
  ],
};

describe("User fixture routes", () => {
  let app: FastifyInstance;
  let userStore: UserFixtureStore;

  beforeEach(async () => {
    const universe = createMockUniverse();
    const manager = createUniverseManager(universe);
    manager.resumeNormal();
    userStore = createTestUserFixtureStore();

    app = await buildServer({
      config: createTestConfig(),
      manager,
      driver: "null",
      startTime: Date.now(),
      fixtureStore: createTestFixtureStore(),
      oflClient: createMockOflClient(),
      registry: createMockRegistry(),
      userFixtureStore: userStore,
    });
  });

  afterEach(async () => {
    userStore.dispose();
    await app.close();
  });

  describe("GET /user-fixtures", () => {
    it("returns empty array initially", async () => {
      const res = await app.inject({ method: "GET", url: "/user-fixtures" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns templates after adding", async () => {
      userStore.add(validTemplateBody);

      const res = await app.inject({ method: "GET", url: "/user-fixtures" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
      expect(res.json()[0].name).toBe("My Custom PAR");
    });
  });

  describe("POST /user-fixtures", () => {
    it("creates template and returns 201 with UUID", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/user-fixtures",
        payload: validTemplateBody,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBeDefined();
      expect(body.name).toBe("My Custom PAR");
      expect(body.manufacturer).toBe("DIY");
      expect(body.modes).toHaveLength(1);
      expect(body.modes[0].id).toBeDefined();
      expect(body.createdAt).toBeDefined();
    });

    it("returns 400 for missing name", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/user-fixtures",
        payload: { ...validTemplateBody, name: "" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for missing manufacturer", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/user-fixtures",
        payload: { ...validTemplateBody, manufacturer: "" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for empty modes array", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/user-fixtures",
        payload: { ...validTemplateBody, modes: [] },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 for duplicate channel offsets", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/user-fixtures",
        payload: {
          ...validTemplateBody,
          modes: [
            {
              name: "bad",
              channels: [
                { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
                { offset: 0, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
              ],
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/duplicate.*offset/i);
    });

    it("returns 400 for duplicate mode names", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/user-fixtures",
        payload: {
          ...validTemplateBody,
          modes: [
            {
              name: "same",
              channels: [{ offset: 0, name: "Dimmer", type: "Intensity", defaultValue: 0 }],
            },
            {
              name: "same",
              channels: [{ offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 }],
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/duplicate.*mode/i);
    });
  });

  describe("GET /user-fixtures/:id", () => {
    it("returns template by id", async () => {
      const template = userStore.add(validTemplateBody);

      const res = await app.inject({
        method: "GET",
        url: `/user-fixtures/${template.id}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe("My Custom PAR");
    });

    it("returns 404 for unknown id", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/user-fixtures/nonexistent",
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PATCH /user-fixtures/:id", () => {
    it("updates template and returns 200", async () => {
      const template = userStore.add(validTemplateBody);

      const res = await app.inject({
        method: "PATCH",
        url: `/user-fixtures/${template.id}`,
        payload: { name: "Updated PAR" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe("Updated PAR");
      expect(res.json().manufacturer).toBe("DIY");
    });

    it("returns 404 for unknown id", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/user-fixtures/nonexistent",
        payload: { name: "X" },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /user-fixtures/:id", () => {
    it("removes template and returns success", async () => {
      const template = userStore.add(validTemplateBody);

      const res = await app.inject({
        method: "DELETE",
        url: `/user-fixtures/${template.id}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(userStore.getAll()).toHaveLength(0);
    });

    it("returns 404 for unknown id", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/user-fixtures/nonexistent",
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
