# Skill evals starter

A small, strict TypeScript template for testing file-editing skills with Claude Code, OpenAI Codex, and GitHub Copilot CLI. Ordinary Vitest assertions judge observable output. Each live case uses a fresh agent process and a temporary Git project. The free test suite uses fake processes.

[Read the documentation](https://alexanderop.github.io/skill-evals-starter/) for the first-run tutorial, evaluation design, grader calibration, agent adapters, and API reference.

## Start your project

Use GitHub's **Use this template** button to create your own repository, or clone this project to try it locally.

```sh
git clone https://github.com/alexanderop/skill-evals-starter.git
cd skill-evals-starter
```

The source is a starter to customize. It is not published as an npm package.

## Requirements

- Node.js 22.12 or newer
- pnpm
- Chromium for the HTML assertions
- An authenticated coding agent for live tests. Claude Code needs `--restricted`. Codex needs `exec --json` and the configuration flags below. Copilot needs `--output-format json`.
- Local compatibility was checked with Codex CLI 0.158.0 and Copilot CLI 1.0.80. Older releases may lack required flags.

```sh
pnpm install
pnpm browser:install
pnpm verify
pnpm test:evals:list
```

`pnpm test` removes inherited `SKILL_EVAL` and model variables before starting Vitest. Bare Vitest uses only `tests/unit`. The separate eval configuration collects live files only when its launcher sets an explicit live or listing gate. Listing discovers the four tests without authentication, a model, or a model call. Use `pnpm test:evals:list --json` when another tool needs the discovered cases as JSON.

## Run live evaluations

Authenticate the CLI you want to test. Select the agent and an explicit model available to your account. Claude remains the default agent when `SKILL_EVAL_AGENT` is omitted.

```sh
SKILL_EVAL_AGENT=claude SKILL_EVAL_MODEL=claude-sonnet-5 pnpm test:evals
SKILL_EVAL_AGENT=codex SKILL_EVAL_MODEL=gpt-6-sol pnpm test:evals
SKILL_EVAL_AGENT=copilot SKILL_EVAL_MODEL=gpt-5.4 pnpm test:evals
```

Append `-t 'Ocean Depths'` to run one case. Models are agent-specific. An account can accept a model in Copilot and reject the same identifier in Codex.

The launcher supplies `SKILL_EVAL=1`. Each invocation also checks that gate immediately before starting the agent. There is no default model and no global paid test workflow.

| Agent   | Skill directory  | Execution policy                                                                                                    | USD budget                |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Claude  | `.claude/skills` | Restricted file tools, user/project/local settings ignored, empty strict MCP configuration, no session persistence  | Default USD 2 via the CLI |
| Codex   | `.agents/skills` | Workspace-write sandbox, noninteractive approvals, ephemeral session, user config and rules ignored                 | Unsupported               |
| Copilot | `.github/skills` | File-tool allowlist including `apply_patch`, write permission, built-in MCPs disabled, custom instructions disabled | Unsupported               |

An explicit `maxBudgetUsd` fails before execution on Codex or Copilot. Their timeout limits elapsed time, not spend. Unknown cost stays `null`; subscription requests are not converted into dollar amounts.

These policies differ. Codex can execute shell commands in its workspace sandbox. Claude and Copilot use file-tool profiles. Copilot still discovers personal skills and plugins despite `--no-custom-instructions`. Ignoring Codex user configuration does not establish that all personal context is disabled. Baselines omit the selected staged skill and its invocation, but do not prove an empty global context. Use a controlled account and configuration for benchmark comparisons.

Temporary projects are not an operating-system sandbox. Each CLI still uses its authentication and runtime configuration. See [agent adapters and ACP](docs/agents.md) for extension points and protocol tradeoffs.

## Verify an agent integration

Run the separate live smoke check after authenticating the selected CLI.

```sh
SKILL_EVAL_AGENT=codex SKILL_EVAL_MODEL=gpt-6-sol pnpm test:agents:smoke
SKILL_EVAL_AGENT=copilot SKILL_EVAL_MODEL=gpt-5.4 pnpm test:agents:smoke
```

The smoke creates a unique temporary skill, checks its exact sentinel output, and runs the same prompt without the staged skill. It removes the source skill afterward. Run evidence stays in `.eval-artifacts/`, and the latest smoke report is `.vitest/results/agent-smoke.json`. Claude uses the same command with its agent and model identifiers.

This check verifies selected-skill behavior. It does not prove the absence of personal context. The smoke is separate from free verification and the four HTML evaluation cases.

## Add a skill and case

Copy the complete skill directory to `skills/<name>/`. The runner accepts any lowercase, hyphenated directory name, so no union or registry needs an edit. Add an `evals/*.eval.ts` file that calls:

```ts
import { expect, test } from "vitest";
import { runSkill } from "../src/index.js";

test("the skill writes the requested page", async (ctx) => {
  const result = await runSkill(ctx, {
    skill: "my-skill",
    prompt: "Edit input/page.html and save output/page.html.",
    files: { "input/page.html": "<h1>Hello</h1>" },
    timeoutMs: 180_000,
  });

  expect(await result.project.readFile("output/page.html")).toContain(
    "<h1>Hello</h1>",
  );
});
```

`runSkill` also accepts `agent` and `model` overrides. They take precedence over the environment. The bundled launcher requires `SKILL_EVAL_MODEL` because the example cases use the environment. Pass `maxBudgetUsd` only for Claude.

`result.project` exposes `path`, `exists`, `readFile`, `readFileOrUndefined`, binary `read`, and checked `git` commands. The result also includes validated transcript objects, extracted tool events, CLI/model execution metadata, usage with an explicit `known` flag, and the evidence path. `SkillRunError.code` distinguishes disabled model access, invalid input, spawn/process/protocol failures, budget exhaustion, timeout, cancellation, setup, and cleanup failures. Assertion failures remain ordinary Vitest failures.

Fixture paths may not escape the project, write into `.git`, or overwrite the staged skill. Output reads reject symlinks. Git uses disabled hooks and signing plus isolated global/system configuration.

## Evidence and cleanup

Every run writes to a unique ignored `.eval-artifacts/<run>/` directory outside the temporary Git project. Streaming stdout and stderr, input metadata, CLI version, requested and observed model, Git status, and the diff remain there. Successful runs also save generated files under `project/` before cleanup. The runner does not serialize environment variables or credentials. Raw agent output may contain sensitive task data; keep the artifact directory private and out of Git.

The temporary project is deleted only after the live run and its Vitest assertions pass. Setup, process, protocol, and assertion failures retain it and write its location to the evidence directory. Browser cleanup is registered immediately after launch.

The live configuration keeps Vitest's default terminal reporter and writes the latest run to `.vitest/results/live-evals.json`. This ignored JSON file represents one run rather than a history. Assertion status records whether the observable checks passed. The `skillEval` metadata links completed model runs to their evidence directory, requested model, usage summary, and separate process status. Runner failures retain their `SkillRunError` code and evidence link. Failed HTML checks attach structured assertion results and a screenshot while the page is still open. Raw CLI stdout and stderr stay only in `.eval-artifacts/`.

Process-group termination and escalation are implemented for macOS and Linux. Windows can start the runner, but descendant-process termination has not been proven there and should not be treated as equivalent isolation.

## Commands

- `pnpm test` runs free unit and browser calibration tests with live access forced off.
- `pnpm test:evals:list` lists live cases without auth or model access.
- `pnpm test:evals:list --json` prints the same discovery result as JSON.
- `pnpm test:evals` runs live cases one worker at a time.
- `pnpm test:agents:smoke` runs a live skill and baseline check for the selected agent.
- `pnpm check`, `pnpm lint`, and `pnpm format:check` run individual checks.
- `pnpm lint:fix` applies Oxlint fixes; `pnpm format` formats with Oxfmt.
- `pnpm verify` runs every free check.
- `pnpm docs:dev` starts the Astro Starlight docs. `pnpm docs:build` builds the site and checks internal links. `pnpm docs:preview` serves the production build, including search.

The four included live tests are examples. Passing them proves those fixture checks for the recorded CLI and model. It does not measure general skill quality.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks, and adapter contributions. GitHub CI runs free tests and live-case discovery. It never authenticates a coding agent or starts a model evaluation.

The runner and original project code use the [MIT license](LICENSE). Vendored skills retain their own licenses. See [third-party notices](THIRD_PARTY_NOTICES.md) and [provenance](PROVENANCE.md).
