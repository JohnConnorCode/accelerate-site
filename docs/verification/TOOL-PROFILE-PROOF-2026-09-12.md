# Task profile measurement and completion proof

Card: `sd-task-tool-profiles`, AC4. The recovery starts at published main
`d6d9831ef80040bc9be29092a4f31fda2fdc68ef`; profile membership and execution behavior
are unchanged. `npm run test:mcp-server` now runs the controlled proof in
`scripts/lib/tool-profile-proof.ts` through the real MCP adapter and registered
services. Each profile receives a fresh, identical in-memory tenant fixture.

## Actual initial tool definitions

The measurement is UTF-8 bytes of JSON-serialized `tools/list.tools`, including
names, descriptions, input schemas and the adapter's execution metadata. It is
not a name-list estimate, token count, latency measurement or provider bill.

| Profile      | Advertised tools | Definition bytes | Scripted outcomes completed |
| ------------ | ---------------: | ---------------: | --------------------------: |
| Full, before |               54 |           39,630 |                         2/2 |
| Core, after  |                8 |            3,533 |                         2/2 |
| Ops, after   |               26 |           14,137 |                         2/2 |

Counts describe the enabled fixture modules on this dated source tree, not every
installation. Tests compare actual responses and require smaller initial
payloads without introducing an arbitrary tool-count target.

## Representative tasks and discovery cost

The scripted client prepares a task-completion proposal and reads enabled
plugins. It calls an initially advertised tool directly. When the tool is
omitted, it queries `discover_tool_bundles`, finds the owning bundle in the
returned pages, calls `activate_tool_bundle`, checks that activation grants no
approval, resolves the actual activated host definitions from the shared
registry, and calls the operation through MCP.

| Profile | Prepare completion proposal          | Read enabled plugins                 |
| ------- | ------------------------------------ | ------------------------------------ |
| Full    | 1 execution call                     | 1 execution call                     |
| Core    | 2 discovery/activation + 1 execution | 2 discovery/activation + 1 execution |
| Ops     | 1 execution call                     | 2 discovery/activation + 1 execution |

Core's task bundle adds 11,426 bytes of activated host definitions; the plugin
bundle adds 16,394 bytes for either bounded profile. Those OpenRouter-shaped
host definitions are reported separately from the initial MCP payload, so the
initial reduction does not imply that discovery is free or identical in format.
MCP activation returns names; it does not change that connection's `tools/list`.
An ordinary MCP client needing additional input definitions can reconnect with
the full profile, as the corrected public guide explains.

The proposal task succeeds only when exactly one pending `update_task` action
refers to the fixture task and requests completion, while the task remains open.
The read succeeds only when it returns the seeded enabled plugin identity and
status. All three profiles achieve these same outcomes. A network guard records
zero requests and refuses any provider call.

This is deterministic local reachability and execution evidence. It does not
measure an LLM's ability to select tools, approval completion, production task
quality or real provider performance. Existing permission/disabled-tool tests
remain in the enclosing MCP suite.

## Verification

- `npm run test:mcp-server`: passed, including six task/profile outcomes and the existing protocol and safety checks.
- `npm run verify:agent-contract`: passed.
- Scoped ESLint and Prettier: passed for the changed test files.
- `npm run verify:docs` and `npm run docs:llms:check`: passed source coverage; no built-document strict pass claimed.
- `git diff --check`: passed.

No application execution code changed. Full combined-tree verification and the
canonical card submission belong to the coordinating integration owner.
