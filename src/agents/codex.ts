import type { ToolEvent } from "../types.js";
import {
  isRecord,
  parseJsonLines,
  protocolError,
  type AgentAdapter,
} from "./types.js";

const MODEL_PATTERN = /^[a-z0-9][a-z0-9._-]*$/u;

export const codexAgent: AgentAdapter = {
  id: "codex",
  executable: "codex",
  skillRoot: ".agents/skills",
  defaultMaxBudgetUsd: null,
  executionPolicy:
    "workspace-write sandbox; approvals disabled; ephemeral session",
  validateModel(model) {
    if (!MODEL_PATTERN.test(model))
      throw new Error("Codex model must be a nonempty model identifier");
  },
  buildInvocation(input) {
    const prompt = input.baseline
      ? input.prompt
      : `Use the skill at .agents/skills/${input.skill}/SKILL.md. ${input.prompt}`;
    return {
      args: [
        "exec",
        "--json",
        "--sandbox",
        "workspace-write",
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "-c",
        'approval_policy="never"',
        "--model",
        input.model,
        prompt,
      ],
    };
  },
  decode(outcome) {
    const transcript = parseJsonLines("Codex", outcome.stdout);
    const terminal = transcript.findLast(
      (event) => event.type === "turn.completed",
    );
    if (!terminal) throw protocolError("Codex did not emit a completed turn");
    const failed = transcript.findLast(
      (event) => event.type === "turn.failed" || event.type === "error",
    );
    if (failed) throw protocolError("Codex emitted a failed turn");
    if (terminal.usage !== undefined && !isRecord(terminal.usage))
      throw protocolError("Codex completed turn has malformed usage");
    const toolEvents: ToolEvent[] = [];
    for (const event of transcript) {
      const item = isRecord(event.item) ? event.item : undefined;
      if (
        !item ||
        typeof item.id !== "string" ||
        ![
          "command_execution",
          "file_change",
          "mcp_tool_call",
          "web_search",
        ].includes(String(item.type))
      )
        continue;
      if (event.type === "item.started") {
        toolEvents.push({
          kind: "tool-use",
          ...(typeof item.type === "string" ? { name: item.type } : {}),
          id: item.id,
          raw: event,
        });
      } else if (event.type === "item.completed") {
        toolEvents.push({
          kind: "tool-result",
          ...(typeof item.type === "string" ? { name: item.type } : {}),
          id: item.id,
          raw: event,
        });
      }
    }
    const usage = isRecord(terminal.usage) ? terminal.usage : undefined;
    const inputTokens =
      usage && typeof usage.input_tokens === "number"
        ? usage.input_tokens
        : null;
    const outputTokens =
      usage && typeof usage.output_tokens === "number"
        ? usage.output_tokens
        : null;
    return {
      transcript,
      toolEvents,
      observedModel: null,
      usage: {
        known: inputTokens !== null || outputTokens !== null,
        inputTokens,
        outputTokens,
        costUsd: null,
      },
    };
  },
  isBudgetFailure() {
    return false;
  },
};
