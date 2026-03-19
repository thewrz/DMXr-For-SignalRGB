import { test, expect } from "@playwright/test";

test.describe("Settings", () => {
  test("health endpoint exposes server info", async ({ request }) => {
    const res = await request.get("/health");
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(["ok", "degraded"]).toContain(body.status);
    expect(body.driver).toBeDefined();
    expect(body.uptime).toBeGreaterThan(0);
    expect(body.fixtureCount ?? 0).toBeGreaterThanOrEqual(0);
  });

  test("OFL cache stats are accessible", async ({ request }) => {
    const res = await request.get("/api/settings/ofl-cache");
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(body.entryCount).toBeGreaterThanOrEqual(0);
    expect(body.totalSize).toBeGreaterThanOrEqual(0);
  });
});
