import { spawnSync } from "node:child_process";

if (!process.env.SKILL_EVAL_MODEL) {
  console.error("SKILL_EVAL_MODEL is required for live evaluations.");
  process.exit(2);
}
const result = spawnSync(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "--config",
    "vitest.evals.config.ts",
    ...process.argv.slice(2),
  ],
  {
    stdio: "inherit",
    env: { ...process.env, SKILL_EVAL: "1" },
  },
);
process.exit(result.status ?? 1);
