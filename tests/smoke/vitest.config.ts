import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/smoke/**/*.smoke.ts"],
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 360_000,
    hookTimeout: 30_000,
    reporters: ["default", "json"],
    outputFile: { json: ".vitest/results/agent-smoke.json" },
  },
});
