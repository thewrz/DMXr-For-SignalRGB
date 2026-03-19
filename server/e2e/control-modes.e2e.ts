import { test, expect } from "@playwright/test";

test.describe("Control modes", () => {
  test("blackout and resume via API", async ({ request }) => {
    // Activate blackout
    const blackoutRes = await request.post("/control/blackout", {
      data: {},
    });
    expect(blackoutRes.ok()).toBe(true);
    const blackout = await blackoutRes.json();
    expect(blackout.action).toBe("blackout");

    // Verify health reports blackout mode
    const healthRes = await request.get("/health");
    const health = await healthRes.json();
    expect(health.controlMode).toBe("blackout");

    // Resume normal
    const resumeRes = await request.post("/control/resume", {
      data: {},
    });
    expect(resumeRes.ok()).toBe(true);
    const resume = await resumeRes.json();
    expect(resume.action).toBe("resume");

    // Verify health reports normal
    const healthAfter = await (await request.get("/health")).json();
    expect(healthAfter.controlMode).toBe("normal");
  });

  test("whiteout and resume via API", async ({ request }) => {
    const whiteoutRes = await request.post("/control/whiteout", {
      data: {},
    });
    expect(whiteoutRes.ok()).toBe(true);
    const whiteout = await whiteoutRes.json();
    expect(whiteout.action).toBe("whiteout");

    // Resume
    await request.post("/control/resume", { data: {} });
  });
});
