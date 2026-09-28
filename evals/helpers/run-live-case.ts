import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { expect, type TestContext } from "vitest";
import { runSkill, SkillRunError, type RunResult } from "../../src/index.js";
import { tryParseAgentId } from "../../src/agents/registry.js";
import {
  checkHtml,
  openHtml,
  type HtmlExpectations,
} from "./html-assertions.js";

export async function runLiveHtmlCase(
  ctx: TestContext,
  options: Readonly<{
    skill: string;
    prompt: string;
    fixture: "product.html" | "styled-product.html";
    input: string;
    output: string;
    expected: HtmlExpectations;
  }>,
): Promise<void> {
  const failure: { value?: Readonly<Record<string, unknown>> } = {};
  let settleHelper!: () => void;
  const helperSettled = new Promise<void>((resolvePromise) => {
    settleHelper = resolvePromise;
  });
  ctx.onTestFinished(async () => await helperSettled);
  try {
    await runLiveHtmlCaseAttempt(ctx, options, failure);
  } finally {
    settleHelper();
  }
}

async function runLiveHtmlCaseAttempt(
  ctx: TestContext,
  options: Readonly<{
    skill: string;
    prompt: string;
    fixture: "product.html" | "styled-product.html";
    input: string;
    output: string;
    expected: HtmlExpectations;
  }>,
  failure: { value?: Readonly<Record<string, unknown>> },
): Promise<void> {
  let result: RunResult;
  try {
    result = await runSkill(ctx, {
      skill: options.skill,
      prompt: options.prompt,
      files: {
        [options.input]: await readFile(
          new URL(`../../fixtures/${options.fixture}`, import.meta.url),
          "utf8",
        ),
      },
      timeoutMs: 180_000,
    });
  } catch (cause) {
    if (cause instanceof SkillRunError) {
      ctx.task.meta.skillEval = {
        agent: tryParseAgentId(process.env.SKILL_EVAL_AGENT),
        evidencePath: cause.evidencePath ?? "unavailable",
        requestedModel: process.env.SKILL_EVAL_MODEL ?? null,
        usageKnown: false,
        costUsd: null,
        processStatus: "failed",
        errorCode: cause.code,
      };
      failure.value = {
        code: cause.code,
        message: cause.message,
        evidencePath: cause.evidencePath ?? "unavailable",
      };
      await annotateSafely(
        ctx,
        `Skill runner failed. Evidence: ${basename(String(failure.value.evidencePath))}`,
        failure.value,
      );
    }
    throw cause;
  }
  ctx.task.meta.skillEval = {
    agent: result.execution.agent,
    evidencePath: result.evidencePath,
    requestedModel: result.execution.requestedModel,
    usageKnown: result.usage.known,
    costUsd: result.usage.costUsd,
    processStatus: "completed",
  };
  const page = await openHtml(ctx, join(result.project.path, options.output));
  let groups: Awaited<ReturnType<typeof checkHtml>>;
  try {
    groups = await checkHtml(page, options.expected);
  } catch (cause) {
    await annotateFailureScreenshot(ctx, page, result.evidencePath);
    await annotateSafely(ctx, "HTML assertion setup failed", {
      error: cause instanceof Error ? cause.message : String(cause),
      execution: result.execution,
      usage: result.usage,
      evidencePath: result.evidencePath,
    });
    throw cause;
  }
  if (groups.some((group) => !group.matches)) {
    await annotateFailureScreenshot(ctx, page, result.evidencePath);
    const assertionsPath = join(result.evidencePath, "assertions.json");
    await writeFile(
      assertionsPath,
      JSON.stringify(
        {
          assertions: groups,
          execution: result.execution,
          usage: result.usage,
          evidencePath: result.evidencePath,
        },
        null,
        2,
      ),
    );
    await annotateSafely(
      ctx,
      `Structured assertion results. Evidence: ${basename(result.evidencePath)}/assertions.json`,
      undefined,
      { path: assertionsPath, contentType: "application/json" },
    );
  }
  for (const group of groups) {
    expect.soft(group.actual, group.name).toEqual(group.expected);
  }
}

async function annotateFailureScreenshot(
  ctx: TestContext,
  page: Awaited<ReturnType<typeof openHtml>>,
  evidencePath: string,
): Promise<void> {
  try {
    const screenshotPath = join(evidencePath, "assertion-failure.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await annotateSafely(
      ctx,
      "Rendered output at assertion failure",
      undefined,
      { path: screenshotPath, contentType: "image/png" },
    );
  } catch {}
}

async function annotateSafely(
  ctx: TestContext,
  message: string,
  body?: unknown,
  attachment?: Readonly<{ path: string; contentType: string }>,
): Promise<void> {
  try {
    await ctx.annotate(
      message,
      "skill-eval",
      attachment ?? {
        body: JSON.stringify(body, null, 2),
        bodyEncoding: "utf-8",
        contentType: "application/json",
      },
    );
  } catch {}
}
