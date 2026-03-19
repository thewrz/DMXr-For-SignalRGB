import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "DMX_DRIVER=null tsx src/index.ts",
    url: "http://localhost:8080/health",
    reuseExistingServer: !process.env["CI"],
    timeout: 10_000,
  },
});
