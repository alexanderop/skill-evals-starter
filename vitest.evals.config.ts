import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include:
      process.env.SKILL_EVAL === "1" || process.env.SKILL_EVAL_LIST === "1"
        ? ["evals/**/*.eval.ts"]
        : [],
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 240_000,
    hookTimeout: 30_000,
    reporters: ["default", "json"],
    outputFile: { json: ".vitest/results/live-evals.json" },
  },
});
