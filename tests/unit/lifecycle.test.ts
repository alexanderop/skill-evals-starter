import { access, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { __runSkillForTests } from "../../src/runner.js";
import type { RunResult } from "../../src/types.js";

test("the real Vitest finished hook preserves outputs and removes the successful workspace", async (ctx) => {
  let result: RunResult | undefined;
  ctx.onTestFinished(async () => {
    if (!result) return;
    try {
      await expect(access(result.project.path)).rejects.toThrow();
      await expect(
        readFile(
          join(result.evidencePath, "project/output/result.txt"),
          "utf8",
        ),
      ).resolves.toBe("generated");
    } finally {
      await rm(result.project.path, { recursive: true, force: true });
      await rm(result.evidencePath, { recursive: true, force: true });
    }
  });
  result = await __runSkillForTests(
    ctx,
    { skill: "brand-guidelines", prompt: "write output" },
    {
      process: {
        executable: process.execPath,
        prefixArgs: [join(process.cwd(), "tests/fixtures/fake-cli.mjs")],
      },
      environment: {
        PATH: process.env.PATH,
        SKILL_EVAL: "1",
        SKILL_EVAL_MODEL: "claude-sonnet-5",
      },
    },
  );
  await expect(result.project.readFile("output/result.txt")).resolves.toBe(
    "generated",
  );
});
