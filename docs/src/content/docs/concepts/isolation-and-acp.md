---
title: Isolation and ACP
description: Why fresh projects, CLI policies, and protocol support provide different guarantees.
---

## Fresh projects and account state

The runner creates a temporary Git project for each trial. Fixtures and selected skills start from a clean project state. Git hooks and signing are disabled, and Git ignores global and system configuration.

A fresh project is not a container or a fully isolated account. The agent still uses its installed CLI and authenticated account. Permission profiles differ by adapter. Local files, personal skills, plugins, and service-side state can affect behavior.

Copilot loaded personal skills and plugins in a local probe with custom instructions disabled. Codex's ignored user configuration does not establish that all global instructions and skills are absent. A baseline removes the selected project skill, not all personal context.

Treat this as a trusted-local evaluation runner. Use a separately designed sandbox when a task requires stronger filesystem, network, or account isolation.

## Shared runner and native commands

The runner owns workspace creation, fixture paths, Git setup, process deadlines, cancellation, evidence, and Vitest cleanup. Each adapter owns skill placement, command arguments, model validation, terminal-event validation, tool events, and usage extraction.

An agent is the CLI that performs the task. A model is the identifier passed to that CLI. Copilot can route to models from several providers.

Native commands fit the current lifecycle. Every case sends one prompt to one new process and evaluates files after it exits. Each adapter preserves the original transcript while translating the few fields the tests consume.

## What ACP changes

ACP can standardize session messages and tool updates. It also introduces initialization, session creation, bidirectional requests, permission responses, cancellation, and protocol-version handling. It does not standardize skill directories, CLI tool restrictions, account configuration, or spend limits.

GitHub Copilot has a native `copilot --acp --stdio` server. GitHub documents ACP support as public preview. A local no-inference probe successfully negotiated protocol version 1. That handshake verifies protocol availability, not an end-to-end skill run. [GitHub ACP reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/acp-server).

Codex support uses the separate `@agentclientprotocol/codex-acp` adapter. The adapter starts Codex App Server and translates requests and events. Adopting it adds another executable and compatibility boundary. [Codex ACP adapter](https://github.com/agentclientprotocol/codex-acp).

ACP is a reasonable future transport when several agents require interactive sessions. Keep the public evaluation result independent of transport. Add an ACP executor only when needed, while preserving the runner's shared cleanup and evidence guarantees. A CLI argument builder alone cannot implement ACP because the protocol requires writable stdin and request-response coordination.

Before adopting ACP, verify model selection, skill loading, file edits, permission handling, successful terminal responses, cancellation, and child-process cleanup through the real runner. A protocol handshake or a fake server test is insufficient evidence for live agent support.

Codex's native JSONL event contract is documented in [non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode).
