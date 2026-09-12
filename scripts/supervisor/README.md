# Machine resource supervisor

This optional local tool coordinates heavy jobs and registered agent sessions across repositories. It uses the existing single heavy-job slot. It does not manage business records, grant Feature Board access, install provider hooks, or recover a provider's missing transcript.

The ordinary backlog workflow remains `npm run agent:go`. Agents use the configured private board profile automatically; the user does not paste credentials. The supervisor addresses machine capacity separately. Management starts off, and this implementation has only been exercised against isolated test state and disposable child processes.

## What it does

- Queues heavy commands in first-in, first-out order when management is enabled. The shared gate still enforces its disk, memory and process-group limits when queue management is off.
- Registers a provider, original thread ID, worktree, task, PID and process start identity. It refuses another live writer for the same provider thread.
- Pauses an explicitly registered producer with `SIGSTOP` and resumes it with `SIGCONT` after pressure clears. Pausing retains memory and held locks; it does not free RAM.
- Classifies restart state without launching a duplicate agent. Superseded records cannot take ownership back. Running owners stay running, paused owners stay paused, and unavailable owners become interrupted. Context after the last heartbeat is reported as unavailable.
- Cancels only explicitly registered disposable children when cancellation policy is enabled. Registered agent sessions cannot be made disposable. Every signal checks the current registry and process start identity.

This is cooperative tooling, not a background daemon or an OS sandbox. `enforce` is an explicit pressure-policy pass; installing the CLI does not continuously monitor every process. `coverage` names supported provider launch paths and reports unmanaged bypasses. Unrestricted commands can bypass queue participation, so `universalEnforcement` remains false.

## Requirements and state

Use Node.js **22.16 or newer**, matching the repository engine and doctor check. State lives in the private per-user `~/.accelerate-supervisor/state.sqlite`; lifecycle intent and outcome records append to `audit.log.jsonl`. State transactions serialize the complete read/modify/write across processes. A crashed transaction rolls back and releases its database lock automatically. A busy state database waits at most five seconds before surfacing an error.

The implementation uses Node's built-in SQLite API; its availability and timeout support are described in the [Node documentation](https://nodejs.org/api/sqlite.html). There is no additional database service or credential setup.

A prior handoff's `config.json`, `queue.json`, `sessions.json` and `jobs.json` are imported once, when first read. Original files are preserved as history. Stop using the old JSON-based supervisor code after migration: later edits to those historical files are not merged into the database. Corrupt legacy state is reported, never silently replaced with an empty queue.

`ACCELERATE_SUPERVISOR_DIR` and `ACCELERATE_HEAVY_LOCK_DIR` isolate tests. All cooperating production commands must use the same per-user state and heavy-slot paths. The `enroll` list records repository participation for coverage; it does not install hooks or restrict which repository can call the shared gate.

## Use it

```bash
npm run supervisor -- status
npm run supervisor -- coverage
npm run supervisor -- install
npm run resources:run -- <command> [arguments...]
npm run supervisor -- uninstall
```

Installation enables queue delegation for the shared resource runner. Uninstall disables that delegation without deleting sessions, audit history or worktrees. Explicit custom-directory callers and `ACCELERATE_SUPERVISOR_DISABLE=1` retain the direct resource gate; they do not bypass its capacity checks or single slot.

A provider adapter can register an existing session and heartbeat it:

```bash
npm run supervisor -- register --provider opencode --thread <original-thread-id> --pid <owner-pid> --repo <path>
npm run supervisor -- heartbeat --provider opencode --thread <original-thread-id> --pid <owner-pid>
npm run supervisor -- pause --provider opencode --thread <original-thread-id>
npm run supervisor -- resume --provider opencode --thread <original-thread-id>
npm run supervisor -- end --provider opencode --thread <original-thread-id>
```

Specify the provider when different providers use the same thread ID. Registration does not invent a provider thread or attach to one; the calling adapter must supply the actual original identity.

For a custom long-lived runner, `admit --repo <path> --kind build --pid <owner-pid>` returns a ticket and `release --ticket <ticket>` releases it. The short-lived CLI cannot own a job that continues after it exits. Prefer `resources:run`, which retains its process identity through child cleanup and releases its own ticket.

Cancellation is off by default. A reviewed integration can explicitly register a non-agent child with `register-disposable --id <job-id> --pid <child-pid> --start <exact-start-identity>` and enable `disposableCancel` through the validated configuration API. No arbitrary PID, missing start identity, or caller-supplied `disposable: true` flag authorizes cancellation by itself.

## Recovery and verification

Run `plan-recovery` to inspect registered sessions, then `recover` to apply current classifications. Application rechecks each identity and refuses a changed plan. Resume paused producers explicitly after pressure clears. For a proven-dead registered owner, run `recover --provider codex --thread <original-id>` (or `claude` / `opencode`). This launches the provider’s supported explicit-ID continuation in the retained enrolled checkout. The foreground process replaces itself with the provider, retaining the registered PID and process identity. One continuation runs at a time; a live owner is never replaced. Node must support `process.execve`; missing executables or capability fail before launch. Existing provider permissions remain in force. No latest-session selector, fork, new worktree or transcript copying is used.

Provider authentication, credit and original saved conversation must still be available. A provider error does not create a replacement conversation. After the provider exits, `recover` classifies its dead process as interrupted/unknown outcome: process death alone does not establish whether the task finished. Context after the last durable provider save remains unknown.

`uninstall` first resumes owned stopped producers serially through the existing pressure gate. It checks actual stopped process state, including a crash before the paused status was recorded. Unsafe resume, a running continuation, live heavy holder or live waiting job refuses uninstall and keeps management enabled. Only proven-dead admission holders are cleared. Session history, audit and repositories remain intact.

A heavy-slot directory left by a proven-dead owner is different from a database transaction lock. `recover --clear-stale-lock` clears only a proven-dead holder. A live or replacement holder is preserved, including when an older ticket or direct gate tries to release it. Unreadable ownership needs inspection; it is not permission to remove the directory.

`npm run test:supervisor` covers cross-process updates, duplicate registration, crash rollback, replacement-owner preservation, paused recovery, process identity, controlled cancellation, pressure and CLI behavior. `npm run test:resources` verifies the existing resource runner. Tests use scratch state and explicitly spawned children; they do not signal real agent sessions or install machine-wide management.
