# Local supervisor recovery, 12 September 2026

This continuation preserves the existing SQLite state owner, shared resource gate,
provider session registry and pause policy. It adds explicit original-thread
continuation and safe uninstall; no daemon or second queue is introduced.

## Evidence

Twenty isolated synthetic tests pass. Existing coverage retains cross-repository
contention, pressure hysteresis, PID reuse, disposable-only cancellation and
transaction recovery. New cases prove fixed original-ID provider arguments,
missing executable/capability refusal, failed execution after registration,
concurrent recoverers launching exactly one provider, and the same PID surviving
native execution. Dead process reconciliation records unknown/interrupted outcome,
not an invented provider success.

Uninstall tests cover pressure refusal, actual stopped state after a missing status
write, ended-but-stopped registrations, a later heavy-slot refusal preserving
already-committed resume status, live holder preservation and proven-dead cleanup.
Tests use private scratch state and explicitly created disposable processes.
They do not signal actual agent sessions or enable machine-wide management.

Scoped lint, formatting, architecture contract, documentation verification and
whitespace checks pass. Final exact remote CI remains required before handoff.

## Provider boundary

Read-only installed help reports Codex 0.154.0, Claude Code 2.1.258 and OpenCode
1.18.30. All support an explicit original session ID. The native executables resolve
on this machine. The official Codex npm launcher spawns the producer, so the adapter
resolves its packaged native binary directly; unknown script launchers are refused.
The inspected Codex launcher does not modify PATH. Its package-manager environment
markers affect installer management, which this continuation does not invoke.
The native adapter preserves the existing environment and provider permissions.

No actual provider continuation, account authentication, available credit or
original transcript availability was tested. Synthetic launch success is not proof
that a particular real conversation can resume. The provider owns its saved
history; missing or unflushed context is not reconstructed.

## Acceptance mapping

AC1–4 retain the existing queue, registry and ownership/pressure invariants. AC5
uses a foreground native process replacement registered before execution. AC6
provides explicit Codex/Claude/OpenCode continuation adapters; their heavy commands,
direct npm/npx and browser suites use the existing resource runner. Coverage reports
unmanaged launch paths and does not claim universal shell enforcement. AC7 refuses
unsafe uninstall instead of leaving an owned process silently stopped. AC8 uses
controlled native fixtures before any live enrollment or provider launch.

## Public content review

The self-hosting installation guide and existing local-supervisor changelog entry
explain the command, retained history, safe uninstall and cooperative tool boundary.
Command Center and FAQ descriptions remain accurate: this is optional developer
tooling, with no new business UI, tenant permission or production behavior.
