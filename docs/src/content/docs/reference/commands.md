---
title: Commands and configuration
description: Look up free checks, live commands, documentation commands, and environment variables.
---

## Free commands

| Command                          | Behavior                                                             |
| -------------------------------- | -------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Installs the locked dependencies.                                    |
| `pnpm browser:install`           | Installs Chromium for HTML checks.                                   |
| `pnpm test`                      | Runs unit and browser calibration tests with live access forced off. |
| `pnpm test:evals:list`           | Discovers live cases without model calls.                            |
| `pnpm test:evals:list --json`    | Prints discovery results as JSON.                                    |
| `pnpm check`                     | Checks the runner, tests, and eval TypeScript.                       |
| `pnpm lint`                      | Runs Oxlint.                                                         |
| `pnpm lint:fix`                  | Applies Oxlint fixes.                                                |
| `pnpm format`                    | Formats supported files with Oxfmt. Vendored skills are excluded.    |
| `pnpm format:check`              | Checks Oxfmt formatting.                                             |
| `pnpm verify`                    | Runs formatting, lint, types, free tests, and docs checks and build. |

## Live commands

| Command                  | Behavior                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `pnpm test:evals`        | Runs live cases with one worker. Supports Vitest filters such as `-t 'Ocean Depths'`. |
| `pnpm test:agents:smoke` | Runs a selected-skill and baseline smoke check.                                       |

Both launchers require an explicit `SKILL_EVAL_MODEL`. Live commands can consume paid usage or subscription allowance. Neither command runs in GitHub CI.

## Environment variables

| Variable           | Meaning                                                                      |
| ------------------ | ---------------------------------------------------------------------------- |
| `SKILL_EVAL_AGENT` | `claude`, `codex`, or `copilot`. Defaults to `claude`.                       |
| `SKILL_EVAL_MODEL` | Model identifier accepted by the selected agent. No default.                 |
| `SKILL_EVAL`       | Must equal `1` immediately before live execution. The live launchers set it. |
| `DOCS_SITE`        | Documentation origin. Defaults to `https://alexanderop.github.io`.           |
| `DOCS_BASE`        | Documentation base path. Defaults to `/skill-evals-starter/`.                |

Explicit `RunInput.agent` and `RunInput.model` override the corresponding environment variables. The bundled live launcher still requires the model environment variable before it starts Vitest.

## Documentation commands

| Command             | Behavior                                                  |
| ------------------- | --------------------------------------------------------- |
| `pnpm docs:dev`     | Starts the documentation development server.              |
| `pnpm docs:check`   | Checks Astro content configuration and types.             |
| `pnpm docs:build`   | Builds the static site and checks local links and assets. |
| `pnpm docs:preview` | Serves the production build locally.                      |

The production build includes Pagefind search. Use a production preview to verify search. GitHub Pages deployment uses the same build.
