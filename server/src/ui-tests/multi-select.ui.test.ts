import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { Page } from "puppeteer";
import { startTestServer, type TestServer } from "./helpers/server-harness.js";
import { openPage, closeBrowser } from "./helpers/browser-harness.js";
import { getSelectedIds } from "./helpers/alpine-helpers.js";
import { TestApiClient } from "./helpers/api-client.js";
import { makeTestPar } from "../test-helpers.js";

describe("Multi-select & Selection Feedback", () => {
  let server: TestServer;
  let api: TestApiClient;
  let page: Page;

  beforeAll(async () => {
    server = await startTestServer();
    api = new TestApiClient(server.baseUrl);
  });

  afterAll(async () => {
    await closeBrowser();
    await server.cleanup();
  });

  beforeEach(async () => {
    await api.deleteAllFixtures();
  });

  it("Ctrl+click on fixture card selects it", async () => {
    await api.addFixture(makeTestPar({ dmxStartAddress: 1, name: "PAR A" }));
    await api.addFixture(makeTestPar({ dmxStartAddress: 10, name: "PAR B" }));

    page = await openPage(server.baseUrl);

    // Get fixture cards
    const cards = await page.$$(".fixture-card");
    expect(cards.length).toBe(2);

    // Ctrl+click first card
    await page.keyboard.down("Control");
    await cards[0].click();
    await page.keyboard.up("Control");

    // Should have 1 selected
    const selected = await getSelectedIds(page);
    expect(selected).toHaveLength(1);

    await page.close();
  });

  it("Ctrl+click multiple cards selects multiple", async () => {
    await api.addFixture(makeTestPar({ dmxStartAddress: 1, name: "PAR A" }));
    await api.addFixture(makeTestPar({ dmxStartAddress: 10, name: "PAR B" }));
    await api.addFixture(makeTestPar({ dmxStartAddress: 20, name: "PAR C" }));

    page = await openPage(server.baseUrl);

    const cards = await page.$$(".fixture-card");
    expect(cards.length).toBe(3);

    // Ctrl+click first two cards
    await page.keyboard.down("Control");
    await cards[0].click();
    await cards[1].click();
    await page.keyboard.up("Control");

    const selected = await getSelectedIds(page);
    expect(selected).toHaveLength(2);

    await page.close();
  });

  it("selected fixtures get fixture-selected class on grid cells", async () => {
    const fixture = await api.addFixture(makeTestPar({ dmxStartAddress: 1, name: "PAR" }));

    page = await openPage(server.baseUrl);

    // Select via Ctrl+click on the fixture card
    const cards = await page.$$(".fixture-card");
    await page.keyboard.down("Control");
    await cards[0].click();
    await page.keyboard.up("Control");

    // Wait for selection to propagate
    await page.evaluate(() => new Promise((r) => setTimeout(r, 200)));

    // Check grid cell has selected class
    const ch1Classes = await page.$eval(
      '.channel-cell[data-address="1"]',
      (el) => el.className,
    );
    expect(ch1Classes).toContain("fixture-selected");

    await page.close();
  });

  it("Escape clears the selection", async () => {
    await api.addFixture(makeTestPar({ dmxStartAddress: 1, name: "PAR" }));

    page = await openPage(server.baseUrl);

    // Select
    const cards = await page.$$(".fixture-card");
    await page.keyboard.down("Control");
    await cards[0].click();
    await page.keyboard.up("Control");

    let selected = await getSelectedIds(page);
    expect(selected).toHaveLength(1);

    // Press Escape
    await page.keyboard.press("Escape");
    await page.evaluate(() => new Promise((r) => setTimeout(r, 200)));

    selected = await getSelectedIds(page);
    expect(selected).toHaveLength(0);

    await page.close();
  });
});
