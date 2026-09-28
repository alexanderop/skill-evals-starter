import { spawnSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";

test("actual Vitest timeout retains finalized evidence and JSON metadata", async () => {
  const ownedEvidence = new Set<string>();
  const nonce = `${process.pid}-${Date.now()}`;
  const reportPath = join(process.cwd(), ".vitest", `nested-${nonce}.json`);
  const observationPath = join(
    process.cwd(),
    ".eval-artifacts",
    `observation-${nonce}.json`,
  );
  const childPidPath = join(
    process.cwd(),
    ".eval-artifacts",
    `child-${nonce}.pid`,
  );
  const annotationPath = join(
    process.cwd(),
    ".eval-artifacts",
    `annotation-${nonce}.json`,
  );
  const runnerFailurePath = join(
    process.cwd(),
    ".eval-artifacts",
    `runner-failure-${nonce}.json`,
  );
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "--config",
      "tests/fixtures/vitest-live/vitest.config.ts",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 15_000,
      env: {
        ...process.env,
        NESTED_JSON_REPORT: reportPath,
        NESTED_OBSERVATION: observationPath,
        NESTED_CHILD_PID: childPidPath,
        NESTED_ANNOTATION: annotationPath,
        NESTED_RUNNER_FAILURE: runnerFailurePath,
        SKILL_EVAL_MODEL: "claude-sonnet-5",
      },
    },
  );
  try {
    expect(result.status).toBe(1);
    const annotationRecord = JSON.parse(
      await readFile(annotationPath, "utf8"),
    ) as {
      annotations: Array<{
        message: string;
        attachment?: { contentType?: string; path?: string };
      }>;
      meta: { skillEval: { evidencePath: string } };
    };
    ownedEvidence.add(annotationRecord.meta.skillEval.evidencePath);
    const structured = annotationRecord.annotations.find((annotation) =>
      annotation.message.startsWith("Structured assertion results."),
    );
    expect(structured?.attachment?.contentType).toBe("application/json");
    const structuredEvidence = JSON.parse(
      await readFile(
        structured?.attachment?.path ?? "missing-assertions",
        "utf8",
      ),
    ) as { assertions: Array<{ matches: boolean }> };
    expect(structuredEvidence.assertions).toHaveLength(4);
    expect(structuredEvidence.assertions.some(({ matches }) => !matches)).toBe(
      true,
    );
    const screenshot = annotationRecord.annotations.find(
      (annotation) =>
        annotation.message === "Rendered output at assertion failure",
    );
    expect(screenshot?.attachment?.contentType).toBe("image/png");
    await expect(
      readFile(screenshot?.attachment?.path ?? "missing-screenshot"),
    ).resolves.not.toHaveLength(0);
    const observation = JSON.parse(await readFile(observationPath, "utf8")) as {
      childAlive: boolean;
      evidencePath: string;
      finalized: boolean;
      annotations: Array<{ message: string }>;
      meta: { skillEval: { errorCode: string; processStatus: string } };
    };
    ownedEvidence.add(observation.evidencePath);
    expect(observation).toMatchObject({ childAlive: false, finalized: true });
    expect(observation.meta.skillEval).toMatchObject({
      errorCode: "cancelled",
      processStatus: "failed",
    });
    const retainedWorkspace = (
      await readFile(
        join(observation.evidencePath, "retained-workspace.txt"),
        "utf8",
      )
    ).trim();
    const report = JSON.parse(await readFile(reportPath, "utf8")) as {
      numFailedTests: number;
      testResults: Array<{
        assertionResults: Array<{ meta: Record<string, unknown> }>;
      }>;
    };
    const runnerFailure = JSON.parse(
      await readFile(runnerFailurePath, "utf8"),
    ) as {
      annotations: Array<{ message: string }>;
      meta: { skillEval: { evidencePath: string; errorCode: string } };
    };
    ownedEvidence.add(runnerFailure.meta.skillEval.evidencePath);
    expect(runnerFailure.annotations).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("Skill runner failed. Evidence:"),
      }),
    ]);
    expect(runnerFailure.meta.skillEval.errorCode).toBe("timeout");
    expect(report.numFailedTests).toBe(3);
    const completedMeta = report.testResults
      .flatMap((testResult) => testResult.assertionResults)
      .map((assertion) => assertion.meta)
      .find(
        (meta) =>
          (meta.skillEval as { processStatus?: string } | undefined)
            ?.processStatus === "completed",
      );
    expect(completedMeta).toEqual({
      skillEval: expect.objectContaining({
        evidencePath: annotationRecord.meta.skillEval.evidencePath,
        requestedModel: "claude-sonnet-5",
        usageKnown: true,
        costUsd: 0.01,
        processStatus: "completed",
      }),
    });
    expect(retainedWorkspace).not.toBe("");
  } finally {
    const childPid = Number(
      await readFile(childPidPath, "utf8").catch(() => "NaN"),
    );
    if (Number.isInteger(childPid)) {
      try {
        process.kill(childPid, "SIGKILL");
      } catch {}
    }
    for (const evidencePath of ownedEvidence) {
      const retainedWorkspace = (
        await readFile(
          join(evidencePath, "retained-workspace.txt"),
          "utf8",
        ).catch(() => "")
      ).trim();
      if (retainedWorkspace)
        await rm(retainedWorkspace, { recursive: true, force: true });
      await rm(evidencePath, { recursive: true, force: true });
    }
    await Promise.all([
      rm(reportPath, { force: true }),
      rm(observationPath, { force: true }),
      rm(childPidPath, { force: true }),
      rm(annotationPath, { force: true }),
      rm(runnerFailurePath, { force: true }),
    ]);
  }
});
