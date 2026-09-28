# Agent adapters and ACP

The runner owns workspace creation, fixture paths, Git setup, process deadlines, cancellation, evidence, and Vitest cleanup. Each agent adapter owns skill placement, command arguments, model validation, terminal-event validation, tool events, and usage extraction.

An agent is the CLI that performs the task. A model is the identifier passed to that CLI. Keep them separate. Copilot can route to models from several providers.

## Add another coding agent

1. Add an adapter module under `src/agents/`. Use `AgentAdapter` from `src/agents/types.ts` as the contract.
2. Register the adapter in `src/agents/registry.ts` and update the public `AgentId` type in `src/types.ts`.
3. Define the CLI executable, skill directory, model validation, invocation arguments, and transcript decoder. Declare budget and execution-policy differences honestly.
4. Decode only the fields the shared result needs. Preserve the original events in `transcript`. Require a successful terminal event even when the process exits with zero.
5. Extend the fake CLI and contract tests. Cover skill staging, baseline omission, invalid transcripts, process failures, unsupported options, and unknown usage.
6. Run `pnpm verify`. Then run `pnpm test:agents:smoke` and the live HTML cases with the new agent. Inspect generated files and saved evidence.

Keep workspace setup, deadlines, process termination, snapshots, and cleanup in the shared runner. A new batch CLI should not require copying those functions. If the new agent requires an interactive protocol, add an execution driver deliberately instead of hiding it inside an argument builder.

## Execution differences

Adapters explicitly identify the staged `SKILL.md` in the prompt. In the tested restricted Claude session, project slash-command discovery did not expose the staged skill. Explicit file references avoid slash-command resolution while preserving the restricted policy. The subsequent Claude live check was blocked by an expired OAuth session, so its file-edit path remains unverified here.

A successful process is not a successful evaluation. The runner requires a successful terminal event. The test then checks generated files and rendered HTML. A model can finish normally after refusing or misunderstanding a task.

Claude exposes a USD budget flag. Codex does not expose an equivalent flag in its batch command. Copilot's credit accounting is not a USD cap. The runner rejects an explicit unsupported USD budget rather than discarding it. Unknown usage fields remain null.

Personal settings can affect results. Copilot loaded personal skills and plugins in a local probe with custom instructions disabled. Codex's ignored user configuration does not prove that all global instructions or skills are absent. A baseline omits the selected project skill. It does not establish a fully isolated account.

## Why native commands are the default

Native commands fit the current lifecycle. Every case sends one prompt to one new process and evaluates files after it exits. Each adapter preserves the original transcript while translating the few fields the tests consume.

ACP can standardize session messages and tool updates. It also introduces initialization, session creation, bidirectional requests, permission responses, cancellation, and protocol-version handling. It does not standardize skill directories, CLI tool restrictions, account configuration, or spend limits.

GitHub Copilot has a native `copilot --acp --stdio` server. GitHub documents ACP support as public preview. A local no-inference probe successfully negotiated protocol version 1. That handshake verifies protocol availability, not an end-to-end skill run. [GitHub ACP reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/acp-server).

Codex support uses the separate `@agentclientprotocol/codex-acp` adapter. The adapter starts Codex App Server and translates requests and events. Adopting it adds another executable and compatibility boundary. [Codex ACP adapter](https://github.com/agentclientprotocol/codex-acp).

ACP is a reasonable future transport when several agents require interactive sessions. Keep the public evaluation result independent of transport. Add an ACP executor only when needed, while preserving the runner's shared cleanup and evidence guarantees. A CLI argument builder alone cannot implement ACP because the protocol requires writable stdin and request-response coordination.

Before adopting ACP, verify model selection, skill loading, file edits, permission handling, successful terminal responses, cancellation, and child-process cleanup through the real runner. A protocol handshake or a fake server test is insufficient evidence for live agent support.

Codex's native JSONL event contract is documented in [non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode).
