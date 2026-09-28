import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/fixtures/vitest-live/live-fixture.test.ts"],
    reporters: ["default", "json"],
    outputFile: {
      json: process.env.NESTED_JSON_REPORT ?? ".vitest/nested-live.json",
    },
    testTimeout: 5_000,
    hookTimeout: 5_000,
    maxWorkers: 1,
    fileParallelism: false,
  },
});
