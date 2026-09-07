# Natural-language agent execution

This repository treats a plain-language backlog request as an execution command.
A user does not need to know the board CLI or provide a ticket key.

## Trigger

When a user asks an agent to pick up backlog work, take the next task, continue
the board, finish the work, commit it, or follow the repository protocol, treat
the request as the same intent. Examples include:

- “Pick up work from the backlog and go until it is completed and committed.”
- “Take the next ready task and finish it.”
- “Continue the board work and follow protocol.”

The agent must begin execution after reading this entrypoint. Do not stop after
`git status`, `git log`, a broad documentation scan, or a status-only response.
Do not ask for a card key when the live board can select ready work.

Never ask the user to paste `WORK_BOARD_URL`, `WORK_BOARD_TOKEN`, a database
credential, or a secret into chat, a prompt, a ticket, or a terminal argument.
Never present credential choices such as “paste credentials,” “work unclaimed,”
or “prepare only, wait.” Resolve the configured private profile automatically:
the remote profile uses its ignored board environment file, and an authorized
local operator profile uses its named project and existing local Supabase
environment. Both profiles are shared through the Git common directory, so a
new worktree does not need another prompt. If no profile is available, return
`SETUP_REQUIRED` with the non-interactive setup instruction and do not claim or
edit shared work.

## Execution contract

1. Run the repository's internal `agent:go` entrypoint immediately. The user
   should not need to type or understand that command.
2. Accept the selected card, worktree, approved base, lease and packet returned
   by the runner. Work only in that isolated worktree.
3. Implement every acceptance item and preserve the packet's exclusions,
   dependencies, canonical services, plugin boundaries and tenant rules.
4. Run the packet's checks, repair failures, create the exact commit, write
   acceptance-linked evidence and submit it with `agent:complete`.
5. Continue until the work is submitted for review or a precise
   `BLOCKED_REQUIRES_OPERATOR` state is reached. A stale dated generated report
   is repairable setup drift and must not end the session.

Review acceptance, merge, deployment and production proof are separate recorded
operations. Never invent authority or bypass a lease, approval, repository base,
strict-write gate or provider receipt to make the request appear complete.

## Setup and recovery

The first connected checkout may need one private transport profile. A remote
profile points to an ignored board environment file; an owner-authorized local
profile points to an ignored Supabase environment file and a named project. The
runner reports missing setup without claiming work or printing a credential.
Once configured, the profile is shared by worktrees through the Git common
directory and contains no token or database key. If a claim response is
uncertain, keep the printed request key and retry that same request; never issue
a second claim to guess what happened. Renew leases before expiry and preserve
a retained worktree when stepping away.

The local profile has this shape in the private Git common directory (the path
is never committed):

```json
{
  "version": 1,
  "transport": "local-operator",
  "project": "accelerate",
  "envFile": "/absolute/path/to/.env.local"
}
```

The remote profile contains `version: 1`, `transport: "https"`, and an absolute
ignored `envFile` containing the scoped board URL and token. The agent selects
the profile; the user never has to repeat its setup in a work request.

## Provider compatibility

This contract is written for coding agents that can read repository Markdown
and run shell commands. It is intentionally independent of OpenCode, Claude,
Codex, Cursor, Gemini, or any model/provider. The command is an implementation
detail; the natural-language trigger is the user-facing API.
