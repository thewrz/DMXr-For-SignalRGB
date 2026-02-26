import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/types/**",
        "src/dmx/driver-factory.ts",
        "src/test-helpers.ts",
        "src/ofl/ofl-types.ts",
      ],
    },
  },
});
