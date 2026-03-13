import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.contract.test.ts"],
    testTimeout: 30_000,
  },
});
