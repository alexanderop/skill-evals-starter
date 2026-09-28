import { spawnSync } from "node:child_process";

const env = { ...process.env, SKILL_EVAL_LIST: "1" };
delete env.SKILL_EVAL;
delete env.SKILL_EVAL_MODEL;
const result = spawnSync(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "list",
    "--config",
    "vitest.evals.config.ts",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", env },
);
process.exit(result.status ?? 1);
