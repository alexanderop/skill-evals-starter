import type { ToolEvent } from "../types.js";
import {
  isRecord,
  parseJsonLines,
  protocolError,
  type AgentAdapter,
} from "./types.js";

const MODEL_PATTERN = /^[a-z0-9][a-z0-9._-]*$/u;

export const copilotAgent: AgentAdapter = {
  id: "copilot",
  executable: "copilot",
  skillRoot: ".github/skills",
  defaultMaxBudgetUsd: null,
  executionPolicy:
    "file tools only; built-in MCP disabled; personal skills may load",
  validateModel(model) {
    if (!MODEL_PATTERN.test(model) || model === "auto")
      throw new Error("Copilot model must be a nonempty model identifier");
  },
  buildInvocation(input) {
    const prompt = input.baseline
      ? input.prompt
      : `Use the skill at .github/skills/${input.skill}/SKILL.md. ${input.prompt}`;
    return {
      args: [
        "--output-format",
        "json",
        "--model",
        input.model,
        "--available-tools",
        "view",
        "create",
        "edit",
        "glob",
        "grep",
        "apply_patch",
        "--allow-tool=write",
        "--disable-builtin-mcps",
        "--no-custom-instructions",
        "--disallow-temp-dir",
        "--no-ask-user",
        "--no-remote",
        "--no-remote-export",
        "--no-auto-update",
        "--prompt",
        prompt,
      ],
    };
  },
  decode(outcome) {
    const transcript = parseJsonLines("Copilot", outcome.stdout);
    const terminal = transcript.findLast((event) => event.type === "result");
    if (!terminal || terminal.exitCode !== 0)
      throw protocolError("Copilot did not emit a successful terminal result");
    const toolEvents: ToolEvent[] = [];
    for (const event of transcript) {
      const data = isRecord(event.data) ? event.data : undefined;
      if (!data || typeof data.toolCallId !== "string") continue;
      if (event.type === "tool.execution_start") {
        toolEvents.push({
          kind: "tool-use",
          ...(typeof data.toolName === "string" ? { name: data.toolName } : {}),
          id: data.toolCallId,
          raw: event,
        });
      } else if (event.type === "tool.execution_complete") {
        toolEvents.push({
          kind: "tool-result",
          ...(typeof data.toolName === "string" ? { name: data.toolName } : {}),
          id: data.toolCallId,
          raw: event,
        });
      }
    }
    const message = transcript.findLast(
      (event) => event.type === "assistant.message",
    );
    const messageData =
      message && isRecord(message.data) ? message.data : undefined;
    const observedModel =
      messageData && typeof messageData.model === "string"
        ? messageData.model
        : null;
    return {
      transcript,
      toolEvents,
      observedModel,
      usage: {
        known: false,
        inputTokens: null,
        outputTokens: null,
        costUsd: null,
      },
    };
  },
  isBudgetFailure() {
    return false;
  },
};
