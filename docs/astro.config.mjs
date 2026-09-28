import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: process.env.DOCS_SITE ?? "https://alexanderop.github.io",
  base: process.env.DOCS_BASE ?? "/skill-evals-starter/",
  trailingSlash: "always",
  integrations: [
    starlight({
      title: "Skill evals starter",
      description:
        "Write and calibrate evaluations for coding-agent skills with TypeScript and Vitest.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/alexanderop/skill-evals-starter",
        },
      ],
      editLink: {
        baseUrl:
          "https://github.com/alexanderop/skill-evals-starter/edit/main/docs/",
      },
      customCss: ["./src/styles/custom.css"],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Overview", slug: "" },
            { slug: "tutorials/first-evaluation" },
          ],
        },
        {
          label: "Guides",
          items: [
            { slug: "guides/write-an-evaluation" },
            { slug: "guides/calibrate-graders" },
            { slug: "guides/compare-trials" },
            { slug: "guides/debug-failures" },
            { slug: "guides/add-an-agent" },
            { slug: "guides/publish-docs" },
          ],
        },
        {
          label: "Concepts",
          items: [
            { slug: "concepts/evaluation-design" },
            { slug: "concepts/reliability" },
            { slug: "concepts/isolation-and-acp" },
          ],
        },
        {
          label: "Reference",
          items: [
            { slug: "reference/api" },
            { slug: "reference/agents" },
            { slug: "reference/commands" },
            { slug: "reference/evidence" },
          ],
        },
      ],
    }),
  ],
});
