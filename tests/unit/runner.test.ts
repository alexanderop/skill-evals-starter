import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { test, expect } from "vitest";
import { __runSkillForTests, parseStreamJson } from "../../src/runner.js";
import {
  SkillRunError,
  type FinishedTest,
  type RunContext,
} from "../../src/types.js";
import type { OnTestFinishedHandler } from "vitest";

function harness(signal?: AbortSignal): {
  ctx: RunContext;
  finish(state: string): Promise<void>;
} {
  let cleanup: OnTestFinishedHandler | undefined;
  const activeSignal = signal ?? new AbortController().signal;
  return {
    ctx: {
      signal: activeSignal,
      onTestFinished(value) {
        cleanup = value;
      },
    },
    async finish(state) {
      await cleanup?.({
        task: { result: { state } },
      } as unknown as FinishedTest);
    },
  };
}

const fake = {
  executable: process.execPath,
  prefixArgs: [join(process.cwd(), "tests/fixtures/fake-cli.mjs")],
} as const;

function environment(mode?: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    SKILL_EVAL: "1",
    SKILL_EVAL_MODEL: "claude-sonnet-5",
    ...(mode ? { FAKE_MODE: mode } : {}),
  };
}

async function removeEvidenceAndRetainedWorkspace(
  evidencePath: string,
): Promise<void> {
  const retained = await readFile(
    join(evidencePath, "retained-workspace.txt"),
    "utf8",
  ).catch(() => undefined);
  if (retained) await rm(retained.trim(), { recursive: true, force: true });
  await rm(evidencePath, { recursive: true, force: true });
}

test("parses validated stream events", () => {
  expect(parseStreamJson('{"type":"result","ok":true}\n')).toEqual([
    { type: "result", ok: true },
  ]);
  expect(() => parseStreamJson("[]\n")).toThrowError(SkillRunError);
  expect(() => parseStreamJson("nope\n")).toThrowError(SkillRunError);
});

test("gate runs before any child process", async () => {
  const marker = join(process.cwd(), ".eval-artifacts", "should-not-exist");
  const { ctx } = harness();
  await expect(
    __runSkillForTests(
      ctx,
      { skill: "brand-guidelines", prompt: "work" },
      {
        process: fake,
        environment: { SKILL_EVAL: "0", FAKE_MARKER: marker },
      },
    ),
  ).rejects.toMatchObject({ code: "model-disabled" });
  await expect(access(marker)).rejects.toThrow();
});

test("a pre-aborted signal never starts the live process", async () => {
  const controller = new AbortController();
  controller.abort();
  const { ctx, finish } = harness(controller.signal);
  const failure = await __runSkillForTests(
    ctx,
    { skill: "brand-guidelines", prompt: "work" },
    {
      process: fake,
      environment: environment(),
    },
  ).catch((cause: unknown) => cause);
  expect(failure).toMatchObject({ code: "cancelled" });
  await finish("fail");
  if (failure instanceof SkillRunError && failure.evidencePath)
    await removeEvidenceAndRetainedWorkspace(failure.evidencePath);
});

test("rejects aliases and unsafe fixture paths", async () => {
  const { ctx } = harness();
  await expect(
    __runSkillForTests(
      ctx,
      { skill: "brand-guidelines", prompt: "work" },
      {
        process: fake,
        environment: { SKILL_EVAL: "1", SKILL_EVAL_MODEL: "sonnet" },
      },
    ),
  ).rejects.toMatchObject({ code: "invalid-input" });
  await expect(
    __runSkillForTests(
      ctx,
      {
        skill: "brand-guidelines",
        prompt: "work",
        files: { "./.git/config": "x" },
      },
      {
        process: fake,
        environment: environment(),
      },
    ),
  ).rejects.toMatchObject({ code: "invalid-input" });
  await expect(
    __runSkillForTests(
      ctx,
      {
        skill: "brand-guidelines",
        prompt: "work",
        files: { "./.claude/skills/x/SKILL.md": "x" },
      },
      {
        process: fake,
        environment: environment(),
      },
    ),
  ).rejects.toMatchObject({ code: "invalid-input" });
  await expect(
    __runSkillForTests(
      ctx,
      {
        skill: "brand-guidelines",
        prompt: "work",
        files: { ".GIT/config": "x" },
      },
      {
        process: fake,
        environment: environment(),
      },
    ),
  ).rejects.toMatchObject({ code: "invalid-input" });
  await expect(
    __runSkillForTests(
      ctx,
      {
        skill: "brand-guidelines",
        prompt: "work",
        files: { "../escape": "x" },
      },
      {
        process: fake,
        environment: environment(),
      },
    ),
  ).rejects.toMatchObject({ code: "invalid-input" });
  await expect(
    __runSkillForTests(
      ctx,
      {
        skill: "brand-guidelines",
        prompt: "work",
        files: { ".git/config": "x" },
      },
      {
        process: fake,
        environment: environment(),
      },
    ),
  ).rejects.toMatchObject({ code: "invalid-input" });
});

test("runs a fake CLI, exposes project data, and cleans up after passing assertions", async () => {
  const lifecycle = harness();
  const result = await __runSkillForTests(
    lifecycle.ctx,
    {
      skill: "brand-guidelines",
      prompt: "write output",
      files: { "input.txt": "seed" },
    },
    { process: fake, environment: environment() },
  );
  expect(await result.project.readFile("output/result.txt")).toBe("generated");
  expect(await result.project.exists("missing.txt")).toBe(false);
  expect(
    await result.project.readFileOrUndefined("missing.txt"),
  ).toBeUndefined();
  expect(await result.project.git(["status", "--short"])).toContain("output/");
  expect(result.toolEvents).toEqual([
    expect.objectContaining({ kind: "tool-use", name: "Write", id: "tool-1" }),
  ]);
  expect(result.usage).toEqual({
    known: true,
    inputTokens: 12,
    outputTokens: 4,
    costUsd: 0.01,
  });
  expect(result.execution).toMatchObject({
    requestedModel: "claude-sonnet-5",
    observedModel: "claude-sonnet-5",
  });
  expect(
    await readFile(join(result.evidencePath, "stdout.jsonl"), "utf8"),
  ).toContain('"tool_use"');
  await lifecycle.finish("pass");
  await expect(access(result.project.path)).rejects.toThrow();
  await expect(access(result.evidencePath)).resolves.toBeUndefined();
  await expect(
    readFile(join(result.evidencePath, "project/output/result.txt"), "utf8"),
  ).resolves.toBe("generated");
  await rm(result.evidencePath, { recursive: true });
});

test("baseline omits the skill and disables slash commands while preserving the prompt", async () => {
  const lifecycle = harness();
  const argsPath = join(
    process.cwd(),
    ".eval-artifacts",
    `args-${Date.now()}.json`,
  );
  const prompt = "Apply the requested styling to the page.";
  const result = await __runSkillForTests(
    lifecycle.ctx,
    { skill: "brand-guidelines", prompt, baseline: true },
    { process: fake, environment: { ...environment(), FAKE_ARGS: argsPath } },
  );
  expect(
    await result.project.exists(".claude/skills/brand-guidelines/SKILL.md"),
  ).toBe(false);
  const args = JSON.parse(await readFile(argsPath, "utf8")) as unknown;
  expect(args).toEqual(
    expect.arrayContaining(["--disable-slash-commands", prompt]),
  );
  await lifecycle.finish("pass");
  await rm(argsPath);
});

test("accepts a newly added skill without a registry edit", async () => {
  const skill = `unit-test-${randomUUID()}`;
  const skillPath = join(process.cwd(), "skills", skill);
  await mkdir(skillPath);
  try {
    await expect(
      __runSkillForTests(
        harness().ctx,
        { skill, prompt: "write output" },
        { process: fake, environment: environment() },
      ),
    ).rejects.toMatchObject({ code: "invalid-input" });
    await writeFile(join(skillPath, "SKILL.md"), "# Unit test skill\n");
    const lifecycle = harness();
    const result = await __runSkillForTests(
      lifecycle.ctx,
      { skill, prompt: "write output" },
      { process: fake, environment: environment() },
    );
    expect(
      await result.project.exists(`.claude/skills/${skill}/SKILL.md`),
    ).toBe(true);
    await lifecycle.finish("pass");
  } finally {
    await rm(skillPath, { recursive: true, force: true });
  }
});

test("retains the workspace when assertions fail", async () => {
  const lifecycle = harness();
  const result = await __runSkillForTests(
    lifecycle.ctx,
    { skill: "theme-factory", prompt: "write output" },
    { process: fake, environment: environment() },
  );
  await lifecycle.finish("fail");
  await expect(access(result.project.path)).resolves.toBeUndefined();
  expect(
    await readFile(join(result.evidencePath, "retained-workspace.txt"), "utf8"),
  ).toContain(result.project.path);
  await removeEvidenceAndRetainedWorkspace(result.evidencePath);
});

test("classifies protocol, process, and budget failures", async () => {
  for (const [mode, code] of [
    ["invalid-json", "protocol-failed"],
    ["failure", "process-failed"],
    ["budget", "budget-exceeded"],
    ["no-terminal", "protocol-failed"],
    ["error-terminal", "protocol-failed"],
    ["malformed-terminal", "protocol-failed"],
  ] as const) {
    const { ctx, finish } = harness();
    let failure: unknown;
    try {
      await __runSkillForTests(
        ctx,
        { skill: "brand-guidelines", prompt: "work" },
        {
          process: fake,
          environment: environment(mode),
        },
      );
    } catch (cause) {
      failure = cause;
    }
    expect(failure).toMatchObject({ code });
    await finish("fail");
    if (failure instanceof SkillRunError && failure.evidencePath) {
      await removeEvidenceAndRetainedWorkspace(failure.evidencePath);
    }
  }
});

test("times out and cancels process groups", async () => {
  const timed = harness();
  const childPidPath = join(
    process.cwd(),
    ".eval-artifacts",
    `child-${Date.now()}.pid`,
  );
  const timeoutFailure = await __runSkillForTests(
    timed.ctx,
    { skill: "brand-guidelines", prompt: "work", timeoutMs: 40 },
    {
      process: fake,
      environment: {
        ...environment("timeout"),
        FAKE_CHILD_PID: childPidPath,
      },
    },
  ).catch((cause: unknown) => cause);
  expect(timeoutFailure).toMatchObject({ code: "timeout" });
  const childPid = Number(await readFile(childPidPath, "utf8"));
  expect(() => process.kill(childPid, 0)).toThrow();
  await rm(childPidPath);
  await timed.finish("fail");
  if (timeoutFailure instanceof SkillRunError && timeoutFailure.evidencePath) {
    await removeEvidenceAndRetainedWorkspace(timeoutFailure.evidencePath);
  }

  const controller = new AbortController();
  const cancelled = harness(controller.signal);
  const pending = __runSkillForTests(
    cancelled.ctx,
    { skill: "brand-guidelines", prompt: "work", timeoutMs: 5_000 },
    { process: fake, environment: environment("timeout") },
  );
  setTimeout(() => controller.abort(), 40);
  const cancelFailure = await pending.catch((cause: unknown) => cause);
  expect(cancelFailure).toMatchObject({ code: "cancelled" });
  await cancelled.finish("fail");
  if (cancelFailure instanceof SkillRunError && cancelFailure.evidencePath) {
    await removeEvidenceAndRetainedWorkspace(cancelFailure.evidencePath);
  }
});

test("refuses to read symlink outputs", async () => {
  const lifecycle = harness();
  const result = await __runSkillForTests(
    lifecycle.ctx,
    {
      skill: "brand-guidelines",
      prompt: "work",
      files: { "input.txt": "secret" },
    },
    { process: fake, environment: environment("symlink") },
  );
  await expect(
    result.project.readFile("output/link.txt"),
  ).rejects.toMatchObject({ code: "invalid-input" });
  await lifecycle.finish("fail");
  await removeEvidenceAndRetainedWorkspace(result.evidencePath);
});
