import type { ToolEvent } from "../types.js";
import {
  isRecord,
  parseJsonLines,
  protocolError,
  type AgentAdapter,
} from "./types.js";

const MODEL_PATTERN = /^claude-(?:opus|sonnet|haiku)-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const claudeAgent: AgentAdapter = {
  id: "claude",
  executable: "claude",
  skillRoot: ".claude/skills",
  defaultMaxBudgetUsd: 2,
  executionPolicy:
    "restricted file tools; user/project/local settings ignored; strict empty MCP",
  validateModel(model) {
    if (!MODEL_PATTERN.test(model)) {
      throw new Error(
        "Claude model must be a full identifier such as claude-sonnet-5",
      );
    }
  },
  buildInvocation(input) {
    const prompt = input.baseline
      ? input.prompt
      : `Use the skill at .claude/skills/${input.skill}/SKILL.md. ${input.prompt}`;
    return {
      evidenceFiles: { "empty-mcp.json": '{"mcpServers":{}}\n' },
      args: [
        "--restricted",
        "--permission-mode",
        "acceptEdits",
        "--tools",
        "Read,Write,Edit,Glob,Grep,Skill",
        "--strict-mcp-config",
        "--mcp-config",
        `${input.evidencePath}/empty-mcp.json`,
        "--setting-sources",
        "project",
        "--no-session-persistence",
        ...(input.baseline ? ["--disable-slash-commands"] : []),
        "--output-format",
        "stream-json",
        "--verbose",
        "--model",
        input.model,
        "--max-budget-usd",
        String(input.maxBudgetUsd ?? 2),
        "--print",
        prompt,
      ],
    };
  },
  decode(outcome) {
    const transcript = parseJsonLines("Claude", outcome.stdout);
    const terminal = transcript.findLast((event) => event.type === "result");
    if (
      !terminal ||
      terminal.subtype !== "success" ||
      terminal.is_error !== false
    ) {
      throw protocolError("Claude did not emit a successful terminal result");
    }
    const toolEvents: ToolEvent[] = [];
    for (const event of transcript) {
      const message = isRecord(event.message) ? event.message : undefined;
      const content =
        message && Array.isArray(message.content) ? message.content : [event];
      for (const item of content) {
        if (!isRecord(item)) continue;
        if (item.type === "tool_use") {
          toolEvents.push({
            kind: "tool-use",
            ...(typeof item.name === "string" ? { name: item.name } : {}),
            ...(typeof item.id === "string" ? { id: item.id } : {}),
            raw: item,
          });
        } else if (item.type === "tool_result") {
          toolEvents.push({
            kind: "tool-result",
            ...(typeof item.name === "string" ? { name: item.name } : {}),
            ...(typeof item.tool_use_id === "string"
              ? { id: item.tool_use_id }
              : {}),
            raw: item,
          });
        }
      }
    }
    const rawUsage = isRecord(terminal.usage) ? terminal.usage : undefined;
    const inputTokens =
      rawUsage && typeof rawUsage.input_tokens === "number"
        ? rawUsage.input_tokens
        : null;
    const outputTokens =
      rawUsage && typeof rawUsage.output_tokens === "number"
        ? rawUsage.output_tokens
        : null;
    const costUsd =
      typeof terminal.total_cost_usd === "number"
        ? terminal.total_cost_usd
        : null;
    const observedModel =
      transcript
        .map((event) => {
          if (typeof event.model === "string") return event.model;
          return isRecord(event.message) &&
            typeof event.message.model === "string"
            ? event.message.model
            : undefined;
        })
        .find((value) => value !== undefined) ?? null;
    return {
      transcript,
      toolEvents,
      observedModel,
      usage: {
        known:
          inputTokens !== null || outputTokens !== null || costUsd !== null,
        inputTokens,
        outputTokens,
        costUsd,
      },
    };
  },
  isBudgetFailure(outcome) {
    return /budget|max[_ -]?budget/iu.test(
      `${outcome.stdout}\n${outcome.stderr}`,
    );
  },
};
