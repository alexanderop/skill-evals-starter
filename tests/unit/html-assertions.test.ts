import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RunContext } from "../../src/index.js";
import {
  brandExpected,
  oceanExpected,
  sunsetExpected,
} from "../../evals/helpers/cases.js";
import { checkHtml, openHtml } from "../../evals/helpers/html-assertions.js";

const content =
  '<h1>Northstar Analytics</h1><p>Turn operational data into decisions your team can explain.</p><a href="https://example.com/demo">Request a demo</a>';
const brandCss =
  "body{background:#faf9f5;color:#141413;font-family:Lora,Georgia,serif}h1{font-family:Poppins,Arial,sans-serif}a{color:#d97757}";
const oceanCss =
  'body{background:#1a2332;color:#f1faee;font-family:"DejaVu Sans",sans-serif}h1{font-family:"DejaVu Sans",sans-serif;font-weight:700}a{color:#2d8b8b}';
const sunsetCss =
  'body{background:#e9c46a;color:#264653;font-family:"DejaVu Sans",sans-serif}h1{font-family:"DejaVu Serif",serif;font-weight:700}a{color:#e76f51}';

async function render(ctx: RunContext, css: string, body = content) {
  const directory = await mkdtemp(join(tmpdir(), "skill-evals-calibration-"));
  ctx.onTestFinished(
    async () => await rm(directory, { recursive: true, force: true }),
  );
  const path = join(directory, "product.html");
  await writeFile(
    path,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Calibration</title><style>${css}</style></head><body>${body}</body></html>`,
  );
  return await openHtml(ctx, path);
}

describe("HTML contract calibration", () => {
  it.for([
    { name: "Anthropic brand", css: brandCss, expected: brandExpected },
    { name: "Ocean Depths", css: oceanCss, expected: oceanExpected },
    { name: "Sunset Boulevard", css: sunsetCss, expected: sunsetExpected },
  ])(
    "should accept independently authored $name output",
    async ({ css, expected }, ctx) => {
      const groups = await checkHtml(await render(ctx, css), expected);
      expect(groups.map(({ name, matches }) => ({ name, matches }))).toEqual([
        { name: "visible content and link destination", matches: true },
        { name: "computed color roles", matches: true },
        { name: "computed heading typography", matches: true },
        { name: "computed body typography", matches: true },
      ]);
    },
  );

  it.for([
    {
      name: "wrong color",
      css: `${brandCss}a{color:blue}`,
      body: content,
      failures: ["computed color roles"],
    },
    {
      name: "unused correct CSS",
      css: ".unused{background:#faf9f5;color:#141413;font-family:Lora}.unused h1{font-family:Poppins}.unused a{color:#d97757}",
      body: content,
      failures: [
        "computed color roles",
        "computed heading typography",
        "computed body typography",
      ],
    },
    {
      name: "deleted paragraph",
      css: brandCss,
      body: content.replace(/<p>.*?<\/p>/u, ""),
      failures: [
        "visible content and link destination",
        "computed color roles",
        "computed body typography",
      ],
    },
    {
      name: "hidden paragraph",
      css: `${brandCss}p{display:none}`,
      body: content,
      failures: ["visible content and link destination"],
    },
    {
      name: "changed link destination",
      css: brandCss,
      body: content.replace(
        "https://example.com/demo",
        "https://example.com/other",
      ),
      failures: ["visible content and link destination"],
    },
    {
      name: "wrong fonts before correct fallback names",
      css: `${brandCss}h1{font-family:monospace,Poppins}p{font-family:monospace,Lora}`,
      body: content,
      failures: ["computed heading typography", "computed body typography"],
    },
  ])(
    "should reject $name through the same live contract",
    async ({ css, body, failures }, ctx) => {
      const groups = await checkHtml(
        await render(ctx, css, body),
        brandExpected,
      );
      expect(
        groups.filter((group) => !group.matches).map((group) => group.name),
      ).toEqual(failures);
    },
  );

  it("should reject a theme heading without its required bold weight", async (ctx) => {
    const groups = await checkHtml(
      await render(ctx, `${oceanCss}h1{font-weight:400}`),
      oceanExpected,
    );
    expect(
      groups.filter((group) => !group.matches).map((group) => group.name),
    ).toEqual(["computed heading typography"]);
  });

  it("should accept the documented brand font fallbacks", async (ctx) => {
    const groups = await checkHtml(
      await render(
        ctx,
        `${brandCss}h1{font-family:Arial,sans-serif}p{font-family:Georgia,serif}`,
      ),
      brandExpected,
    );
    expect(groups.map((group) => group.matches)).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });
});
