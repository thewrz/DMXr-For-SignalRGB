import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { Page } from "puppeteer";
import { startTestServer, type TestServer } from "./helpers/server-harness.js";
import { openPage, closeBrowser } from "./helpers/browser-harness.js";
import { captureScreenshot, compareWithBaseline } from "./helpers/screenshot.js";
import { TestApiClient } from "./helpers/api-client.js";
import { makeTestPar } from "../test-helpers.js";

describe("Responsive Layout", () => {
  let server: TestServer;
  let api: TestApiClient;
  let page: Page;

  beforeAll(async () => {
    server = await startTestServer();
    api = new TestApiClient(server.baseUrl);
    await api.addFixture(makeTestPar({ dmxStartAddress: 1, name: "PAR" }));
  });

  afterAll(async () => {
    await closeBrowser();
    await server.cleanup();
  });

  it("desktop layout: sidebar toggles open, grid renders fully", async () => {
    page = await openPage(server.baseUrl);
    await page.setViewport({ width: 1920, height: 1080 });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));

    // Sidebar starts collapsed by default (sidebarOpen: false in app.js).
    // Toggle it open via the sidebar toggle button.
    const toggleBtn = await page.$(".sidebar-toggle");
    if (toggleBtn) {
      await toggleBtn.click();
      await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));
    }

    // After toggling, sidebar should be visible
    const sidebarVisible = await page.$eval(
      ".sidebar",
      (el) => {
        const style = window.getComputedStyle(el);
        return style.display !== "none" && style.opacity !== "0";
      },
    );
    expect(sidebarVisible).toBe(true);

    // Grid should have all 512 cells
    const cellCount = await page.$$eval(".channel-cell", (els) => els.length);
    expect(cellCount).toBe(512);

    await captureScreenshot(page, "layout-desktop");
    await page.close();
  });

  it("narrow viewport: no horizontal overflow", async () => {
    page = await openPage(server.baseUrl);
    await page.setViewport({ width: 800, height: 600 });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));

    // Check that the body doesn't overflow horizontally
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    await captureScreenshot(page, "layout-narrow");
    await page.close();
  });

  it("visual snapshot: desktop layout", async () => {
    page = await openPage(server.baseUrl);
    await page.setViewport({ width: 1280, height: 900 });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));

    const result = await compareWithBaseline(page, "layout-default");
    expect(result.diffPercentage).toBeLessThan(2);

    await page.close();
  });
});
