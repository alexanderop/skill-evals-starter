import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants, createWriteStream } from "node:fs";
import {
  access,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { finished } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import {
  getAgentAdapter,
  managedSkillRoots,
  parseAgentId,
} from "./agents/registry.js";
import {
  parseJsonLines,
  type AgentAdapter,
  type AgentInvocation,
  type ProcessOutcome,
  type ProcessSpec,
} from "./agents/types.js";
import type { RunContext, RunInput, RunResult } from "./types.js";
import { SkillRunError } from "./types.js";

const DEFAULT_TIMEOUT_MS = 180_000;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type InternalOptions = Readonly<{
  agent?: AgentAdapter;
  process?: ProcessSpec;
  environment?: NodeJS.ProcessEnv;
  now?: () => number;
}>;

function safeRelativePath(
  value: string,
  label: string,
  allowSkillPath = false,
): string {
  const segments = value.split("/");
  if (
    !value ||
    isAbsolute(value) ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.includes(":") ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new SkillRunError(
      "invalid-input",
      `${label} must be a normalized relative path: ${value}`,
    );
  }
  const normalized = segments.join("/");
  const folded = normalized.toLowerCase();
  if (
    folded === ".git" ||
    folded.startsWith(".git/") ||
    (!allowSkillPath &&
      managedSkillRoots.some((rootPath) => {
        const rootFolded = rootPath.toLowerCase();
        return folded === rootFolded || folded.startsWith(`${rootFolded}/`);
      }))
  ) {
    throw new SkillRunError(
      "invalid-input",
      `${label} uses a reserved path: ${value}`,
    );
  }
  return normalized;
}

function validateInput(input: RunInput): void {
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(input.skill)) {
    throw new SkillRunError(
      "invalid-input",
      "skill must contain lowercase letters, digits, and hyphens",
    );
  }
  if (!input.prompt.trim()) {
    throw new SkillRunError("invalid-input", "prompt must not be empty");
  }
  if (
    input.timeoutMs !== undefined &&
    (!Number.isFinite(input.timeoutMs) || input.timeoutMs <= 0)
  ) {
    throw new SkillRunError(
      "invalid-input",
      "timeoutMs must be a positive finite number",
    );
  }
  if (
    input.maxBudgetUsd !== undefined &&
    (!Number.isFinite(input.maxBudgetUsd) || input.maxBudgetUsd <= 0)
  ) {
    throw new SkillRunError(
      "invalid-input",
      "maxBudgetUsd must be a positive finite number",
    );
  }
  for (const path of Object.keys(input.files ?? {}))
    safeRelativePath(path, "fixture path");
}

function requireLiveEnvironment(environment: NodeJS.ProcessEnv): void {
  if (environment.SKILL_EVAL !== "1") {
    throw new SkillRunError(
      "model-disabled",
      "Live skill evaluations require SKILL_EVAL=1",
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseStreamJson(
  text: string,
): readonly Readonly<Record<string, unknown>>[] {
  try {
    return parseJsonLines("Claude", text);
  } catch (cause) {
    throw new SkillRunError(
      "protocol-failed",
      "Claude stream-json was invalid",
      {
        cause,
      },
    );
  }
}

async function git(
  workspace: string,
  args: readonly string[],
): Promise<string> {
  const result = await runProcess(
    { executable: "git", prefixArgs: [] },
    [
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "commit.gpgSign=false",
      "-c",
      "tag.gpgSign=false",
      "-c",
      "user.name=Skill Eval",
      "-c",
      "user.email=skill-eval@invalid.example",
      ...args,
    ],
    workspace,
    {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
    },
    undefined,
    20_000,
  );
  if (result.code !== 0) {
    throw new SkillRunError(
      "setup-failed",
      `git ${args.join(" ")} failed: ${result.stderr.trim()}`,
    );
  }
  return result.stdout;
}

async function terminateTree(child: ChildProcess): Promise<void> {
  if (child.pid === undefined) return;
  const target = process.platform === "win32" ? child.pid : -child.pid;
  try {
    process.kill(target, "SIGTERM");
  } catch {}
  await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 250));
  try {
    process.kill(target, "SIGKILL");
  } catch {}
}

async function runProcess(
  spec: ProcessSpec,
  args: readonly string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
  signal: AbortSignal | undefined,
  timeoutMs: number,
  logs?: Readonly<{ stdout: string; stderr: string }>,
): Promise<ProcessOutcome> {
  return await new Promise<ProcessOutcome>((resolvePromise, rejectPromise) => {
    if (signal?.aborted) {
      rejectPromise(new SkillRunError("cancelled", "Process cancelled"));
      return;
    }
    let child: ChildProcess;
    try {
      child = spawn(spec.executable, [...spec.prefixArgs, ...args], {
        cwd,
        env: environment,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (cause) {
      rejectPromise(
        new SkillRunError("spawn-failed", "Unable to spawn process", { cause }),
      );
      return;
    }
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    const stdoutLog = logs
      ? createWriteStream(logs.stdout, { flags: "a" })
      : undefined;
    const stderrLog = logs
      ? createWriteStream(logs.stderr, { flags: "a" })
      : undefined;
    let logFailure: unknown;
    let termination: Promise<void> | undefined;
    const watchWriter = async (writer: typeof stdoutLog): Promise<void> => {
      if (!writer) return;
      try {
        await finished(writer);
      } catch (cause) {
        logFailure ??= cause;
        termination ??= terminateTree(child);
      }
    };
    const stdoutFinished = watchWriter(stdoutLog);
    const stderrFinished = watchWriter(stderrLog);
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
      stdoutLog?.write(chunk);
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
      stderrLog?.write(chunk);
    });
    let reason: "timeout" | "cancelled" | undefined;
    const timer = setTimeout(() => {
      reason = "timeout";
      termination = terminateTree(child);
    }, timeoutMs);
    const abort = () => {
      reason = "cancelled";
      termination = terminateTree(child);
    };
    signal?.addEventListener("abort", abort, { once: true });
    child.once("error", async (cause) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      stdoutLog?.end();
      stderrLog?.end();
      await Promise.allSettled([stdoutFinished, stderrFinished]);
      rejectPromise(
        new SkillRunError("spawn-failed", "Unable to spawn process", { cause }),
      );
    });
    child.once("close", async (code, exitSignal) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      stdoutLog?.end();
      stderrLog?.end();
      try {
        await Promise.all([stdoutFinished, stderrFinished, termination]);
      } catch (cause) {
        rejectPromise(
          new SkillRunError("setup-failed", "Unable to persist process logs", {
            cause,
          }),
        );
        return;
      }
      if (logFailure !== undefined) {
        rejectPromise(
          new SkillRunError("setup-failed", "Unable to persist process logs", {
            cause: logFailure,
          }),
        );
        return;
      }
      if (reason) {
        rejectPromise(
          new SkillRunError(
            reason,
            reason === "timeout" ? "Process timed out" : "Process cancelled",
          ),
        );
        return;
      }
      resolvePromise({ code: code ?? 1, signal: exitSignal, stdout, stderr });
    });
  });
}

async function assertNoSymlink(
  rootPath: string,
  relativePath: string,
): Promise<string> {
  const safe = safeRelativePath(relativePath, "output path", true);
  const target = resolve(rootPath, safe);
  if (relative(rootPath, target).startsWith(".."))
    throw new SkillRunError("invalid-input", "output path escapes project");
  let cursor = rootPath;
  for (const part of safe.split("/")) {
    cursor = join(cursor, part);
    const stats = await lstat(cursor);
    if (stats.isSymbolicLink())
      throw new SkillRunError(
        "invalid-input",
        `Refusing symlink output: ${safe}`,
      );
  }
  const canonicalRoot = await realpath(rootPath);
  const canonicalTarget = await realpath(target);
  if (
    canonicalTarget !== canonicalRoot &&
    !canonicalTarget.startsWith(`${canonicalRoot}${sep}`)
  ) {
    throw new SkillRunError("invalid-input", `Output escapes project: ${safe}`);
  }
  return target;
}

async function snapshotEvidence(
  workspace: string,
  evidencePath: string,
): Promise<void> {
  try {
    const [status, diff] = await Promise.all([
      git(workspace, ["status", "--short", "--untracked-files=all"]),
      git(workspace, ["diff", "--no-ext-diff", "--binary", "HEAD"]),
    ]);
    await Promise.all([
      writeFile(join(evidencePath, "git-status.txt"), status),
      writeFile(join(evidencePath, "git-diff.patch"), diff),
    ]);
  } catch (cause) {
    await writeFile(join(evidencePath, "evidence-error.txt"), String(cause));
  }
}

async function snapshotProject(
  source: string,
  destination: string,
  sourceRoot = source,
): Promise<void> {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    const projectPath = relative(sourceRoot, from).split(sep).join("/");
    if (projectPath === ".git" || managedSkillRoots.includes(projectPath))
      continue;
    const stats = await lstat(from);
    if (stats.isSymbolicLink()) {
      await writeFile(
        join(destination, "snapshot-warning.txt"),
        `Skipped symlink: ${relative(source, from)}\n`,
        {
          flag: "a",
        },
      );
    } else if (stats.isDirectory()) {
      await snapshotProject(from, to, sourceRoot);
    } else if (stats.isFile()) {
      await cp(from, to, { errorOnExist: true });
    }
  }
}

async function run(
  ctx: RunContext,
  input: RunInput,
  internal: InternalOptions,
): Promise<RunResult> {
  validateInput(input);
  const environment = internal.environment ?? process.env;
  requireLiveEnvironment(environment);
  const agent = parseAgentId(input.agent ?? environment.SKILL_EVAL_AGENT);
  const adapter = internal.agent ?? getAgentAdapter(agent);
  const model = input.model ?? environment.SKILL_EVAL_MODEL;
  if (!model)
    throw new SkillRunError("invalid-input", "SKILL_EVAL_MODEL is required");
  try {
    adapter.validateModel(model);
  } catch (cause) {
    throw new SkillRunError(
      "invalid-input",
      `Invalid ${agent} model: ${model}`,
      {
        cause,
      },
    );
  }
  if (
    adapter.defaultMaxBudgetUsd === null &&
    input.maxBudgetUsd !== undefined
  ) {
    throw new SkillRunError(
      "invalid-input",
      `${agent} does not support maxBudgetUsd`,
    );
  }
  const maxBudgetUsd = input.maxBudgetUsd ?? adapter.defaultMaxBudgetUsd;
  const skillSource = join(root, "skills", input.skill);
  const skillStats = await lstat(skillSource).catch(() => undefined);
  if (!skillStats?.isDirectory() || skillStats.isSymbolicLink()) {
    throw new SkillRunError(
      "invalid-input",
      `Skill directory does not exist: skills/${input.skill}`,
    );
  }
  const instructions = await lstat(join(skillSource, "SKILL.md")).catch(
    () => undefined,
  );
  if (!instructions?.isFile() || instructions.isSymbolicLink()) {
    throw new SkillRunError(
      "invalid-input",
      `Skill requires a regular SKILL.md file: skills/${input.skill}`,
    );
  }

  const runId = `${new Date().toISOString().replaceAll(/[:.]/gu, "-")}-${randomUUID()}`;
  const evidencePath = join(root, ".eval-artifacts", runId);
  await mkdir(evidencePath, { recursive: true });
  const workspace = await mkdtemp(join(tmpdir(), "skill-eval-"));
  let completed = false;
  let settleRun!: () => void;
  const runSettled = new Promise<void>((resolvePromise) => {
    settleRun = resolvePromise;
  });
  ctx.onTestFinished(async ({ task }) => {
    try {
      await runSettled;
      await snapshotEvidence(workspace, evidencePath);
      const assertionsPassed = task.result?.state === "pass";
      if (completed && assertionsPassed)
        await rm(workspace, { recursive: true, force: true });
      else
        await writeFile(
          join(evidencePath, "retained-workspace.txt"),
          `${workspace}\n`,
        );
    } catch (cause) {
      throw new SkillRunError(
        "cleanup-failed",
        "Unable to finalize evaluation cleanup",
        { cause, evidencePath },
      );
    }
  });

  const startedAt = new Date().toISOString();
  const now = internal.now ?? Date.now;
  const started = now();
  const spec = internal.process ?? {
    executable: adapter.executable,
    prefixArgs: [],
  };
  const inputMetadata = {
    agent,
    skill: input.skill,
    prompt: input.prompt,
    files: Object.keys(input.files ?? {}),
    baseline: input.baseline ?? false,
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBudgetUsd,
  };
  const metadataPath = join(evidencePath, "metadata.json");
  let invocation: AgentInvocation | undefined;
  try {
    invocation = adapter.buildInvocation({
      model,
      skill: input.skill,
      prompt: input.prompt,
      baseline: input.baseline ?? false,
      evidencePath,
      maxBudgetUsd: maxBudgetUsd ?? undefined,
    });
    for (const [path, contents] of Object.entries(
      invocation.evidenceFiles ?? {},
    )) {
      const target = join(
        evidencePath,
        safeRelativePath(path, "evidence path", true),
      );
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, contents);
    }
    await writeFile(
      metadataPath,
      JSON.stringify(
        {
          input: inputMetadata,
          execution: { agent, model, startedAt, state: "setup" },
          ...(invocation
            ? {
                invocation: {
                  args: invocation.args,
                  executionPolicy: adapter.executionPolicy,
                },
              }
            : {}),
        },
        null,
        2,
      ),
    );
    await mkdir(join(workspace, adapter.skillRoot), { recursive: true });
    if (!input.baseline) {
      await cp(skillSource, join(workspace, adapter.skillRoot, input.skill), {
        recursive: true,
        dereference: false,
        errorOnExist: true,
      });
    }
    for (const [path, contents] of Object.entries(input.files ?? {})) {
      const target = join(workspace, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, contents);
    }
    const gitTemplate = join(evidencePath, "git-template");
    await mkdir(gitTemplate);
    await git(workspace, ["init", "--quiet", `--template=${gitTemplate}`]);
    await git(workspace, ["add", "--all"]);
    await git(workspace, [
      "commit",
      "--quiet",
      "--allow-empty",
      "--no-verify",
      "-m",
      "Initial fixture",
    ]);

    const version = await runProcess(
      spec,
      ["--version"],
      workspace,
      environment,
      ctx.signal,
      10_000,
    );
    if (version.code !== 0)
      throw new SkillRunError(
        "process-failed",
        `${agent} CLI version preflight failed`,
      );
    const cliVersion = version.stdout.trim() || version.stderr.trim();
    await writeFile(
      metadataPath,
      JSON.stringify(
        {
          input: inputMetadata,
          execution: {
            agent,
            cliVersion,
            model,
            startedAt,
            state: "running",
            args: invocation.args,
            executionPolicy: adapter.executionPolicy,
          },
        },
        null,
        2,
      ),
    );
    requireLiveEnvironment(environment);
    const outcome = await runProcess(
      spec,
      invocation.args,
      workspace,
      environment,
      ctx.signal,
      input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      {
        stdout: join(evidencePath, "stdout.jsonl"),
        stderr: join(evidencePath, "stderr.txt"),
      },
    );
    if (outcome.code !== 0) {
      const budget = adapter.isBudgetFailure(outcome);
      throw new SkillRunError(
        budget ? "budget-exceeded" : "process-failed",
        `${agent} exited with code ${outcome.code}`,
        {
          evidencePath,
        },
      );
    }
    let decoded;
    try {
      decoded = adapter.decode(outcome);
    } catch (cause) {
      throw new SkillRunError(
        adapter.isBudgetFailure(outcome)
          ? "budget-exceeded"
          : "protocol-failed",
        `${agent} output did not contain a successful terminal event`,
        { cause, evidencePath },
      );
    }
    const durationMs = now() - started;
    const metadata = {
      agent,
      cliVersion,
      model,
      requestedModel: model,
      observedModel: decoded.observedModel,
      startedAt,
      durationMs,
      exitCode: outcome.code,
      signal: outcome.signal,
      baseline: input.baseline ?? false,
      maxBudgetUsd,
    } as const;
    const usage = decoded.usage;
    await writeFile(
      metadataPath,
      JSON.stringify(
        {
          input: inputMetadata,
          execution: metadata,
          ...(invocation
            ? {
                invocation: {
                  args: invocation.args,
                  executionPolicy: adapter.executionPolicy,
                },
              }
            : {}),
          usage,
        },
        null,
        2,
      ),
    );
    await snapshotProject(workspace, join(evidencePath, "project"));
    completed = true;
    return {
      project: {
        path: workspace,
        exists: async (path) => {
          try {
            await access(
              await assertNoSymlink(workspace, path),
              constants.F_OK,
            );
            return true;
          } catch (cause) {
            if (isRecord(cause) && cause.code === "ENOENT") return false;
            throw cause;
          }
        },
        readFile: async (path) =>
          await readFile(await assertNoSymlink(workspace, path), "utf8"),
        readFileOrUndefined: async (path) => {
          try {
            return await readFile(
              await assertNoSymlink(workspace, path),
              "utf8",
            );
          } catch (cause) {
            if (isRecord(cause) && cause.code === "ENOENT") return undefined;
            throw cause;
          }
        },
        read: async (path) =>
          new Uint8Array(
            await readFile(await assertNoSymlink(workspace, path)),
          ),
        git: async (args) => await git(workspace, args),
      },
      transcript: decoded.transcript,
      toolEvents: decoded.toolEvents,
      execution: metadata,
      usage,
      evidencePath,
    };
  } catch (cause) {
    await snapshotEvidence(workspace, evidencePath);
    const code = cause instanceof SkillRunError ? cause.code : "setup-failed";
    await writeFile(
      metadataPath,
      JSON.stringify(
        {
          input: inputMetadata,
          execution: { agent, model, startedAt, state: "failed", code },
          ...(invocation
            ? {
                invocation: {
                  args: invocation.args,
                  executionPolicy: adapter.executionPolicy,
                },
              }
            : {}),
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(evidencePath, "failure.json"),
      JSON.stringify(
        {
          state: "failed",
          code,
          error: cause instanceof Error ? cause.message : String(cause),
        },
        null,
        2,
      ),
    );
    if (cause instanceof SkillRunError) {
      if (cause.evidencePath) throw cause;
      throw new SkillRunError(cause.code, cause.message, {
        cause,
        evidencePath,
      });
    }
    throw new SkillRunError("setup-failed", "Skill evaluation setup failed", {
      cause,
      evidencePath,
    });
  } finally {
    settleRun();
  }
}

export async function runSkill(
  ctx: RunContext,
  input: RunInput,
): Promise<RunResult> {
  return await run(ctx, input, {});
}

export async function __runSkillForTests(
  ctx: RunContext,
  input: RunInput,
  internal: InternalOptions,
): Promise<RunResult> {
  return await run(ctx, input, internal);
}
