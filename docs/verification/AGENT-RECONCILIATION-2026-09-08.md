# Agent work reconciliation — 8 September 2026

This audit is owned by the integration branch `integration/agent-reconciliation-20260908`, based on published main `269c610cdb217a7268c6cf0482be49466ade4c70`. The operator requested evaluation and completion of recent agent work; focus is the 24 hours ending 2026-09-08 11:58 UTC. This is an evidence receipt, not a second backlog or a deployment claim.

## Inventory and preservation

- Initial inventory: 73 worktrees, five dirty, zero open PRs. All local/remote refs and four stashes were inspected; the two recent stashes concern Site Studio/Agent Harness specifications.
- Dirty tracked patches and relevant untracked source were copied to a private local snapshot before integration. Original branches, files and worktrees remain intact. Nested worktrees and credentials are excluded from the copy.
- The GitHub account, branch protection and fresh main passed the maintainer doctor. Exact source trees match merge receipts for PRs 36, 40, 43–47, 49, 53, 57 and 58. PR 56 differs only in dependency versions subsequently integrated on main. Old branch ancestry is not an unmerged-work count.
- The live board has 343 cards at audit time. Campaign cloning and contact bulk operations are marked shipped but their implementation commits are absent from main. Review evidence and Git integration must be reconciled independently.

## Recent work and integration disposition

| Work                           | Source                                  | Review finding / next proof                                                                                                                                                                                                                                |
| ------------------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coworker grounding             | `cbb80ee`                               | Adapt to current shared coworker service; retain durable work/run/proposal receipts and partial states. Old duplicated fallback wrappers must not return.                                                                                                  |
| First-value journey            | `859a44f`                               | Six fictional business fixtures; local proof does not satisfy a real new-user observation. Port compatible readers and verification.                                                                                                                       |
| Runtime record permissions     | `e26a734`, `6820d26`                    | Review arbitrary string grants, unknown-type default allow, migration catalog, denial terminal consumers and UI/API parity before accepting. Do not reapply obsolete route/build fixes.                                                                    |
| Deadlines and circuit recovery | `31accfe`                               | Review timeout ordering, noncooperative late effects, waiting/reclaim semantics and circuit accounting; uncertain execution must not silently re-enter runnable work.                                                                                      |
| Tool profiles                  | `599df7f`                               | Preserve one registry and call-time authorization; verify discovery still reaches omitted operations.                                                                                                                                                      |
| Resource supervisor            | `6721180`, `7cbf633`                    | Competing implementations of one card. First uses non-atomic admission JSON and mismatched parent/child PID validation; second shares the existing atomic slot but queue/session writes still need concurrency review. Choose one tested owner.            |
| Bulk contacts                  | `02d3e94`                               | Review lost-update handling, exact per-record outcomes, draft-only staging, canonical contact identity, tenant isolation and production migration receipt.                                                                                                 |
| Campaign duplication           | `f4f59e1`                               | Review atomic draft/step/audit creation, replay key, source-version concurrency and demo persistence.                                                                                                                                                      |
| Won-to-delivery handoff        | `25e4b88`                               | Validate proposal ownership and replay semantics on current shared services; complete shared approval/UI/demo proof.                                                                                                                                       |
| Drive content indexing         | `8c6df7a`                               | Bound client already rewrites tenant-composite upsert; require that binding explicitly. Repair complete-list retirement, supported exports, access revocation and unchanged/duplicate handling.                                                            |
| Site Studio and themes         | `097f932` through `36e2909`             | Useful validated document/patch/rendering work; filesystem draft storage is not tenant-scoped durable serverless persistence. Complete shared persistence, authorization, receipts and bounded generation before release. Review theme changes separately. |
| Workspace blueprints           | dirty primary checkout                  | Preserve additive migration, service, review UI and demo; inspect completeness and missing packet fields before integration.                                                                                                                               |
| Services redesign              | dirty `agent/services-strategy-rebuild` | Preserve current source; inspect responsive rendering, copy and unfinished styling.                                                                                                                                                                        |
| Admin shell / unified executor | dirty retained worktrees                | Old-base edits require semantic porting; do not overwrite newer shared inspectors, actions or tasks.                                                                                                                                                       |
| Agent Harness planning         | `16e69ef`, two recent stashes           | Reconcile specification and live-card coverage without replacing current board definitions with old templates.                                                                                                                                             |

## Verification recorded so far

- Main baseline `verify:agent-contract`: passed.
- Maintainer preflight: passed after resolving existing compatible dependency location.
- Adapted coworker `test:ai-context`: passed, 14 checks.
- Integrated `test:mcp-server`, `test:ai-tool-gates`, `test:first-value-business-journey`: passed.
- Hardened runtime record permission contract: passed, 18 checks.
- Adapted coworker `test-work-completion`: passed, including successful-tool/ungrounded-prose rejection and qualification/draft receipts.

- Combined candidate TypeScript check: passed.
- Hardened Drive indexing: seven fixture groups passed, including partial listing, revoked download access, binary-format refusal, unchanged revisions, duplicates and tenant separation. Connected Google execution remains unverified. Export formats were checked against [Google's current format reference](https://developers.google.com/workspace/drive/api/guides/ref-export-formats).
- Public source/setup and MCP client guides, product changelog and Command Center MCP description updated alongside the integration. Docs rendering and full release checks remain pending.

- Deadline integration: work completion suite passed, 58 cases. Timeout/abort paths preserve a terminal reconciliation hold; late completion and former one-hour retry regression covered. Circuit accounting uses a recent window and one recovery probe; its process-local scope is documented.
- Resource gate paused a verification run at 4.5 GiB free. Removed only ignored `.next/cache` directories from inactive product-redesign and Drive worktrees, then reran through the unchanged gate. No source or verification artifacts removed.

- Combined deadline candidate TypeScript: passed. Denial audit failure fixture: passed; a missing audit is surfaced while the already durable denied action stays terminal.

- Site Studio domain battery passed (schema, tokens, assets, renderer, generation contract, revision, discard and section regeneration). Production storage ported to tenant-owned database records with atomic revision/audit writes and checksum concurrency checks. Module disabled by default; publishing remains separate backlog work.
- Full local migration ledger/upgrade battery passed, including existing Radar/proposal/outreach proofs and the new native Site Studio tenant/concurrency/immutable-history/audit-rollback/disable checks. No production database changed.
- UI review changes: failed Site Studio loads show errors/retry; discard binds the viewed checksum; renames preserve identity. Controlled API browser fixtures passed at 1440 and 390 px: create, scoped navigation, rename with the viewed checksum, discard, and empty list. Screenshots inspected at both widths. This is not a connected provider or ordinary demo-adapter proof.
- A second capacity pause required removing the remaining 14 ignored Next caches from confirmed inactive Accelerate worktrees. The exact paths are retained in the private audit snapshot; active unrelated Next processes were not modified.

Integration remains in progress. No feature is accepted from source presence or historical test claims alone. The final candidate must pass required CI, migration and affected browser checks before merge; production readiness remains a separate receipt.

### Startup consistency and UI review

The primary checkout is retained on the dirty Site Studio branch, where `agent:go`
is absent. A clean detached control checkout now points at published main; the
parent entrypoint selects it for new backlog sessions. The integration's runner,
dispatch lifecycle commands and doctor share one profile resolver. Read-only
local board verification passes using the existing profile without claiming a
card. Fixture checks cover worktree reuse, remote profile precedence, explicit
profile isolation, invalid scopes and private diagnostics.

| Area                  | Before review                                 | Integrated behavior                                                    |
| --------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| Site draft navigation | Absolute admin links escape demo/tenant scope | Shared admin navigation retains workspace scope                        |
| Failed draft reads    | Empty state or indefinite loading             | Visible failure and retry                                              |
| Photo choices         | Internal catalog identifiers                  | Readable photo descriptions                                            |
| Draft changes         | File replacement and unchecked discard        | Stable database identity, viewed-checksum guards and immutable history |

## First integration receipt

PR 59 merged on 2026-09-08 at 13:23:40 UTC as
`b409b39bff1a24ee00613a861b9c1dd25a637be0`. Its tree exactly matches candidate
`edc43a20d18a1b3e05168e4f725bc440a5de1dbd`. CI run `34230046586` passed all
three required jobs, including production build, typing, lint, core contracts,
native migration/upgrade checks and the full browser suite. Retained Site Studio
screenshots at 1440/390 were inspected. The clean control checkout now runs this
published version and its read-only board diagnostic passes using the existing
private local profile. No card was claimed by the diagnostic.

The first run exposed a browser-fixture type shadow, older formatting, and an
old generic-failure expectation for an autonomy denial; these were corrected
before the passing run. The lifecycle dispatcher also compared local claim
identities with a null HTTP URL, making subsequent heartbeats/submission fail.
It now checks the exact selected transport. The runner emits lifecycle commands
from the current control checkout for tickets with older approved worker bases.

The Vercel GitHub check links to an account-blocked error. Read-only CLI access
nevertheless confirms the declared project and team; an older production
release is READY. Those facts do not establish deployment of this candidate.

## Reproduced remaining handoff defects

Controlled tests against the preserved source handoffs reproduced these gaps;
no production records or real process-control state was changed:

- `f4f59e1`: force an audit failure after campaign duplication, then retry. The
  failed call leaves one copy and the retry creates a second. The follow-up
  integration replaces this sequence with an atomic, version-checked transaction
  and a durable request receipt.
- `02d3e94`: concurrently add two different tags to one contact. Both operations
  report success but only one tag remains. A campaign in `review` also accepts
  bulk enrollment despite the card's draft-only AC-4. Native atomic tag updates,
  exact affected-row outcomes and admission under a draft-state lock remain
  required before integration.
- `7cbf633`: replace a synthetic slot's owner record, then release the older
  queue ticket. The newer owner directory is removed. Recovery also gives an
  older superseded session precedence over its live replacement. Concurrent
  queue/session read-modify-write lacks serialization. Do not enable either
  competing supervisor implementation from its existing test claims alone.
- Dirty workspace blueprints save the parent, version, latest-version pointer
  and audit in separate writes; a zero-row version bump is not detected. Their
  useful compiler/review structures remain preserved, but durable save/replay
  and current approval/installation proof are unfinished.

New activity appeared during the audit: `agent/admin-polish-themes` contains
active theme/editor/shell changes, and a stage-history reconciliation checkout
was created. These are preserved outside the pinned first integration. The
inventory grew from 73 to 77 before the campaign follow-up checkout was added;
worktree count is not a count of missing features.

## Bulk-contact reconciliation candidate

The `02d3e94` handoff is ported onto the campaign integration without its stale board snapshot. Tag writes now use locked current rows; staging uses one shared host transaction for canonical recipient matching, suppression checks, draft-state admission and exact inserted-row outcomes. Bulk calls require draft state, while the existing single-member API retains explicit active-campaign admission. The API returns per-recipient outcomes instead of an error after silently inserting a partial set.

Suppression continues through the canonical shared writer. It can still fail after persisting part of the safety change; the result describes this and retry repairs remaining stops/audits, including already-suppressed contacts. No automatic unsuppression is introduced. Native and browser proofs are added but acceptance remains pending their execution. The demo now persists tags, members and suppression instead of checking only disabled controls.

## Campaign integration receipt

PR 60 merged as `0ae18bf590ca204f2cc57480a290bfdcd068bc7e` on 2026-09-08 at 13:57:41 UTC. Its tree matches tested head `0b394628e3ece01545b3fb4d86b8163abd5403f2`. CI `34233603360` passed all required jobs, including native concurrent replay and audit rollback, plus the full browser suite. All four campaign screenshots were inspected at 1440/390 px for SuperDebate and Northline Roofing. Lost-response recovery across reload and confirmed stale-source recovery passed. The clean detached control checkout now points to this merge. No production deployment is asserted.

## Supervisor reconciliation candidate

The `7cbf633` API is retained instead of combining two competing session stores. SQLite transactions replace racy JSON read/modify/write; original JSON is imported once and preserved. Resource-slot transitions share the same transaction boundary, compare current owner identity on release, and refuse replacement-owner removal. Recovery skips superseded records, revalidates the plan and records paused processes as paused without claiming a resume. Disposable cancellation requires persisted registration, current child/parent identities, enabled policy and exclusion of registered agents. PATH detection no longer invokes the nonexistent external `command` program.

Twenty-two isolated supervisor/resource checks passed, including eight concurrent writers, duplicate session admission, crash rollback, replacement holders, current paused recovery, and synthetic process control. No real session was signaled and management was not installed. Node 22.16+ is explicit in the package engine, doctor and setup guide. Full CI and integration remain pending.

## Supervisor integration receipt

PR 62 merged as `1c17e90db758d0399a201ec368bcb014222471cf` on 2026-09-08 at 14:33:03 UTC. Its tree matches tested head `7cb91d2ae61d974557ff3ea7e1e9998ba772d884`. CI `34237350451` passed all required jobs. The clean control checkout points to this merge; no global supervisor installation or production deployment was performed.
