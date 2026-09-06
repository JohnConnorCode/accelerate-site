# Universal work board implementation evidence

Branch: `agent/universal-work-board`, isolated from the active primary checkout.
No production deployment, provider activation, customer sends, branch merge or
worktree removal was performed.

## Delivered behavior

| Previous behavior                                                         | Implemented behavior                                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Manifest reconciliation could overwrite notes and archive live-only cards | Reviewed, revision-checked import plans; explicit exports; no implicit archival                  |
| Notes silently truncated at 5,000 characters                              | Strict length validation with rejection; 14,044-character round-trip test                        |
| Status edits/reorder bypassed ownership                                   | Named lifecycle mutations, atomic batch reorder, server WIP/readiness checks                     |
| Free-text agent identity and service-role CLI                             | Revocable expiring project/operation-scoped credentials, HTTP/MCP/CLI                            |
| Stale claims recovered implicitly; completion removed worktrees forcibly  | Fenced leases, explicit recovery, safe worktree validation and preservation                      |
| Completion text immediately marked work shipped                           | Passing evidence/exact commit submitted for separate review; merge/deploy facts distinct         |
| Dependencies existed as titles in notes                                   | UUID edges, cycles rejected, canonical readiness and immutable mutation history                  |
| One local filter set and long unstructured editor                         | Shared/private named views, link sharing, readiness queues, execution/contract/evidence controls |

## Executed checks

- Agent contract and Feature Board dependency tests: 239 cards, valid taxonomy,
  no missing/circular/forward-milestone or active-prerequisite violations.
- Core work protocol PostgreSQL/API tests: long notes, invalid input, competing
  claims, replay and changed-payload conflict, lease session fencing, stale revision,
  prerequisite completion, cycles, review authorization, project scopes, revocation,
  immutable history, atomic reorder rollback and reorder replay.
- Local HTTP/MCP/CLI: authenticated scoped listing, unauthenticated admin denial,
  MCP discovery and unauthorized review rejection, CLI claim/release, no claim token
  in command output. Test credentials revoked; fixtures archived.
- Feature subtask helpers and admin-demo contract pass.
- Shared admin browser journey: all five scenarios, create → claim → progress →
  submit → review; desktop/mobile, keyboard and reduced motion. Separate theme
  screenshots and authenticated live-card detail/agent-access screenshots inspected.
- Authenticated admin read preserves the full 5,692-character collections card notes
  and displays typed acceptance, references, blocked dependencies and revision.
- Typecheck passes. Lint has no errors; six existing warnings remain in
  `integration-adapters.ts`. Guardrails and diff check pass.
- Production build is a mandatory commit hook gate; a successful implementation
  commit is the build receipt. No hook bypass is permitted.

Browser artifacts are under `/tmp/accelerate-work-board-qa/`; protocol/API logs
under `/tmp/work-board-*.log`. These local QA artifacts contain synthetic fixtures
and are intentionally outside source control. Do not publish credential/session files.

## Database and backlog evidence

Migration `20260906-universal-work-board.sql` executed and rerun against the
configured project `skjypuwkceoiunyhhqlm`, pooler
`aws-1-us-east-1.pooler.supabase.com`, database/role verified before execution.
415 original dependency links were imported; legacy conversion is marked once so
rerunning schema cannot restore edges an operator deliberately removed.

Ten new business-plugin cards were created through reviewed import plans, then
21 UUID dependencies were applied through a separate reviewed plan. Each card has
12 acceptance IDs, seven source references, workflow/data/tool/UI/failure/demo/KPI
contracts and explicit exclusions. Live readback matched the template notes and
structured acceptance. Total active board: 239; active QA fixtures: zero.

The existing baseline/reconciliation cards remain prerequisites. Donor references
at c7da31b are explicit committed references and do not claim that code is merged
into the primary checkout. See `docs/planning/BUSINESS-PLUGIN-SELECTION.md`.

## Release handoff

Applying additive schema is not deployment. The strict direct-write guard is
intentionally staged with `work_board_settings.enforce_writes=false` to preserve
an older deployed app until the founder authorizes a release. Legacy writes still
advance revisions, so they cannot evade stale-edit detection in the new service.
After deploying the exact verified code, the founder release procedure enables
this guard and verifies old writers fail closed. The old deployed UI/CLI is not
claimed to have acquired the new protocol merely because schema was applied.

Snapshot status drift is advisory by default now that live work is authoritative;
`reconcile-feature-manifest.mjs --check --strict` remains available for an explicit
release snapshot check. The implementation card should enter review with the exact
implementation commit and evidence; acceptance, merge and deployment are recorded
separately. Do not force-remove the implementation worktree.
