import { SkillRunError, type AgentId } from "../types.js";
import { claudeAgent } from "./claude.js";
import { codexAgent } from "./codex.js";
import { copilotAgent } from "./copilot.js";
import type { AgentAdapter } from "./types.js";

export const agentAdapters = {
  claude: claudeAgent,
  codex: codexAgent,
  copilot: copilotAgent,
} as const satisfies Record<AgentId, AgentAdapter>;

export const managedSkillRoots = Object.freeze(
  Object.values(agentAdapters).map((adapter) => adapter.skillRoot),
);

export function parseAgentId(value: string | undefined): AgentId {
  const id = value ?? "claude";
  if (Object.hasOwn(agentAdapters, id)) return id as AgentId;
  throw new SkillRunError("invalid-input", `Unknown agent: ${id}`);
}

export function tryParseAgentId(value: string | undefined): AgentId | null {
  try {
    return parseAgentId(value);
  } catch {
    return null;
  }
}

export function getAgentAdapter(id: AgentId): AgentAdapter {
  return agentAdapters[id];
}
