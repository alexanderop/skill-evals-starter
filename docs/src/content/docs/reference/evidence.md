---
title: Evidence and cleanup
description: Where trial output is stored and how successful and failed workspaces are handled.
---

## Per-run evidence

Each run has a unique ignored `.eval-artifacts/<run>/` directory outside the temporary project. Available files depend on how far execution progressed.

| File or directory        | Contents                                                                    |
| ------------------------ | --------------------------------------------------------------------------- |
| `metadata.json`          | Input and execution metadata.                                               |
| `stdout.jsonl`           | Raw streaming CLI output. Partial output survives failures.                 |
| `stderr.txt`             | CLI diagnostics.                                                            |
| `git-status.txt`         | Workspace status captured as evidence.                                      |
| `git-diff.patch`         | Captured project diff.                                                      |
| `project/`               | Snapshot saved after a successful agent run, before test cleanup.           |
| `failure.json`           | Runner failure information when execution fails.                            |
| `retained-workspace.txt` | Location of a workspace retained after a failure.                           |
| `assertions.json`        | HTML assertion groups saved when checks mismatch.                           |
| `assertion-failure.png`  | HTML screenshot captured on a best-effort basis after an assertion failure. |

The runner can also write adapter configuration files and evidence diagnostics. It does not serialize environment variables or credentials. Raw CLI output can still contain sensitive task data.

## Latest reports

`.vitest/results/live-evals.json` contains the latest live Vitest run. It is overwritten by the next run. HTML cases attach `skillEval` metadata with the agent, evidence path, requested model, usage status, process status, and error code when available.

`.vitest/results/agent-smoke.json` contains the latest selected-skill smoke result.

Process completion and assertion success are different fields. A completed process can produce an output that fails every grader.

## Workspace lifecycle

A fresh temporary Git project starts each trial. The runner stages fixtures and the selected skill before executing the agent. A baseline omits the selected skill.

After the agent and assertions pass, the temporary project is removed. Setup, process, protocol, or assertion failures retain the workspace for inspection when a workspace exists. Evidence remains outside that workspace.

Process-group termination and escalation are implemented for macOS and Linux. Equivalent descendant-process cleanup is not proven on Windows.

## Publication boundary

`.eval-artifacts/` and `.vitest/` are ignored by Git. The docs build reads only documentation content and public site assets. GitHub Pages receives `docs/dist/`, not evaluation evidence.

Sanitized examples can be committed deliberately. Raw transcripts, account diagnostics, and private generated files are not documentation assets.
