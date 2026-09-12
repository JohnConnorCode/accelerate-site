# Task context and retained checkout recovery, 12 September 2026

The existing CLI now lets an active worker attach an inspected, manually prepared
checkout through `progress --worktree <path>` or `checkpoint --worktree <path>`.
It checks the repository, approved base and feature branch, then requires a successful
canonical heartbeat before recording the path. Existing different bindings are preserved.
There is no new lifecycle, database table or review authority.

## Verification

- All 11 developer-handoff tests passed, including actual CLI credit exhaustion,
  lost-response replay, stale predecessor refusal, isolated successors and legacy attachment.
  Attaching the protected main checkout failed before any POST in the fixture.
- Checkpoint suite passed nine groups, including source/index preservation, explicit
  new files, excluded paths, foreign repository/origin rejection and failed-push retention.
- Task context and private profile suites passed: bounded output, selected packet,
  strict secret-free profile schema, shared worktree configuration and explicit precedence.
- Scoped ESLint, agent contract, docs verification and whitespace checks passed.
- Independent read-only review found no ownership, path, token or replay blocker.

## Live proof

Card `agent-task-context-efficiency` was attached through the normal worker transport.
Its checkpoint receipt was 308 bytes and renewed the lease; the immutable remote ref
resolved to `62bf19473c6530e34f0e0b9f986b995af1fbb26d`. The canonical card names that
same checkpoint commit and attempt. Existing tracked changes remained in the worker.

`show --card` and `status --card` each returned exactly one complete 7,650-byte packet
at revision 14. Neither changed ownership or revision. A bounded `status --limit 1`
returned one card and its pagination cursor in 412 bytes. The following heartbeat
returned a compact receipt and revision 15; explicit `--full` returned 11,182 bytes.
Read-only packet retrieval uses `show`; `resume` retains its ownership takeover meaning.

The same checked attachment subsequently recorded real checkpoints for the language,
Kanban and executor recovery workers. Invalid context-card base metadata was caught
before attachment and corrected through release, canonical edit and normal reclaim.
All retained source was preserved.

## Public documentation review

The self-hosting installation guide documents the legacy attachment command and its
success/refusal behavior. The changelog now accurately says work volume does not block
claims. Existing Command Center workflow and FAQ copy already describe configured
pickup and checkpoint recovery, so these developer-only attachment details do not
change their feature promise. No production application deployment occurred.
