import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, vi } from "vitest";
import { __runSkillForTests } from "../../../src/runner.js";
import { SkillRunError } from "../../../src/types.js";
import { brandExpected } from "../../../evals/helpers/cases.js";
import { runLiveHtmlCase } from "../../../evals/helpers/run-live-case.js";

vi.mock("../../../src/index.js", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../../src/index.js")>();
  const runner = await import("../../../src/runner.js");
  return {
    ...original,
    runSkill: async (
      ctx: Parameters<typeof runner.__runSkillForTests>[0],
      input: Parameters<typeof runner.__runSkillForTests>[1],
    ) =>
      await runner.__runSkillForTests(
        ctx,
        input.prompt === "runner-timeout" ? { ...input, timeoutMs: 40 } : input,
        {
          process: {
            executable: process.execPath,
            prefixArgs: [join(process.cwd(), "tests/fixtures/fake-cli.mjs")],
          },
          environment: {
            PATH: process.env.PATH,
            SKILL_EVAL: "1",
            SKILL_EVAL_MODEL: "claude-sonnet-5",
            FAKE_MODE: input.prompt.includes("timeout")
              ? "timeout"
              : "invalid-html",
            ...(process.env.FAKE_CHILD_PID
              ? { FAKE_CHILD_PID: process.env.FAKE_CHILD_PID }
              : {}),
          },
        },
      ),
  };
});

test("annotates a runner failure before rethrowing", async (ctx) => {
  ctx.onTestFinished(async () => {
    await writeFile(
      process.env.NESTED_RUNNER_FAILURE!,
      JSON.stringify({
        annotations: ctx.task.annotations,
        meta: ctx.task.meta,
      }),
    );
  });
  await runLiveHtmlCase(ctx, {
    skill: "brand-guidelines",
    fixture: "product.html",
    input: "input/product.html",
    output: "output/product.html",
    prompt: "runner-timeout",
    expected: brandExpected,
  });
});

test("reports structured live evidence", async (ctx) => {
  await runLiveHtmlCase(ctx, {
    skill: "brand-guidelines",
    fixture: "product.html",
    input: "input/product.html",
    output: "output/product.html",
    prompt: "write invalid HTML",
    expected: brandExpected,
  });
  await writeFile(
    process.env.NESTED_ANNOTATION!,
    JSON.stringify({ annotations: ctx.task.annotations, meta: ctx.task.meta }),
  );
});

test(
  "Vitest timeout finalizes evidence and kills the process tree",
  { timeout: 1_000 },
  async (ctx) => {
    const childPidPath = process.env.NESTED_CHILD_PID!;
    const observationPath = process.env.NESTED_OBSERVATION!;
    let evidencePath: string | undefined;
    ctx.onTestFinished(async () => {
      if (!evidencePath)
        throw new Error("Runner failure did not expose evidence");
      const childPid = Number(await readFile(childPidPath, "utf8"));
      let childAlive = true;
      try {
        process.kill(childPid, 0);
      } catch {
        childAlive = false;
      }
      await access(join(evidencePath, "failure.json"));
      await access(join(evidencePath, "retained-workspace.txt"));
      await writeFile(
        observationPath,
        JSON.stringify({
          childAlive,
          evidencePath,
          finalized: true,
          annotations: ctx.task.annotations,
          meta: ctx.task.meta,
        }),
      );
    });
    process.env.FAKE_CHILD_PID = childPidPath;
    await runLiveHtmlCase(ctx, {
      skill: "brand-guidelines",
      fixture: "product.html",
      input: "input/product.html",
      output: "output/product.html",
      prompt: "timeout",
      expected: brandExpected,
    }).catch((cause: unknown) => {
      if (cause instanceof SkillRunError) evidencePath = cause.evidencePath;
      else evidencePath = ctx.task.meta.skillEval?.evidencePath;
      throw cause;
    });
  },
);
