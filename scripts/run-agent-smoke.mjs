import { spawnSync } from "node:child_process";

if (!process.env.SKILL_EVAL_AGENT || !process.env.SKILL_EVAL_MODEL) {
  console.error(
    "SKILL_EVAL_AGENT and SKILL_EVAL_MODEL are required for the agent smoke.",
  );
  process.exit(2);
}

const result = spawnSync(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "--config",
    "tests/smoke/vitest.config.ts",
    ...process.argv.slice(2),
  ],
  {
    stdio: "inherit",
    env: { ...process.env, SKILL_EVAL: "1" },
  },
);
process.exit(result.status ?? 1);
