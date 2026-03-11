import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/ui-tests/**/*.ui.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 15_000,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
