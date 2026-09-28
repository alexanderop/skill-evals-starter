# Contributing

## Set up the project

Use Node.js 22.12 or newer and the pnpm version declared in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm browser:install
pnpm verify
pnpm test:evals:list
```

The free checks require no coding-agent account. They use fake CLI processes and Chromium to check runner behavior and calibrate the HTML assertions. Keep model calls out of `pnpm verify` and GitHub CI.

Use `pnpm lint:fix` to apply Oxlint fixes and `pnpm format` to format with Oxfmt. CI checks both tools through `pnpm verify`. Formatting excludes vendored files in `skills/`.

## Change the runner or add an agent

Keep workspace creation, process cancellation, output evidence, and cleanup in the shared runner. Put CLI-specific behavior in an adapter. Follow [the adapter guide](docs/agents.md) when adding another coding agent.

Test observable behavior, including failure paths. Preserve unknown usage as `null`. Reject limits that an agent cannot enforce. Do not weaken assertions to accept an agent's incorrect output.

For a live integration change, authenticate locally and run both `pnpm test:agents:smoke` and the HTML cases with explicit `SKILL_EVAL_AGENT` and `SKILL_EVAL_MODEL` values. See [the README](README.md) for commands. Live evaluations can incur charges or consume subscription allowance.

Record which CLI version and model you tested. Distinguish passing free tests from live integration results. If authentication prevents a live check, state that limitation in the pull request.

## Add a skill evaluation

Place a complete skill directory in `skills/` and an evaluation in `evals/`. Add fixtures in `fixtures/` when needed. Assert the resulting file contents or rendered behavior. Baseline runs omit the selected staged skill, but personal CLI configuration may still affect the result.

Preserve third-party licenses and provenance. Keep vendored skill files unchanged unless your change explicitly updates the vendored source and its checksums.

## Submit a change

Run `pnpm verify` and `pnpm test:evals:list` before opening a pull request. Describe the behavior change and the checks you ran.

Do not commit `.env` files, credentials, transcripts, screenshots from private tasks, or `.eval-artifacts/`. Share a sanitized reproduction instead of a raw live-run log. Generated evidence remains local by default.
