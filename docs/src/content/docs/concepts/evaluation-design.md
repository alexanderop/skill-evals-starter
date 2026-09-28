---
title: Evaluation design
description: Connect tasks, trials, graders, and outcomes to the code in this starter.
---

A useful skill evaluation starts with a decision you need to make. Can a revised skill preserve existing content? Does a model upgrade still satisfy the same requirements? A passing example answers only the question encoded by its checks.

This guide applies ideas from Anthropic's [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), published January 9, 2026. The repository examples below show how those ideas translate into Vitest tests.

## Task, trial, and outcome

A task defines an input and its success criteria. In this starter, an `evals/*.eval.ts` test supplies the prompt, skill, and fixtures.

A trial is one attempt at that task. Each `runSkill` invocation starts a fresh agent process in a temporary Git project. Running the same task again creates another trial.

The outcome is the resulting project state. A generated HTML page is the outcome the example graders inspect. The agent's completion message is evidence about execution, not a replacement for inspecting that page.

A transcript records the CLI events emitted during the attempt. The evaluation runner preserves those events and extracts the fields it needs. Transcript completeness depends on the CLI.

## Two different systems under test

The evaluation harness is this starter's runner, fixtures, graders, and reporting. The agent harness is Claude Code, Codex, or Copilot, which operates a model and its tools.

Changing the CLI, model, skill, permission profile, or task can change the observed result. Record those choices before comparing runs. “The model improved” is too strong when several inputs changed at once.

## Graders and assertions

A grader evaluates a property of the outcome or transcript. The HTML grader has assertion groups for content and links, colors, heading typography, and body typography. Vitest soft assertions report multiple failures, but the example test passes only when all groups pass.

Code-based graders suit the explicit conditions in these examples. A subjective property, such as whether a design looks polished, needs a different rubric and calibration. Human review can expose blind spots that an automated grader misses.

The starter has no model-based grader, weighted score, or partial-credit aggregator. Individual assertion groups help explain failures without inventing an aggregate quality score.

## Capability and regression suites

A capability suite asks whether an agent can meet a harder target. A regression suite protects behavior that already works. A difficult task can become a regression case after the agent handles it reliably.

The four included HTML cases are examples for customization. They are too narrow to establish general coding ability. Keep adding cases from real failures, including inputs where the skill should preserve or decline to change content.

## Fairness begins with task design

Every checked requirement must be discoverable from the task. A grader that assumes an unstated filename measures a mismatch in expectations.

A reference output proves that the grader accepts at least one valid solution. Deliberate defects show whether the grader rejects the failures you care about. Both belong in free tests before live model runs.

Review transcripts and disputed grades regularly. When a suite saturates, keep it for regression protection and add harder tasks for capability measurement. Automated checks complement user feedback and human review. They do not make those sources unnecessary.
