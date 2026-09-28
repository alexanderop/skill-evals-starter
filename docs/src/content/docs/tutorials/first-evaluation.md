---
title: Run your first evaluation
description: Run free checks, discover the examples, and optionally evaluate one real coding-agent output.
---

We will run the starter's free checks, then run one HTML evaluation with an authenticated agent. The live step can consume paid usage or subscription allowance.

![Six stages: skill, prompt, and fixtures; fresh Git workspace; coding agent; generated files; Vitest graders; result and evidence.](../../../assets/evaluation-flow.png)

_AI-generated overview of one evaluation. The steps below run this workflow._

## Get the starter

Use Node.js 22.12 or newer, pnpm 10.28.2, and Git. Create a repository with GitHub's **Use this template** button, or clone the starter:

```sh
git clone https://github.com/alexanderop/skill-evals-starter.git
cd skill-evals-starter
pnpm install --frozen-lockfile
pnpm browser:install
```

The last command installs Chromium for the HTML graders.

## Run the free checks

```sh
pnpm verify
```

The command checks formatting, lint, TypeScript, the free tests, and this documentation site. The runner tests use fake CLI processes. Browser calibration tests check known-good and deliberately broken HTML without calling a model.

## Discover the live tasks

```sh
pnpm test:evals:list
```

Expect four cases covering brand guidelines, Ocean Depths, and Sunset Boulevard. Discovery does not need an agent login or a model.

## Run one real task

Install and authenticate one of the [supported agent CLIs](../../reference/agents/). Choose a model identifier available to that account. For example, with an authenticated Codex CLI:

```sh
SKILL_EVAL_AGENT=codex SKILL_EVAL_MODEL=gpt-6-sol pnpm test:evals -t 'Ocean Depths'
```

The example model must be available to your account. Replace it if needed. The command enables live access, stages the selected skill and fixture in a temporary Git project, then starts the agent.

Expect Vitest to report one matching test. A pass means the generated page satisfied the HTML checks. Authentication errors, unsupported model identifiers, and assertion failures are separate outcomes to investigate.

## Inspect the result

Open `.vitest/results/live-evals.json`. The `skillEval` metadata points to the run's `.eval-artifacts/` directory.

Inspect `metadata.json`, `git-diff.patch`, and the saved `project/` output. A failed run may also include `failure.json`, `assertions.json`, or `retained-workspace.txt`. Follow the [failure guide](../../guides/debug-failures/) for those cases.

Successful tests remove the temporary project after assertions finish. Saved evidence stays in `.eval-artifacts/`.

Next, [write an evaluation for your own skill](../../guides/write-an-evaluation/).
