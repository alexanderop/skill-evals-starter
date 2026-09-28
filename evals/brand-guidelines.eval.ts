import { describe, it } from "vitest";
import { brandExpected } from "./helpers/cases.js";
import { runLiveHtmlCase } from "./helpers/run-live-case.js";

describe("brand-guidelines", () => {
  describe("when given a plain HTML page", () => {
    it("should create a branded page while preserving content and links", async (ctx) => {
      await runLiveHtmlCase(ctx, {
        skill: "brand-guidelines",
        fixture: "product.html",
        input: "input/product.html",
        output: "output/product.html",
        prompt:
          "Style input/product.html using the Anthropic brand guidelines. Use the main light color on the body background, the main dark color for the heading and paragraph, and the primary accent for the link text. Apply heading and body typography with the documented fallbacks; make the heading at least 24pt. Preserve every word and link destination, keep the heading, paragraph, and link visible, and save standalone HTML to output/product.html.",
        expected: brandExpected,
      });
    });
  });

  describe("when updating an existing styled HTML page in place", () => {
    it("should replace the old brand without changing content or links", async (ctx) => {
      await runLiveHtmlCase(ctx, {
        skill: "brand-guidelines",
        fixture: "styled-product.html",
        input: "product.html",
        output: "product.html",
        prompt:
          "Rebrand the existing product.html in place using the Anthropic brand guidelines. Replace its old colors and typography. Use the main light color on the body background, the main dark color for the heading and paragraph, and the primary accent for the link text. Apply heading and body typography with the documented fallbacks; make the heading at least 24pt. Preserve every word and link destination, keep the heading, paragraph, and link visible, and save the standalone HTML back to product.html.",
        expected: brandExpected,
      });
    });
  });
});
