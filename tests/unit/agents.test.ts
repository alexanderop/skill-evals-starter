import { access, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { agentAdapters } from "../../src/agents/registry.js";
import type { ProcessOutcome } from "../../src/agents/types.js";
import { __runSkillForTests } from "../../src/runner.js";
import {
  SkillRunError,
  type AgentId,
  type RunContext,
} from "../../src/types.js";

const fake = {
  executable: process.execPath,
  prefixArgs: [join(process.cwd(), "tests/fixtures/fake-cli.mjs")],
} as const;

function harness(): { ctx: RunContext; finish(): Promise<void> } {
  let cleanup: ((value: unknown) => unknown) | undefined;
  return {
    ctx: {
      signal: new AbortController().signal,
      onTestFinished(value) {
        cleanup = value as (value: unknown) => unknown;
      },
    },
    async finish() {
      await cleanup?.({ task: { result: { state: "pass" } } });
    },
  };
}

function environment(agent: AgentId, model: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    SKILL_EVAL: "1",
    SKILL_EVAL_AGENT: agent,
    SKILL_EVAL_MODEL: model,
    FAKE_AGENT: agent,
  };
}

const models = {
  claude: "claude-sonnet-5",
  codex: "gpt-6-sol",
  copilot: "gpt-5.4",
} as const;

const contracts = {
  claude: {
    skillPath: ".claude/skills/brand-guidelines/SKILL.md",
    flags: ["--restricted", "--max-budget-usd", "--strict-mcp-config"],
    tool: { kind: "tool-use", name: "Write", id: "tool-1" },
  },
  codex: {
    skillPath: ".agents/skills/brand-guidelines/SKILL.md",
    flags: [
      "exec",
      "--json",
      "workspace-write",
      "--ephemeral",
      "--ignore-rules",
    ],
    tool: { kind: "tool-use", name: "command_execution", id: "tool-1" },
  },
  copilot: {
    skillPath: ".github/skills/brand-guidelines/SKILL.md",
    flags: [
      "--output-format",
      "json",
      "apply_patch",
      "--allow-tool=write",
      "--disable-builtin-mcps",
      "--no-custom-instructions",
    ],
    tool: { kind: "tool-use", name: "apply_patch", id: "tool-1" },
  },
} as const;

test.each(Object.keys(models) as AgentId[])(
  "%s stages its skill and emits its native arguments",
  async (agent) => {
    const argsPath = join(
      process.cwd(),
      ".eval-artifacts",
      `args-${agent}-${Date.now()}.json`,
    );
    const lifecycle = harness();
    const result = await __runSkillForTests(
      lifecycle.ctx,
      { skill: "brand-guidelines", prompt: "write output" },
      {
        process: fake,
        environment: {
          ...environment(agent, models[agent]),
          FAKE_ARGS: argsPath,
        },
      },
    );
    try {
      expect(await result.project.exists(contracts[agent].skillPath)).toBe(
        true,
      );
      const args = JSON.parse(await readFile(argsPath, "utf8")) as string[];
      expect(args).toContain(models[agent]);
      for (const flag of contracts[agent].flags) expect(args).toContain(flag);
      if (agent === "claude") {
        expect(args.at(-1)).toBe(
          "Use the skill at .claude/skills/brand-guidelines/SKILL.md. write output",
        );
      }
      expect(result.execution).toMatchObject({
        agent,
        maxBudgetUsd: agent === "claude" ? 2 : null,
      });
      expect(result.toolEvents).toContainEqual(
        expect.objectContaining(contracts[agent].tool),
      );
      if (agent === "copilot")
        expect(result.usage).toEqual({
          known: false,
          inputTokens: null,
          outputTokens: null,
          costUsd: null,
        });
    } finally {
      await lifecycle.finish();
      await rm(result.evidencePath, { recursive: true, force: true });
      await rm(argsPath, { force: true });
    }
  },
);

test.each(Object.keys(models) as AgentId[])(
  "%s baseline omits every managed skill root",
  async (agent) => {
    const lifecycle = harness();
    const argsPath = join(
      process.cwd(),
      ".eval-artifacts",
      `baseline-args-${agent}-${Date.now()}.json`,
    );
    const result = await __runSkillForTests(
      lifecycle.ctx,
      { skill: "brand-guidelines", prompt: "plain prompt", baseline: true },
      {
        process: fake,
        environment: {
          ...environment(agent, models[agent]),
          FAKE_ARGS: argsPath,
        },
      },
    );
    try {
      for (const skillPath of Object.values(contracts).map(
        (contract) => contract.skillPath,
      )) {
        expect(await result.project.exists(skillPath)).toBe(false);
      }
      const args = JSON.parse(await readFile(argsPath, "utf8")) as string[];
      expect(args.at(-1)).toBe("plain prompt");
    } finally {
      await lifecycle.finish();
      await rm(result.evidencePath, { recursive: true, force: true });
      await rm(argsPath, { force: true });
    }
  },
);

test("rejects an unsupported budget and unknown agent before spawning", async () => {
  const marker = join(process.cwd(), ".eval-artifacts", `marker-${Date.now()}`);
  await expect(
    __runSkillForTests(
      harness().ctx,
      { skill: "brand-guidelines", prompt: "work", maxBudgetUsd: 1 },
      {
        process: fake,
        environment: {
          ...environment("codex", models.codex),
          FAKE_MARKER: marker,
        },
      },
    ),
  ).rejects.toMatchObject({ code: "invalid-input" });
  await expect(access(marker)).rejects.toThrow();
  await expect(
    __runSkillForTests(
      harness().ctx,
      { skill: "brand-guidelines", prompt: "work" },
      {
        process: fake,
        environment: {
          SKILL_EVAL: "1",
          SKILL_EVAL_AGENT: "future-agent",
          SKILL_EVAL_MODEL: "model",
          FAKE_MARKER: marker,
        },
      },
    ),
  ).rejects.toMatchObject({ code: "invalid-input" });
  await expect(access(marker)).rejects.toThrow();
});

test("adapter preparation failure settles the finished hook", async () => {
  const lifecycle = harness();
  const failure = await __runSkillForTests(
    lifecycle.ctx,
    { skill: "brand-guidelines", prompt: "work" },
    {
      agent: {
        ...agentAdapters.claude,
        buildInvocation() {
          throw new Error("synthetic preparation failure");
        },
      },
      process: fake,
      environment: environment("claude", models.claude),
    },
  ).catch((cause: unknown) => cause);
  expect(failure).toMatchObject({ code: "setup-failed" });
  await expect(
    Promise.race([
      lifecycle.finish().then(() => "settled"),
      new Promise<string>((resolvePromise) =>
        setTimeout(() => resolvePromise("timed-out"), 1_000),
      ),
    ]),
  ).resolves.toBe("settled");
  if (failure instanceof SkillRunError && failure.evidencePath) {
    const retained = await readFile(
      join(failure.evidencePath, "retained-workspace.txt"),
      "utf8",
    );
    await rm(retained.trim(), { recursive: true, force: true });
    await rm(failure.evidencePath, { recursive: true, force: true });
  }
});

test("rejects automatic and malformed models before spawning", async () => {
  for (const [agent, model] of [
    ["copilot", "auto"],
    ["codex", "with space"],
    ["claude", "sonnet"],
  ] as const) {
    await expect(
      __runSkillForTests(
        harness().ctx,
        { skill: "brand-guidelines", prompt: "work", agent, model },
        { process: fake, environment: { SKILL_EVAL: "1" } },
      ),
    ).rejects.toMatchObject({ code: "invalid-input" });
  }
});

function outcome(events: readonly Record<string, unknown>[]): ProcessOutcome {
  return {
    code: 0,
    signal: null,
    stdout: `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
    stderr: "",
  };
}

test("Codex rejects missing, failed, and malformed terminal events", () => {
  expect(() => agentAdapters.codex.decode(outcome([]))).toThrow();
  expect(() =>
    agentAdapters.codex.decode(
      outcome([{ type: "error" }, { type: "turn.completed", usage: {} }]),
    ),
  ).toThrow();
  expect(() =>
    agentAdapters.codex.decode(
      outcome([{ type: "turn.completed", usage: "bad" }]),
    ),
  ).toThrow();
});

test("Codex excludes messages from tool events and accepts unknown usage", () => {
  const decoded = agentAdapters.codex.decode(
    outcome([
      { type: "item.completed", item: { id: "m", type: "agent_message" } },
      { type: "turn.completed", usage: {} },
    ]),
  );
  expect(decoded.toolEvents).toEqual([]);
  expect(decoded.usage).toEqual({
    known: false,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
  });
});

test("Copilot rejects missing, failed, and malformed terminal events", () => {
  expect(() => agentAdapters.copilot.decode(outcome([]))).toThrow();
  expect(() =>
    agentAdapters.copilot.decode(outcome([{ type: "result", exitCode: 1 }])),
  ).toThrow();
  expect(() =>
    agentAdapters.copilot.decode(outcome([{ type: "result", exitCode: "0" }])),
  ).toThrow();
});

test("Claude rejects missing and error terminal events", () => {
  expect(() => agentAdapters.claude.decode(outcome([]))).toThrow();
  expect(() =>
    agentAdapters.claude.decode(
      outcome([{ type: "result", subtype: "error", is_error: true }]),
    ),
  ).toThrow();
});

test("fixture paths cannot overwrite any managed skill root", async () => {
  for (const path of [
    ".claude/skills",
    ".claude/skills/x/SKILL.md",
    ".agents/skills",
    ".agents/skills/x/SKILL.md",
    ".github/skills",
    ".github/skills/x/SKILL.md",
  ]) {
    await expect(
      __runSkillForTests(
        harness().ctx,
        { skill: "brand-guidelines", prompt: "work", files: { [path]: "x" } },
        { process: fake, environment: environment("claude", models.claude) },
      ),
    ).rejects.toBeInstanceOf(SkillRunError);
  }
});
