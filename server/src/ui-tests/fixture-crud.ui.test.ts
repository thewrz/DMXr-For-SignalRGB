import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { Page } from "puppeteer";
import { startTestServer, type TestServer } from "./helpers/server-harness.js";
import { openPage, closeBrowser } from "./helpers/browser-harness.js";
import { getFixtureCount, waitForAlpineState } from "./helpers/alpine-helpers.js";
import { TestApiClient } from "./helpers/api-client.js";
import { makeTestPar, makeTestMovingHead } from "../test-helpers.js";

describe("Fixture CRUD via UI", () => {
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

  it("shows empty state when no fixtures exist", async () => {
    page = await openPage(server.baseUrl);

    const count = await getFixtureCount(page);
    expect(count).toBe(0);

    // No fixture cards should be visible
    const cardCount = await page.$$eval(".fixture-card", (els) => els.length);
    expect(cardCount).toBe(0);

    await page.close();
  });

  it("shows fixture card after API-seeded fixture", async () => {
    await api.addFixture(makeTestPar({ dmxStartAddress: 1, name: "Seeded PAR" }));

    page = await openPage(server.baseUrl);

    const count = await getFixtureCount(page);
    expect(count).toBe(1);

    const cardNames = await page.$$eval(
      ".fixture-card .fixture-name",
      (els) => els.map((el) => el.textContent?.trim()),
    );
    expect(cardNames).toContain("Seeded PAR");

    await page.close();
  });

  it("fixture deletion via API updates UI on reload", async () => {
    const fixture = await api.addFixture(makeTestPar({ dmxStartAddress: 1, name: "To Delete" }));

    page = await openPage(server.baseUrl);
    expect(await getFixtureCount(page)).toBe(1);
    await page.close();

    // Delete via API
    await api.deleteFixture(fixture.id);

    // Reopen page — should show 0 fixtures
    page = await openPage(server.baseUrl);
    expect(await getFixtureCount(page)).toBe(0);

    // Grid cell should be empty
    const ch1Classes = await page.$eval(
      '.channel-cell[data-address="1"]',
      (el) => el.className,
    );
    expect(ch1Classes).not.toContain("fixture-");

    await page.close();
  });

  it("health endpoint returns online status", async () => {
    const health = await api.getHealth();
    expect(health.status).toBe("ok");
  });

  it("multiple fixtures render in correct order", async () => {
    await api.addFixture(makeTestPar({ dmxStartAddress: 50, name: "PAR B" }));
    await api.addFixture(makeTestPar({ dmxStartAddress: 10, name: "PAR A" }));
    await api.addFixture(makeTestMovingHead({ dmxStartAddress: 100, name: "Mover" }));

    page = await openPage(server.baseUrl);

    const count = await getFixtureCount(page);
    expect(count).toBe(3);

    // All three should have fixture-start cells
    for (const addr of [10, 50, 100]) {
      const isStart = await page.$eval(
        `.channel-cell[data-address="${addr}"]`,
        (el) => el.classList.contains("fixture-start"),
      );
      expect(isStart).toBe(true);
    }

    await page.close();
  });
});
