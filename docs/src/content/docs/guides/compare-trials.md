---
title: Compare skills and repeated trials
description: Plan controlled comparisons without confusing a smoke test with evidence of skill effectiveness.
---

## Check selected-skill loading

Authenticate the agent, then run:

```sh
SKILL_EVAL_AGENT=codex SKILL_EVAL_MODEL=gpt-6-sol pnpm test:agents:smoke
```

The smoke creates a unique temporary skill containing a random sentinel instruction. It checks the output with the skill staged and runs the same prompt without that staged skill. The script removes the source skill afterward.

Read `.vitest/results/agent-smoke.json`. This result checks selected-skill behavior. It does not estimate whether a real skill improves task quality.

## Define the comparison before running it

Fix the task set, prompt, fixtures, skill revision, grader revision, agent version, model, and trial count. Decide which assertion groups define success. Record exclusions such as authentication or infrastructure failures separately.

Compare the same task with the skill staged and with `baseline: true` in `RunInput`. Keep other inputs unchanged. Use separate Vitest tests for each condition so each run has its own test result and cleanup lifecycle.

A baseline omits only the selected staged skill. Personal configuration and globally installed skills can still affect results. See [Isolation and ACP](../../concepts/isolation-and-acp/).

## Repeat and preserve each result

Run a fixed number of trials for each condition. Alternate or randomize condition order to reduce order effects. Preserve each `.vitest/results/live-evals.json` under a unique local name before another invocation overwrites it.

The per-run `.eval-artifacts/` directories are unique. Keep a local manifest connecting the task, condition, trial index, result file, and evidence directory. Do not commit raw transcripts or private task data.

The starter does not schedule repeated trials, pair results, or compute aggregate statistics. Vitest retries are not a substitute for a trial dataset because retry reporting can hide earlier failures.

## Report the result with its limits

Report successes and attempted trials per task and condition. Include process failures and exclusions instead of dropping them silently. Keep completed-process status separate from grader pass status.

State the CLI version, requested model, observed model when available, and source revisions. Report unknown usage or cost as unknown. Use the [reliability guide](../../concepts/reliability/) to choose metrics, and avoid broad conclusions from the four example cases.
