import { test, expect } from "@playwright/test";

const TEST_FIXTURE = {
  name: "E2E Test PAR",
  mode: "3-channel",
  dmxStartAddress: 1,
  channelCount: 3,
  channels: [
    { offset: 0, name: "Red", type: "ColorIntensity", color: "Red", defaultValue: 0 },
    { offset: 1, name: "Green", type: "ColorIntensity", color: "Green", defaultValue: 0 },
    { offset: 2, name: "Blue", type: "ColorIntensity", color: "Blue", defaultValue: 0 },
  ],
};

test.describe("Fixture CRUD", () => {
  test.afterEach(async ({ request }) => {
    // Clean up: delete all fixtures
    const res = await request.get("/fixtures");
    if (res.ok()) {
      const fixtures = await res.json();
      for (const f of fixtures) {
        await request.delete(`/fixtures/${f.id}`);
      }
    }
  });

  test("add fixture via API and verify in grid", async ({ request, page }) => {
    // Add fixture via API
    const addRes = await request.post("/fixtures", { data: TEST_FIXTURE });
    expect(addRes.ok()).toBe(true);
    const fixture = await addRes.json();
    expect(fixture.name).toBe("E2E Test PAR");

    // Verify it shows in the fixture list
    await page.goto("/");
    await expect(page.locator(`text=${fixture.name}`).first()).toBeVisible({ timeout: 5000 });
  });

  test("delete fixture via API removes from list", async ({ request, page }) => {
    // Add then delete
    const addRes = await request.post("/fixtures", { data: TEST_FIXTURE });
    const fixture = await addRes.json();

    const delRes = await request.delete(`/fixtures/${fixture.id}`);
    expect(delRes.ok()).toBe(true);

    // Verify fixture list is empty
    const listRes = await request.get("/fixtures");
    const fixtures = await listRes.json();
    expect(fixtures).toHaveLength(0);
  });

  test("edit fixture name via API", async ({ request }) => {
    const addRes = await request.post("/fixtures", { data: TEST_FIXTURE });
    const fixture = await addRes.json();

    const patchRes = await request.patch(`/fixtures/${fixture.id}`, {
      data: { name: "Renamed PAR" },
    });
    expect(patchRes.ok()).toBe(true);
    const updated = await patchRes.json();
    expect(updated.name).toBe("Renamed PAR");
  });
});
