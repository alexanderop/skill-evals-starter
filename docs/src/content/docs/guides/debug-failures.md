---
title: Debug a failed evaluation
description: Separate agent mistakes from process, environment, task, and grading failures.
---

## Locate the evidence

Read the Vitest failure and `.vitest/results/live-evals.json`. Follow `skillEval.evidencePath` to the run directory. A direct caller can inspect `SkillRunError.code` and `SkillRunError.evidencePath`.

If execution failed before the evidence directory was created, use the error code and message. Invalid input and disabled live access can fail before an agent starts.

## Check execution first

Inspect `failure.json`, `metadata.json`, and `stderr.txt` when present. Resolve missing CLIs, expired login sessions, invalid models, and unsupported options before interpreting skill behavior.

For timeouts, inspect partial `stdout.jsonl`. Determine whether the process was still making progress or waiting on an unavailable operation. Increase a deadline only when the task requires it.

A zero exit code is insufficient. Each adapter requires a successful terminal event, and a successful terminal event still does not prove that the output satisfies the task.

## Inspect the actual output

For an assertion failure, read `git-diff.patch` and the retained workspace path in `retained-workspace.txt`. For HTML failures, inspect `assertions.json` and `assertion-failure.png` when available.

Compare the failed check with the prompt. If the prompt never stated the requirement, fix the task. If the output is a valid alternative, fix the grader. If the output violates a clear requirement, record an agent failure.

Read the CLI transcript to understand the attempt. The transcript contains only what the CLI emitted, not necessarily every internal step or private reasoning.

## Keep a regression case

Reduce the issue to a sanitized fixture and assertion. For grader defects, add both the rejected valid output and a nearby invalid output to the free calibration suite.

Keep raw evidence local. The [evidence reference](../../reference/evidence/) describes which files the runner retains and when cleanup happens.
