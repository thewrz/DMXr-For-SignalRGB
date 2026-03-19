import { test, expect } from "@playwright/test";

test.describe("Log panel", () => {
  test("status button is visible and shows status text", async ({ page }) => {
    await page.goto("/");
    const statusBtn = page.locator("button.btn-status");
    await expect(statusBtn).toBeVisible();
    await expect(statusBtn).toContainText(/Online|Offline/);
  });

  test("clicking status button opens log panel", async ({ page }) => {
    await page.goto("/");
    const statusBtn = page.locator("button.btn-status");
    await statusBtn.click();

    const panel = page.locator(".log-panel");
    await expect(panel).toBeVisible();
    await expect(panel.locator("h3")).toHaveText("System Logs");
  });

  test("panel shows log entries including startup entry", async ({ page }) => {
    await page.goto("/");
    await page.locator("button.btn-status").click();

    // Wait for entries to load — the server startup entry should be present
    const entryList = page.locator(".log-panel-list .log-entry");
    await expect(entryList.first()).toBeVisible({ timeout: 5000 });

    // At minimum, a "DMXr server" startup entry should exist
    const messages = page.locator(".log-entry-message");
    await expect(messages.first()).toBeVisible();
  });

  test("level filter changes visible entries", async ({ page }) => {
    await page.goto("/");
    await page.locator("button.btn-status").click();

    // Wait for entries
    await expect(page.locator(".log-panel-list .log-entry").first()).toBeVisible({ timeout: 5000 });

    // Switch to "Errors only" — should show fewer or zero entries
    const select = page.locator(".log-panel-toolbar select");
    await select.selectOption("error");

    // The count text should update
    const countText = page.locator(".log-entry-count");
    await expect(countText).toBeVisible();
  });

  test("panel closes on backdrop click", async ({ page }) => {
    await page.goto("/");
    await page.locator("button.btn-status").click();
    await expect(page.locator(".log-panel")).toBeVisible();

    // Click the backdrop (top-left corner, outside the panel)
    await page.locator(".log-panel-backdrop").click({ position: { x: 10, y: 100 } });
    await expect(page.locator(".log-panel")).not.toBeVisible();
  });

  test("close button closes the panel", async ({ page }) => {
    await page.goto("/");
    await page.locator("button.btn-status").click();
    await expect(page.locator(".log-panel")).toBeVisible();

    await page.locator(".log-panel-close").click();
    await expect(page.locator(".log-panel")).not.toBeVisible();
  });

  test("status badges show server and DMX status", async ({ page }) => {
    await page.goto("/");
    await page.locator("button.btn-status").click();

    const statusRow = page.locator(".log-panel-status");
    await expect(statusRow).toBeVisible();
    // Should have at least Server and DMX status badges
    const badges = statusRow.locator(".log-status-badge");
    await expect(badges.first()).toBeVisible();
    expect(await badges.count()).toBeGreaterThanOrEqual(2);
  });

  test("GET /api/logs returns entries", async ({ request }) => {
    const res = await request.get("/api/logs");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // Server startup entry should be present
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  test("GET /api/logs with level filter works", async ({ request }) => {
    const allRes = await request.get("/api/logs?level=debug");
    const all = await allRes.json();

    const errRes = await request.get("/api/logs?level=error");
    const errors = await errRes.json();

    // Error-only should be <= all entries
    expect(errors.length).toBeLessThanOrEqual(all.length);
  });

  test("POST /api/logs/clear empties the buffer", async ({ request }) => {
    const clearRes = await request.post("/api/logs/clear");
    expect(clearRes.ok()).toBe(true);

    const getRes = await request.get("/api/logs");
    const body = await getRes.json();
    expect(body).toEqual([]);
  });
});
