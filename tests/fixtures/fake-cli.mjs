import { spawn } from "node:child_process";
import { mkdir, symlink, writeFile } from "node:fs/promises";

if (process.argv.includes("--version")) {
  process.stdout.write("2.1.260 (Claude Code)\n");
  process.exit(0);
}
if (process.env.FAKE_ARGS)
  await writeFile(process.env.FAKE_ARGS, JSON.stringify(process.argv.slice(2)));
if (process.env.FAKE_MARKER)
  await writeFile(process.env.FAKE_MARKER, "spawned");
if (process.env.FAKE_MODE === "timeout") {
  process.on("SIGTERM", () => {});
  const child = spawn(
    process.execPath,
    ["-e", "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],
    { detached: false, stdio: "ignore" },
  );
  if (process.env.FAKE_CHILD_PID && child.pid)
    await writeFile(process.env.FAKE_CHILD_PID, String(child.pid));
  setInterval(() => {}, 1_000);
} else if (process.env.FAKE_MODE === "invalid-json") {
  process.stdout.write("not json\n");
} else if (process.env.FAKE_MODE === "failure") {
  process.stderr.write("synthetic failure\n");
  process.exitCode = 7;
} else if (process.env.FAKE_MODE === "budget") {
  process.stderr.write("max budget exceeded\n");
  process.exitCode = 1;
} else if (process.env.FAKE_MODE === "no-terminal") {
  process.stdout.write(
    JSON.stringify({ type: "assistant", message: { content: [] } }) + "\n",
  );
} else if (process.env.FAKE_MODE === "error-terminal") {
  process.stdout.write(
    JSON.stringify({ type: "result", subtype: "error", is_error: true }) + "\n",
  );
} else if (process.env.FAKE_MODE === "malformed-terminal") {
  process.stdout.write(
    JSON.stringify({ type: "result", subtype: "success", is_error: "false" }) +
      "\n",
  );
} else {
  await mkdir("output", { recursive: true });
  if (process.env.FAKE_MODE === "invalid-html")
    await writeFile("output/product.html", "<h1>Wrong</h1>");
  else await writeFile("output/result.txt", "generated");
  if (process.env.FAKE_MODE === "symlink")
    await symlink("../input.txt", "output/link.txt");
  if (process.env.FAKE_AGENT === "codex") {
    process.stdout.write(
      JSON.stringify({ type: "turn.started" }) +
        "\n" +
        JSON.stringify({
          type: "item.started",
          item: { id: "tool-1", type: "command_execution" },
        }) +
        "\n" +
        JSON.stringify({
          type: "item.completed",
          item: { id: "tool-1", type: "command_execution", exit_code: 0 },
        }) +
        "\n" +
        JSON.stringify({
          type: "turn.completed",
          usage: { input_tokens: 12, output_tokens: 4 },
        }) +
        "\n",
    );
  } else if (process.env.FAKE_AGENT === "copilot") {
    process.stdout.write(
      JSON.stringify({
        type: "session.tools_updated",
        data: { model: "gpt-5.4" },
      }) +
        "\n" +
        JSON.stringify({
          type: "tool.execution_start",
          data: { toolCallId: "tool-1", toolName: "apply_patch" },
        }) +
        "\n" +
        JSON.stringify({
          type: "tool.execution_complete",
          data: { toolCallId: "tool-1", toolName: "apply_patch" },
        }) +
        "\n" +
        JSON.stringify({
          type: "assistant.message",
          data: { model: "gpt-5.4", outputTokens: 4 },
        }) +
        "\n" +
        JSON.stringify({ type: "result", exitCode: 0, usage: {} }) +
        "\n",
    );
  } else {
    process.stdout.write(
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", id: "tool-1", name: "Write", input: {} },
          ],
        },
      }) + "\n",
    );
    process.stdout.write(
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        model: "claude-sonnet-5",
        usage: { input_tokens: 12, output_tokens: 4 },
        total_cost_usd: 0.01,
      }) + "\n",
    );
  }
}
