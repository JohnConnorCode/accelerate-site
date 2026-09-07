# Universal work board protocol v1

## Natural-language execution

The phrase “pick up work from the backlog and go until it is completed and
committed; follow protocol,” and equivalent requests to take the next task or
continue the board, is an execution command for repository agents. The agent
must run the repository pickup runner without requiring a card key, then use
the returned claim, isolated worktree and packet until evidence is submitted or
an operator-required block is reached. The runner's command name is an internal
implementation detail (`agent:go`); the user-facing interface is the plain-language
request. Orientation-only output, status-only output and stale generated
reports are not completion.

The live Feature Board is the authoritative work record. Git contains schemas,
card templates and dated exports. A stale checkout never gets authority to
replace live notes, claims, dependencies, review decisions or newly created cards.
This board is platform-global and founder-administered. It is separate from tenant
business WorkItems: a card defines implementation work; its claim and event chain
record attempts. Business plugin execution continues through tenant WorkItems,
action_queue, capabilities, receipts and audit, never this platform planning API.

## Identity and access

Founder sessions use `/api/admin/features`. Founder-only credential management is
`/api/admin/features/agents`: POST `{name,projects,scopes,days}` returns a random
credential once; GET lists metadata; DELETE `{id}` revokes it. Credentials expire
in at most 90 days, are stored only as SHA-256 hashes and cannot grant review,
recovery, archive, wildcard projects or tenant access. Project and operation scopes
are resolved on every request, including MCP calls. Never put credentials in cards,
logs, command arguments, Git, screenshots or prompts.

Remote agents use `WORK_BOARD_URL` and `WORK_BOARD_TOKEN`, HTTP
`/api/agent/work-board`, or MCP `/api/agent/work-board/mcp`. An owner-authorized
local operator may instead use the private Git-common profile with a named
project and the existing local Supabase configuration; that transport still
uses this same service and lifecycle, and grants no review authority. No
database key is required for remote workers. MCP provides work_list,
work_history and work_mutate. Tenant MCP tools never include the platform board.
List responses are bounded and expose nextOffset.

## Work contract

Each card has a stable UUID and optional template key; project, initiative, parent,
kind, priority, controlled labels, outcome, acceptance, scope/exclusions, references,
verification commands, and repository base branch/exact commit belong to its
versioned definition. Dependencies are UUID edges. Renaming titles cannot sever an
edge. Self/cyclic/cross-project edges are rejected atomically. Legacy unresolved
references block readiness and must be resolved explicitly.

Backlog and planned cards with an outcome, acceptance, no explicit blocker and all
prerequisites verified are claimable. Initiative roll-ups are never executable.
Readiness is computed in SQL for both lists and claims. The global WIP cap is six;
expired claims still occupy a slot until an operator reviews them. No background
recovery silently gives another worker ownership of unfinished work.

## Mutations and execution

POST `{operation,id,revision,requestKey,payload}`. Create and automatic claim omit
id. Definition/dependency/planning/review changes require the revision last read;
a stale edit returns 409 with its draft preserved in the client. Every mutation
uses a client-generated UUID requestKey. Retry the same key and identical payload
for the same logical operation; a different payload using that key conflicts.
A receipt and before-state are recorded atomically in an immutable event ledger.

Claim requires a fresh random 32-byte base64url claimToken generated and retained
by the caller before sending. Only its hash is stored on the card. Heartbeat,
progress, block, release and submit require that token, the authenticated actor,
an unexpired lease and in_progress status. Leases last 30 minutes. A stale worker
cannot renew or complete a later worker's attempt. Expiry is explicit review work.

Lifecycle: backlog/planned → claim → in_progress → submit → in_review → accepted
verification (the legacy `shipped` key). Rejection returns work to planning with a
recorded reason. Submit requires named passing checks with evidence; feature and
bug changes require the exact 40-character implementation commit. Review is a
separate founder-authorized operation. Self-review requires an explicit recorded
override reason. Review acceptance is not proof of merge or deployment.

Only backlog/planned/blocked transitions are drag-and-drop actions. Execution
requires its named operations. Labels/colors/order are presentation; arbitrary
new columns cannot create lifecycle states or bypass the server.

The internal `agent:go` runner resolves the configured private transport and
claims the next eligible card without requiring a key. For explicit/manual
compatibility, `npm run agent:next -- --card <key>` claims work. A worktree requires the card's
repository base commit and branch. Existing worktrees must match the expected
branch and ancestry; errors preserve the claim/worktree for inspection. The CLI
never falls back into an unrelated checkout and never removes a worktree.
Use `agent:heartbeat`, `agent:release`, and `agent:complete -- --card <key>
--evidence-file <local.json>`. Complete submits for review. Session secrets live
under the Git common directory with private permissions, outside tracked files.
Cleanup, merge and deployment remain separate deliberate actions.

## Imports and exports

`npm run seed:features -- --plan /tmp/work-plan.json --cards key1,key2` produces an
explicit proposal with current revisions. Inspect the full JSON diff before
`npm run seed:features -- --apply --plan /tmp/work-plan.json`. Each change is
idempotent and compare-and-swap protected. A partial failure leaves completed
receipts intact; retrying that plan replays successes and exposes conflicts.
Imports do not change execution status or erase cards absent from the manifest.
`--export <path>` writes a dated snapshot. `--verify` reports template divergence
without treating valid live edits as corruption. Title-based legacy dependencies
are migration input only; new edges use the dependencies operation. Use
`--link-dependencies --plan <file> --cards <keys>` after creating imported cards
to review conversion of template references into UUID edges. `verify:feature-status`
reports snapshot drift as advisory; add `--strict` for an explicit release snapshot gate.

## Rollout and verification

`migrations/20260906-universal-work-board.sql` is additive and rerunnable. Its
`work_board_settings.enforce_writes` starts false so applying schema cannot break
an older founder-controlled deployment. Legacy writes still increment revision.
After deploying the verified adapters, the founder's release procedure enables
that flag, verifies old mutation paths fail closed, and confirms HTTP/MCP/CLI
against the deployed commit. Until that release, the old live app still uses its
old behavior. Never equate a local implementation or applied schema with deployment.

Run `npm run test:work-board` for controlled, isolated project fixtures; archive
fixtures afterward. Verify duplicate/replay, concurrent claims, stale revisions,
lease fencing, dependency cycles/readiness, evidence, reviewer authority, project
scope, revocation and immutable history. Browser QA covers desktop/mobile,
light/dark, keyboard and reduced motion. Demo uses the same admin page and a
session-local transport; no provider or protected platform writes are allowed.

## Execution packet v2

`work_spec.packetVersion=2` adds explicit northstar phase/layers/contribution,
currentBehavior, failureModes, optional blockerResolution and resume handoff.
Acceptance IDs and verification commands declare local, controlled-integration,
production or observation environments. Submission must supply passing evidence in
each acceptance item's required environment. Historical submissions remain intact.

Features and bugs cannot be claimed with an incomplete packet. The SQL readiness
function reports missing/invalid fields consistently to UI, HTTP, MCP and CLI.
Lists paginate in the same order as claims: Now, Next, Later; priority; board order;
stable ID. Readiness and horizon are separate: eligible Later cards remain Later.
Initiatives are never claimed. Explicit reviewer acceptance is permitted only when
all their declared child prerequisites have verified status; no automatic roll-up
writes or automatic merge/deployment claims occur.

The additive `20260907-work-packet-quality.sql` migration does not enable the
production write-enforcement switch. Old deployed writers remain a documented
release dependency until the founder-authorized protocol deployment is complete.
