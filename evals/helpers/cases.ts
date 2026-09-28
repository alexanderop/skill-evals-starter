import type { HtmlExpectations } from "./html-assertions.js";

export const originalContent = {
  heading: "Northstar Analytics",
  bodyText: "Turn operational data into decisions your team can explain.",
  linkText: "Request a demo",
  href: "https://example.com/demo",
} as const;

export const brandExpected: HtmlExpectations = {
  ...originalContent,
  headingColor: "rgb(20, 20, 19)",
  bodyColor: "rgb(20, 20, 19)",
  backgroundColor: "rgb(250, 249, 245)",
  linkColor: "rgb(217, 119, 87)",
  headingFonts: ["Poppins", "Arial"],
  bodyFonts: ["Lora", "Georgia"],
  boldHeading: false,
};

export const oceanExpected: HtmlExpectations = {
  ...originalContent,
  headingColor: "rgb(241, 250, 238)",
  bodyColor: "rgb(241, 250, 238)",
  backgroundColor: "rgb(26, 35, 50)",
  linkColor: "rgb(45, 139, 139)",
  headingFonts: ["DejaVu Sans", "DejaVu Sans Bold"],
  bodyFonts: ["DejaVu Sans"],
  boldHeading: true,
};

export const sunsetExpected: HtmlExpectations = {
  ...originalContent,
  headingColor: "rgb(38, 70, 83)",
  bodyColor: "rgb(38, 70, 83)",
  backgroundColor: "rgb(233, 196, 106)",
  linkColor: "rgb(231, 111, 81)",
  headingFonts: ["DejaVu Serif", "DejaVu Serif Bold"],
  bodyFonts: ["DejaVu Sans"],
  boldHeading: true,
};
