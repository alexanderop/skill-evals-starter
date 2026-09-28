---
title: Write an evaluation
description: Add a skill, define a fair task, and assert its observable output.
---

## Define the outcome

Choose a task from a real manual check or failure. State the input path, output path, allowed changes, and required behavior. Include every condition that the grader will enforce.

For a theme task, specify which theme is selected and which colors belong to the background, text, and links. If content must remain visible and links must retain their destinations, include those requirements in the prompt.

## Add the complete skill

Copy the skill into `skills/<name>/`, including its `SKILL.md` and referenced resources. Use lowercase letters, digits, and hyphens in the directory name. Preserve third-party licenses and update `PROVENANCE.md` when you vendor external material.

## Add a live case

Create `evals/my-skill.eval.ts`. Replace `my-skill` with the directory you added:

```ts
import { expect, test } from "vitest";
import { runSkill } from "../src/index.js";

test("writes a summary without changing the source", async (ctx) => {
  const source = "The release adds CSV export. The release date is October 2.";
  const result = await runSkill(ctx, {
    skill: "my-skill",
    prompt:
      "Read input/release.txt. Write a summary to output/summary.txt that mentions CSV export and October 2. Leave input/release.txt unchanged.",
    files: { "input/release.txt": source },
  });

  expect(await result.project.readFile("input/release.txt")).toBe(source);
  const summary = await result.project.readFile("output/summary.txt");
  expect(summary).toContain("CSV export");
  expect(summary).toContain("October 2");
});
```

These string checks are a minimal example. They do not establish that the whole summary is correct or useful. Add checks that distinguish acceptable outputs from failures in your domain.

Pass the Vitest context to `runSkill` so cancellation and cleanup follow the test lifecycle. Read outputs before the test completes. See the [API reference](../../reference/api/) for limits and return values.

## Validate before calling a model

Create a known-good output and prove that the same grader accepts it. Introduce deliberate defects and prove that the grader rejects them. Follow [Calibrate graders](../calibrate-graders/).

Run discovery:

```sh
pnpm test:evals:list
```

Expect the new case in the list. Then run it with an authenticated agent and an explicit model:

```sh
SKILL_EVAL_AGENT=codex SKILL_EVAL_MODEL=gpt-6-sol pnpm test:evals -t 'writes a summary'
```

## Cover the opposite behavior

Add a case where the skill must preserve existing correct content. For a skill that should act only on certain inputs, include inputs where it should leave the result unchanged. Grade both intended changes and prohibited changes.

Keep regression cases when you fix a real failure. Record the task's intended role in its description so maintainers can distinguish regression protection from a harder capability target.
