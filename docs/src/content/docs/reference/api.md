---
title: Runner API
description: The public runSkill inputs, result, project readers, and error codes.
---

The public entry point is `src/index.ts`. Types are defined in `src/types.ts`.

```ts
import { runSkill, SkillRunError } from "../src/index.js";
import type { RunInput, RunResult } from "../src/index.js";
```

## runSkill

`runSkill(ctx, input)` returns `Promise<RunResult>`. The context contains Vitest's `onTestFinished` and `signal`. Cleanup occurs after assertions complete.

| Input          | Type                                        | Default or constraint                                                                       |
| -------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `skill`        | `string`                                    | Required directory under `skills/`. Lowercase letters, digits, and hyphens.                 |
| `prompt`       | `string`                                    | Required, nonempty after trimming.                                                          |
| `files`        | Readonly record of `string` or `Uint8Array` | Initial project files. Defaults to none.                                                    |
| `agent`        | `"claude" \| "codex" \| "copilot"`          | Environment, then `claude`.                                                                 |
| `model`        | `string`                                    | Environment. No default.                                                                    |
| `baseline`     | `boolean`                                   | Defaults to `false`. Omits the selected staged skill when true.                             |
| `timeoutMs`    | `number`                                    | Defaults to `180000`. Positive and finite.                                                  |
| `maxBudgetUsd` | `number`                                    | Positive and finite. Claude defaults to USD 2. Explicit budgets fail for Codex and Copilot. |

Fixture paths are normalized relative paths. Traversal, absolute paths, backslashes, `.git`, and managed skill directories are rejected. Output readers reject symlinks.

## RunResult

| Field          | Contents                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| `project`      | A `ProjectView` of the temporary project.                                                             |
| `transcript`   | Validated original CLI event objects.                                                                 |
| `toolEvents`   | Extracted tool-use or tool-result events with raw event data. Coverage depends on the adapter.        |
| `execution`    | Agent, CLI version, model fields, start time, duration, exit code, signal, baseline flag, and budget. |
| `usage`        | Input tokens, output tokens, cost in USD, and a `known` flag. Unavailable values are `null`.          |
| `evidencePath` | Absolute local path to retained evidence.                                                             |

`execution.requestedModel` records the requested identifier. `execution.observedModel` is `null` when the CLI does not report a model. `execution.model` contains the requested identifier as well.

## ProjectView

| Member                              | Result                                             |
| ----------------------------------- | -------------------------------------------------- |
| `path`                              | Temporary project directory.                       |
| `exists(relativePath)`              | Whether the checked path exists.                   |
| `readFile(relativePath)`            | UTF-8 file contents.                               |
| `readFileOrUndefined(relativePath)` | UTF-8 contents, or `undefined` for a missing file. |
| `read(relativePath)`                | Binary bytes as `Uint8Array`.                      |
| `git(args)`                         | Output of checked Git commands in the project.     |

## SkillRunError

The error has a `code`, message, optional cause, and optional `evidencePath`. Ordinary assertion failures remain Vitest failures.

| Code              | Meaning                                                     |
| ----------------- | ----------------------------------------------------------- |
| `model-disabled`  | Live access is not enabled.                                 |
| `invalid-input`   | Invalid task input, agent, model, or unsupported option.    |
| `spawn-failed`    | A required process could not start.                         |
| `process-failed`  | The agent process failed.                                   |
| `protocol-failed` | CLI output is invalid or lacks a successful terminal event. |
| `budget-exceeded` | The agent reported budget exhaustion.                       |
| `timeout`         | The process exceeded its deadline.                          |
| `cancelled`       | The run received cancellation.                              |
| `setup-failed`    | Project or skill setup failed.                              |
| `cleanup-failed`  | Post-test evidence or cleanup failed.                       |
