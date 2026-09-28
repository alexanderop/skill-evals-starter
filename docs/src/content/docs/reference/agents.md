---
title: Supported agents
description: Agent selection, CLI policies, budget limits, and recorded integration verification.
---

## Selection

`RunInput.agent` takes precedence over `SKILL_EVAL_AGENT`. The default is `claude`. `RunInput.model` takes precedence over `SKILL_EVAL_MODEL`. There is no default model.

Each selected CLI must be installed, on `PATH`, and authenticated. Model availability depends on the account and agent.

## Adapter policies

| Agent   | Skill directory  | Execution policy                                                                                                                                 | USD cap                                           |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Claude  | `.claude/skills` | Restricted file tools, user/project/local settings ignored, empty strict MCP configuration, no session persistence.                              | Defaults to USD 2 through the CLI.                |
| Codex   | `.agents/skills` | Workspace-write sandbox, noninteractive approvals, ephemeral session, user config and rules ignored. Shell commands are possible in the sandbox. | Unsupported. Explicit `maxBudgetUsd` is rejected. |
| Copilot | `.github/skills` | File-tool allowlist including `apply_patch`, write permission, built-in MCPs disabled, custom instructions disabled.                             | Unsupported. Explicit `maxBudgetUsd` is rejected. |

Timeouts limit elapsed time, not spend. Unknown cost remains `null`. Subscription or credit usage is not converted to a dollar cost.

Adapters explicitly point the prompt at the staged `SKILL.md`. A baseline omits that staged skill. These profiles do not guarantee equivalent isolation. See [Isolation and ACP](../../concepts/isolation-and-acp/).

## Live commands

These examples use model identifiers from the recorded checks. Availability can change.

```sh
SKILL_EVAL_AGENT=claude SKILL_EVAL_MODEL=claude-sonnet-5 pnpm test:evals
SKILL_EVAL_AGENT=codex SKILL_EVAL_MODEL=gpt-6-sol pnpm test:evals
SKILL_EVAL_AGENT=copilot SKILL_EVAL_MODEL=gpt-5.4 pnpm test:evals
```

`pnpm test:agents:smoke` uses the same agent and model environment variables. Both commands consume live agent usage.

## Recorded integration checks

The initial integration checks on September 28, 2026 are historical evidence, not a guarantee for other CLI versions, accounts, or models.

| CLI and model                          | Recorded result                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex CLI 0.158.0, `gpt-6-sol`         | Passed all four HTML cases and the selected-skill and baseline smoke.                                                                       |
| Copilot CLI 1.0.80, `gpt-5.4`          | Passed all four HTML cases and the selected-skill and baseline smoke.                                                                       |
| Claude Code 2.1.260, `claude-sonnet-5` | Live verification blocked by expired OAuth after changing skill invocation to an explicit file path. The file-edit path remains unverified. |

All adapters have free fake-process contract tests. Those tests establish runner behavior, not live model behavior. ACP is not an execution backend in this starter.
