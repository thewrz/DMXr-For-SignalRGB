import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { Page } from "puppeteer";
import { startTestServer, type TestServer } from "./helpers/server-harness.js";
import { openPage, closeBrowser } from "./helpers/browser-harness.js";
import { getAlpineState, getFixtureCount } from "./helpers/alpine-helpers.js";
import { captureScreenshot, compareWithBaseline } from "./helpers/screenshot.js";
import { TestApiClient } from "./helpers/api-client.js";
import { makeTestPar, makeTestMovingHead } from "../test-helpers.js";

describe("DMX Grid Rendering", () => {
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

  it("renders an empty grid with 512 channel cells", async () => {
    page = await openPage(server.baseUrl);

    const cellCount = await page.$$eval(
      ".channel-cell",
      (cells) => cells.length,
    );
    expect(cellCount).toBe(512);

    const fixtureCount = await getFixtureCount(page);
    expect(fixtureCount).toBe(0);

    await page.close();
  });

  it("renders fixtures at correct grid positions with correct CSS classes", async () => {
    // Seed two fixtures: PAR at 1 (3ch), mover at 40 (5ch)
    await api.addFixture(makeTestPar({ dmxStartAddress: 1 }));
    await api.addFixture(makeTestMovingHead({ dmxStartAddress: 40 }));

    page = await openPage(server.baseUrl);

    // PAR fixture occupies channels 1-3
    const ch1Classes = await page.$eval(
      '.channel-cell[data-address="1"]',
      (el) => el.className,
    );
    expect(ch1Classes).toContain("fixture-0");
    expect(ch1Classes).toContain("fixture-start");

    const ch3Classes = await page.$eval(
      '.channel-cell[data-address="3"]',
      (el) => el.className,
    );
    expect(ch3Classes).toContain("fixture-0");
    expect(ch3Classes).toContain("fixture-end");

    // Channel 4 should be empty (no fixture classes)
    const ch4Classes = await page.$eval(
      '.channel-cell[data-address="4"]',
      (el) => el.className,
    );
    expect(ch4Classes).not.toContain("fixture-");

    // Moving head occupies channels 40-44
    const ch40Classes = await page.$eval(
      '.channel-cell[data-address="40"]',
      (el) => el.className,
    );
    expect(ch40Classes).toContain("fixture-1");
    expect(ch40Classes).toContain("fixture-start");

    const ch44Classes = await page.$eval(
      '.channel-cell[data-address="44"]',
      (el) => el.className,
    );
    expect(ch44Classes).toContain("fixture-1");
    expect(ch44Classes).toContain("fixture-end");

    // Verify Alpine state matches
    const state = await getAlpineState(page);
    expect(state.fixtures).toHaveLength(2);

    await page.close();
  });

  it("renders fixture cards in the fixture list", async () => {
    await api.addFixture(makeTestPar({ dmxStartAddress: 1, name: "Front PAR" }));
    await api.addFixture(makeTestMovingHead({ dmxStartAddress: 40, name: "Mover Left" }));

    page = await openPage(server.baseUrl);

    const cardNames = await page.$$eval(
      ".fixture-card .fixture-name",
      (els) => els.map((el) => el.textContent?.trim()),
    );

    expect(cardNames).toContain("Front PAR");
    expect(cardNames).toContain("Mover Left");

    await page.close();
  });

  it("grid-API roundtrip: server state matches DOM rendering", async () => {
    const created = await api.addFixture(makeTestPar({ dmxStartAddress: 15 }));

    page = await openPage(server.baseUrl);

    // Verify the grid cell at address 15 is the fixture start
    const isStart = await page.$eval(
      '.channel-cell[data-address="15"]',
      (el) => el.classList.contains("fixture-start"),
    );
    expect(isStart).toBe(true);

    // Verify API returns the same fixture
    const fixtures = await api.getFixtures();
    expect(fixtures).toHaveLength(1);
    expect(fixtures[0].dmxStartAddress).toBe(15);
    expect(fixtures[0].id).toBe(created.id);

    await page.close();
  });

  it("visual snapshot: populated grid", async () => {
    await api.addFixture(makeTestPar({ dmxStartAddress: 1, name: "PAR 1" }));
    await api.addFixture(makeTestMovingHead({ dmxStartAddress: 40, name: "Mover" }));
    await api.addFixture(makeTestPar({ dmxStartAddress: 100, name: "PAR 2" }));

    page = await openPage(server.baseUrl);

    const result = await compareWithBaseline(page, "grid-populated");
    expect(result.diffPercentage).toBeLessThan(2);

    await page.close();
  });
});
