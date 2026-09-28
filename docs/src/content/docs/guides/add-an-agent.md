---
title: Add a coding agent
description: Implement an adapter while preserving shared workspace, evidence, cancellation, and cleanup behavior.
---

The adapter contract is `AgentAdapter` in `src/agents/types.ts`.

1. Add an adapter module under `src/agents/`. Use `AgentAdapter` from `src/agents/types.ts` as the contract.
2. Register the adapter in `src/agents/registry.ts` and update the public `AgentId` type in `src/types.ts`.
3. Define the CLI executable, skill directory, model validation, invocation arguments, and transcript decoder. Declare budget and execution-policy differences honestly.
4. Decode only the fields the shared result needs. Preserve the original events in `transcript`. Require a successful terminal event even when the process exits with zero.
5. Extend the fake CLI and contract tests. Cover skill staging, baseline omission, invalid transcripts, process failures, unsupported options, and unknown usage.
6. Run `pnpm verify`. Then run `pnpm test:agents:smoke` and the live HTML cases with the new agent. Inspect generated files and saved evidence.

Keep workspace setup, deadlines, process termination, snapshots, and cleanup in the shared runner. A new batch CLI should not require copying those functions. If the new agent requires an interactive protocol, add an execution driver deliberately instead of hiding it inside an argument builder.

See [agent behavior](../../reference/agents/) for the differences already exposed by the three adapters. Read [Isolation and ACP](../../concepts/isolation-and-acp/) before introducing an interactive transport.
