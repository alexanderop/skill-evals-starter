import { describe, it } from "vitest";
import { oceanExpected, sunsetExpected } from "./helpers/cases.js";
import { runLiveHtmlCase } from "./helpers/run-live-case.js";

describe("theme-factory", () => {
  describe("when Ocean Depths has already been selected", () => {
    it("should apply its color roles and typography while preserving the page", async (ctx) => {
      await runLiveHtmlCase(ctx, {
        skill: "theme-factory",
        fixture: "product.html",
        input: "input/product.html",
        output: "output/product.html",
        prompt:
          "I have reviewed the showcase and explicitly selected Ocean Depths. Apply this theme to input/product.html without asking for another selection. Use its primary background on the body, its text color for the heading and paragraph, and its main accent (not the secondary accent) for the link text. Apply the specified heading and body typography including heading weight. Preserve every word and link destination, keep the heading, paragraph, and link visible, and save standalone HTML to output/product.html.",
        expected: oceanExpected,
      });
    });
  });

  describe("when Sunset Boulevard has already been selected", () => {
    it("should apply its color roles and typography while preserving the page", async (ctx) => {
      await runLiveHtmlCase(ctx, {
        skill: "theme-factory",
        fixture: "product.html",
        input: "input/product.html",
        output: "output/product.html",
        prompt:
          "I have reviewed the showcase and explicitly selected Sunset Boulevard. Apply this theme to input/product.html without asking for another selection. Use its background/highlighting color on the body, its dark contrast and text color for the heading and paragraph, and its primary accent for the link text. Apply the specified heading and body typography including heading weight. Preserve every word and link destination, keep the heading, paragraph, and link visible, and save standalone HTML to output/product.html.",
        expected: sunsetExpected,
      });
    });
  });
});
