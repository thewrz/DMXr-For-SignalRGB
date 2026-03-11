import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Page } from "puppeteer";
import { startTestServer, type TestServer } from "./helpers/server-harness.js";
import { openPage, closeBrowser } from "./helpers/browser-harness.js";
import { captureScreenshot } from "./helpers/screenshot.js";

describe("Settings Modal", () => {
  let server: TestServer;
  let page: Page;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await closeBrowser();
    await server.cleanup();
  });

  it("opens settings modal when clicking settings button", async () => {
    page = await openPage(server.baseUrl);

    // Click the settings button (btn-settings class in header)
    await page.click(".btn-settings");

    await page.evaluate(() => new Promise((r) => setTimeout(r, 500)));

    // Check if settings modal is visible via Alpine state
    const showSettings = await page.evaluate(() => {
      const el = document.querySelector("[x-data]") as any;
      return el?._x_dataStack?.[0]?.showSettings ?? false;
    });
    expect(showSettings).toBe(true);

    await captureScreenshot(page, "settings-modal-open");
    await page.close();
  });

  it("settings modal closes when clicking close button", async () => {
    page = await openPage(server.baseUrl);

    // Open settings
    await page.click(".btn-settings");
    await page.evaluate(() => new Promise((r) => setTimeout(r, 500)));

    // Click the × close button inside the settings modal
    await page.click(".settings-modal .modal-close");
    await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));

    const showSettings = await page.evaluate(() => {
      const el = document.querySelector("[x-data]") as any;
      return el?._x_dataStack?.[0]?.showSettings ?? false;
    });
    expect(showSettings).toBe(false);

    await page.close();
  });
});
