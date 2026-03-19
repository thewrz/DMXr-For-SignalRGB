import { test, expect } from "@playwright/test";

test.describe("Server health", () => {
  test("GET /health returns 200 with status", async ({ request }) => {
    const res = await request.get("/health");

    expect(res.ok()).toBe(true);
    const body = await res.json();
    // With DMX_DRIVER=null the status may be "degraded" (no hardware)
    expect(["ok", "degraded"]).toContain(body.status);
    expect(body.driver).toBeDefined();
  });

  test("web UI loads successfully", async ({ page }) => {
    await page.goto("/");

    // Alpine.js app should initialize — look for the main header
    await expect(page.locator("header")).toBeVisible();
    // Page title should contain DMXr
    await expect(page).toHaveTitle(/DMXr/i);
  });
});
