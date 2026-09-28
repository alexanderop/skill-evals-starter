import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { runSkill } from "../../src/index.js";

test(
  "a staged skill changes observable output while its baseline cannot see the sentinel",
  { timeout: 360_000 },
  async (ctx) => {
    const suffix = randomUUID();
    const skill = `sentinel-${suffix}`;
    const sentinel = `skill-loaded-${suffix}`;
    const skillPath = join(process.cwd(), "skills", skill);
    await mkdir(skillPath);
    try {
      await writeFile(
        join(skillPath, "SKILL.md"),
        [
          "---",
          `name: ${skill}`,
          "description: Writes the exact evaluation sentinel when explicitly requested.",
          "---",
          "",
          `Create output/sentinel.txt as one line containing ${sentinel}, followed by one newline.`,
          "",
        ].join("\n"),
      );
      const prompt =
        "Use the available evaluation skill and complete its task.";
      const skilled = await runSkill(ctx, { skill, prompt });
      expect(await skilled.project.readFile("output/sentinel.txt")).toBe(
        `${sentinel}\n`,
      );
      expect(
        skilled.toolEvents.some((event) => event.kind === "tool-use"),
      ).toBe(true);
      await ctx.annotate("Agent smoke skill run", "skill-eval", {
        body: JSON.stringify({
          agent: skilled.execution.agent,
          model: skilled.execution.requestedModel,
          evidencePath: skilled.evidencePath,
        }),
        bodyEncoding: "utf-8",
        contentType: "application/json",
      });

      const baseline = await runSkill(ctx, { skill, prompt, baseline: true });
      expect(
        await baseline.project.readFileOrUndefined("output/sentinel.txt"),
      ).not.toBe(`${sentinel}\n`);
      await ctx.annotate("Agent smoke baseline run", "skill-eval", {
        body: JSON.stringify({
          agent: baseline.execution.agent,
          model: baseline.execution.requestedModel,
          evidencePath: baseline.evidencePath,
        }),
        bodyEncoding: "utf-8",
        contentType: "application/json",
      });
    } finally {
      await rm(skillPath, { recursive: true, force: true });
    }
  },
);
