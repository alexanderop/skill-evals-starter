import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";
import { chromium, type Page } from "playwright";
import type { RunContext } from "../../src/index.js";

export type HtmlExpectations = Readonly<{
  heading: string;
  bodyText: string;
  linkText: string;
  href: string;
  headingColor: string;
  bodyColor: string;
  backgroundColor: string;
  linkColor: string;
  headingFonts: readonly string[];
  bodyFonts: readonly string[];
  boldHeading: boolean;
}>;

export async function openHtml(ctx: RunContext, path: string): Promise<Page> {
  const browser = await chromium.launch({ timeout: 15_000 });
  ctx.onTestFinished(async () => await browser.close());
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.route("**/*", async (route) => {
    if (new URL(route.request().url()).protocol === "file:")
      await route.continue();
    else await route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5_000);
  page.setDefaultNavigationTimeout(10_000);
  await page.goto(pathToFileURL(path).href, { waitUntil: "load" });
  return page;
}

export async function checkHtml(page: Page, expected: HtmlExpectations) {
  const actual = await page.evaluate(() => {
    const heading = document.querySelector("h1");
    const paragraph = document.querySelector("p");
    const link = document.querySelector("a");
    const visible = (element: Element | null) =>
      element instanceof HTMLElement &&
      element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    const text = (element: Element | null) =>
      element instanceof HTMLElement ? element.innerText.trim() : null;
    const style = (element: Element | null) =>
      element ? getComputedStyle(element) : null;
    return {
      content: {
        heading: text(heading),
        bodyText: text(paragraph),
        linkText: text(link),
        href: link instanceof HTMLAnchorElement ? link.href : null,
        visible: [visible(heading), visible(paragraph), visible(link)],
      },
      colors: {
        headingColor: style(heading)?.color,
        bodyColor: style(paragraph)?.color,
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        linkColor: style(link)?.color,
      },
      headingFont: style(heading)?.fontFamily ?? "",
      headingWeight: Number(style(heading)?.fontWeight),
      bodyFont: style(paragraph)?.fontFamily ?? "",
    };
  });
  const firstFont = (stack: string) =>
    stack.split(",")[0]?.trim().replaceAll(/["']/gu, "").toLowerCase();
  const acceptsFont = (stack: string, fonts: readonly string[]) =>
    fonts.some((font) => font.toLowerCase() === firstFont(stack));
  const groups = [
    {
      name: "visible content and link destination",
      actual: actual.content,
      expected: {
        heading: expected.heading,
        bodyText: expected.bodyText,
        linkText: expected.linkText,
        href: expected.href,
        visible: [true, true, true],
      },
    },
    {
      name: "computed color roles",
      actual: actual.colors,
      expected: {
        headingColor: expected.headingColor,
        bodyColor: expected.bodyColor,
        backgroundColor: expected.backgroundColor,
        linkColor: expected.linkColor,
      },
    },
    {
      name: "computed heading typography",
      actual: {
        acceptedFont: acceptsFont(actual.headingFont, expected.headingFonts),
        bold: !expected.boldHeading || actual.headingWeight >= 700,
      },
      expected: { acceptedFont: true, bold: true },
    },
    {
      name: "computed body typography",
      actual: {
        acceptedFont: acceptsFont(actual.bodyFont, expected.bodyFonts),
      },
      expected: { acceptedFont: true },
    },
  ];
  return groups.map((group) => ({
    ...group,
    matches: isDeepStrictEqual(group.actual, group.expected),
  }));
}
