---
title: Reliability across trials
description: Understand success rates, pass@k, pass^k, and the limits of small evaluation sets.
---

A single pass shows that one attempt satisfied the grader. It does not show how often the same agent will succeed again.

Anthropic's [agent evaluation article](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) distinguishes success within several attempts from success on every attempt. Choose the metric according to how the product uses those attempts.

![With independent trials and a 75 percent per-trial success probability, at least one success becomes more likely as attempts increase, while success on every attempt becomes less likely. At three attempts the probabilities are 98.44 percent and 42.19 percent.](../../../assets/trial-reliability.png)

_AI-generated schematic. The curves illustrate the trend; use the formulas and table below for exact values. These are not measured benchmark results._

## At least one success versus every success

For an illustrative task with independent attempts and a fixed per-trial success probability `p`:

- `pass@k = 1 - (1 - p)^k` is the probability of at least one success in `k` attempts.
- `pass^k = p^k` is the probability that all `k` attempts succeed.

For `p = 0.75`, the two requirements diverge:

| Attempts | At least one success | Every attempt succeeds |
| -------- | -------------------- | ---------------------- |
| 1        | 75%                  | 75%                    |
| 3        | 98.44%               | 42.19%                 |
| 10       | 99.9999%             | 5.63%                  |

These are illustrative probabilities under stated assumptions, not measurements from this repository. Shared failures, environment drift, or changing conditions violate the simple independence model.

## Estimates from recorded trials

Start by reporting the observed successes and number of attempts per task. Four successes out of four attempts are still a small sample.

For `n` sampled attempts with `c` successes, a common pass@k estimator is `1 - C(n - c, k) / C(n, k)`, for `n >= k`. Here, `C(a, b)` counts combinations and is zero when `a < b`. This estimator describes drawing a group of attempts from the sample. It is not the same as claiming a known underlying success probability.

Tasks differ in difficulty. Compute per-task results before summarizing a suite, and state the weighting. Do not substitute a suite-wide average into the probability formulas and treat the result as each task's reliability.

## Failure categories matter

A rejected login and an incorrect generated page require different fixes. Record both in the trial dataset, but distinguish infrastructure availability from task success. Report any exclusions and the denominator used for each metric.

The starter records process status and assertion results separately. It does not calculate confidence intervals, pass@k, or pass^k. [Compare skills and repeated trials](../../guides/compare-trials/) describes how to preserve the evidence for a later analysis.
