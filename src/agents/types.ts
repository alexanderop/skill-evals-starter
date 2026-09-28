import type { AgentId, ToolEvent, Usage } from "../types.js";

export type ProcessSpec = Readonly<{
  executable: string;
  prefixArgs: readonly string[];
}>;

export type ProcessOutcome = Readonly<{
  code: number;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}>;

export type AgentInvocation = Readonly<{
  args: readonly string[];
  evidenceFiles?: Readonly<Record<string, string>>;
}>;

export type DecodedAgentRun = Readonly<{
  transcript: readonly Readonly<Record<string, unknown>>[];
  toolEvents: readonly ToolEvent[];
  observedModel: string | null;
  usage: Usage;
}>;

export type AgentAdapter = Readonly<{
  id: AgentId;
  executable: string;
  skillRoot: string;
  defaultMaxBudgetUsd: number | null;
  executionPolicy: string;
  validateModel(model: string): void;
  buildInvocation(
    input: Readonly<{
      model: string;
      skill: string;
      prompt: string;
      baseline: boolean;
      evidencePath: string;
      maxBudgetUsd: number | undefined;
    }>,
  ): AgentInvocation;
  decode(outcome: ProcessOutcome): DecodedAgentRun;
  isBudgetFailure(outcome: ProcessOutcome): boolean;
}>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJsonLines(
  provider: string,
  text: string,
): readonly Readonly<Record<string, unknown>>[] {
  const events: Record<string, unknown>[] = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line) as unknown;
    } catch (cause) {
      const error = new Error(
        `${provider} emitted invalid JSON on line ${index + 1}`,
        { cause },
      );
      error.name = "AgentProtocolError";
      throw error;
    }
    if (!isRecord(value) || typeof value.type !== "string") {
      const error = new Error(
        `${provider} event ${index + 1} is not a typed object`,
      );
      error.name = "AgentProtocolError";
      throw error;
    }
    events.push(value);
  }
  return events;
}

export function protocolError(message: string): Error {
  const error = new Error(message);
  error.name = "AgentProtocolError";
  return error;
}
