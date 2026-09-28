import { spawnSync } from "node:child_process";

const env = { ...process.env };
delete env.SKILL_EVAL;
delete env.SKILL_EVAL_MODEL;
const result = spawnSync(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "--config",
    "vitest.config.ts",
    ...process.argv.slice(2),
  ],
  {
    stdio: "inherit",
    env,
  },
);
process.exit(result.status ?? 1);
