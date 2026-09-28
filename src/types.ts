export type SkillRunErrorCode =
  | "model-disabled"
  | "invalid-input"
  | "spawn-failed"
  | "process-failed"
  | "protocol-failed"
  | "budget-exceeded"
  | "timeout"
  | "cancelled"
  | "setup-failed"
  | "cleanup-failed";

export type AgentId = "claude" | "codex" | "copilot";

export type ToolEvent = Readonly<{
  kind: "tool-use" | "tool-result";
  name?: string;
  id?: string;
  raw: Readonly<Record<string, unknown>>;
}>;

export type ExecutionMetadata = Readonly<{
  agent: AgentId;
  cliVersion: string;
  model: string;
  requestedModel: string;
  observedModel: string | null;
  startedAt: string;
  durationMs: number;
  exitCode: number;
  signal: NodeJS.Signals | null;
  baseline: boolean;
  maxBudgetUsd: number | null;
}>;

export type Usage = Readonly<{
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  known: boolean;
}>;

export type ProjectView = Readonly<{
  path: string;
  exists(relativePath: string): Promise<boolean>;
  readFile(relativePath: string): Promise<string>;
  readFileOrUndefined(relativePath: string): Promise<string | undefined>;
  read(relativePath: string): Promise<Uint8Array>;
  git(args: readonly string[]): Promise<string>;
}>;

export type RunResult = Readonly<{
  project: ProjectView;
  transcript: readonly Readonly<Record<string, unknown>>[];
  toolEvents: readonly ToolEvent[];
  execution: ExecutionMetadata;
  usage: Usage;
  evidencePath: string;
}>;

export type RunInput = Readonly<{
  agent?: AgentId;
  model?: string;
  skill: string;
  prompt: string;
  files?: Readonly<Record<string, string | Uint8Array>>;
  baseline?: boolean;
  timeoutMs?: number;
  maxBudgetUsd?: number;
}>;

export type FinishedTest = TestContext;
export type RunContext = Pick<TestContext, "onTestFinished" | "signal">;

declare module "vitest" {
  interface TaskMeta {
    skillEval?: Readonly<{
      agent: AgentId | null;
      evidencePath: string;
      requestedModel: string | null;
      usageKnown: boolean;
      costUsd: number | null;
      processStatus: "completed" | "failed";
      errorCode?: SkillRunErrorCode;
    }>;
  }
}

export class SkillRunError extends Error {
  readonly code: SkillRunErrorCode;
  readonly evidencePath: string | undefined;

  constructor(
    code: SkillRunErrorCode,
    message: string,
    options?: { cause?: unknown; evidencePath?: string },
  ) {
    super(
      message,
      options?.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "SkillRunError";
    this.code = code;
    this.evidencePath = options?.evidencePath;
  }
}
import type { TestContext } from "vitest";
