# Command Center core readiness and repair evidence

The native CRM blocker is repaired in the Accelerate workspace, and a bounded
Finance audit completed against the live database. Application fixes are prepared
in draft [PR 211](https://github.com/JohnConnorCode/accelerate-site/pull/211).
The application changes are not merged or deployed. Gmail and Calendar remain
unconnected, so complete provider workflows and unattended readiness are not
claimed. Existing Feature Board cards remain the authority for their acceptance.

## Repairs and behavior

- Coworker setup registers its tenant-owned identity before scoped policies and
  propagates setup failures. Repeated setup preserves saved names, roles, status,
  models, tool packs, configuration and human permission decisions. Explicit
  configuration changes still apply through their existing services.
- Capability and policy seeding preserves verified connections and restrictions.
  An additive repair permits native CRM readiness to replace only untouched
  legacy bootstrap placeholders. Provider placeholders, manual unavailability,
  prohibitions and immutable audit history remain preserved.
- Finance, Operations, Business Pulse, Sales, Meeting Intelligence and proactive
  reporting use actual CRM and runtime fields. Essential database errors fail the
  work instead of producing empty successful reports. Optional enrichment retains
  its existing fallback behavior.
- Meeting work without an available AI path or reviewed notes waits with an
  explanation. It no longer records invented CRM updates or queues placeholder
  completion work. The governed AI path remains available when configured.
- Today reads recent workspace activity through the existing tenant-bound reader.
  Record pages retain their scoped timelines. A completely unavailable daily
  snapshot fails clearly instead of generating an empty successful digest.
- Fresh Today, queue and booking imports no longer depend on a warmed AI tool
  registry. Booking validation schemas live in the existing pure contract, while
  approved domain services and validation rules remain unchanged.
- Operational health counts all active work states and uncertain outbound
  outcomes. No recorded integration failures is no longer described as proof that
  every integration is connected and healthy.
- AI history opens no-tool demo answers, retains actual tool/proposal trace events
  through reload, and discloses missing legacy evidence. Missing token usage shows
  **Not recorded**, while recorded zero remains zero. Mobile run details fit their
  containing surface.
- Setup, Work and Today public guides and the product changelog describe the
  changed behavior. Command Center marketing descriptions and FAQ were reviewed;
  their existing health and approval descriptions remain accurate.

## Applied live repairs

The target project and pooler were verified before executing each migration:
`skjypuwkceoiunyhhqlm`, `aws-1-us-east-1.pooler.supabase.com:5432`. The active
Accelerate tenant and configured founder's administrator membership were verified.

1. `20261005141858_coworker_setup_preserves_workspace_state.sql` preserves existing
   capability and policy state during seed operations.
2. `20261005154158_repair_legacy_native_capability_seeds.sql` upgrades untouched
   legacy native CRM placeholders through normal setup.

Both migrations ran through `npm run db:migrate` and were checked against the
immutable live ledger. The ledger now contains 124 catalog migrations. No unrelated
pending migrations or changed historical checksums were applied.

Finance setup ran through the existing proposed action and approved executor:
`513f52f6-e50a-4c6a-a941-1ed7ea1815e2`. Native `crm.write` is available and Finance
reports no capability gaps. Its complete saved coworker row and four other
capability rows were preserved. Finance had no existing scoped policies; setup
created its missing defaults without changing other coworkers.

The bounded existing Finance handler completed work item
`50b7e803-9844-4bb3-bd76-9e5e73c77fb2` at `2026-10-05T16:02:20.134+00:00`:
one claimed, one executed, one completed, zero failures, deferrals or timeouts.
The first attempt exposed the nonexistent `opportunities.company_name` query;
the resulting known read failure retained its normal bounded retry state. After
correcting the canonical fields, the proof succeeded. No customer email, calendar
write or other external business message was sent. Original failed items remain
unchanged.

## Remaining operational requirements

| Requirement                       | Confirmed state                                                                                                                                                                                                                                     | Next action                                                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google connection                 | No Google integration connection or source receipts. Gmail and Calendar capabilities remain unavailable.                                                                                                                                            | Identify the intended account, complete secure human consent, verify scopes and source receipts, then check Sales/Roofing readiness.                                                     |
| Historical timeout reconciliation | Four failed items retain unknown effect outcomes. Their linked artifacts and audits were reviewed; none has proof sufficient to declare complete. One has a partial internal handler receipt. No business action receipt was found for these items. | Obtain missing completion/provider evidence or use a supported reviewed reconciliation operation. Preserve history and idempotency; do not blindly requeue.                              |
| Connected business journeys       | The inquiry-to-approved-reply and qualification-to-booking-to-follow-up outcomes lack accepted connected-provider proof.                                                                                                                            | Run controlled fixtures after provider setup, with explicitly approved sends/booking, actual provider receipts, duplicate/failure/recovery checks and the existing Phase A/C acceptance. |
| Universal AI/admin parity         | Domain coverage remains partial. The shipped Collections policy slice does not satisfy the commerce parent or universal initiative.                                                                                                                 | Finish existing domain acceptance matrices and governed proposal, invoice and Collections operation gaps through shared services. Inventory counts alone are not proof of coverage.      |
| Application release               | PR 211 contains the application fixes. Live schema/configuration repair is a separate fact.                                                                                                                                                         | Review and integrate the exact verified branch; production application deployment requires a separate founder instruction.                                                               |

The initial read-only snapshot had 52 pending, 17 waiting and four failed work
items; all claimed work in recent wakes deferred. After repair, the 16:03 UTC
snapshot had 53 pending, 13 waiting and four failed. A 16:00 wake executed four of
five claimed items and deferred one. That scheduled wake used the deployed
application and does not prove the new source changes were deployed. Waiting
reasons may remain stale until their next readiness check. Current Sales deferral
requires Gmail and Calendar, without the former CRM blocker.

The scheduler and health snapshot job were active. One historical outbound
failure was a controlled send-verification fixture with an invalid key; it does
not establish a current sender-key failure. No scheduler outage is claimed.

A final read-only Today proof at `2026-10-05T16:51:37.710Z` returned 20 recent
workspace activities. Attention, handling, metrics and facts all resolved ready.
The initial fresh import exposed schema initialization cycles for Today, queue,
debate bookings and debate invitations. All four failed in isolated processes
before the fix and passed afterward. This proof sent no external messages and
does not activate Google capabilities or establish deployment.

## Verification

- The final worker source passed the 72-suite core run, full lint, documentation
  checks, generated docs index and source inventory checks. The focused Sales
  qualification/handoff proof passed seven durable draft, replay, tenant boundary,
  partial failure and recovery checks.
- Runtime regressions check all 16 worker/report paths against canonical field
  names and inject essential read failures. They prove setup ordering, preserved
  settings, explicit clearing, failed setup receipts, meeting deferral and Today
  workspace activity behavior. Four fresh-process import regressions also load
  both booking tool schemas successfully without relying on earlier imports.
- Native PostgreSQL runtime proof passed preservation, concurrent seed/sync,
  explicit revocation/disconnection, role denial, tenant isolation and audit
  checks. Full populated migration upgrade, replay and immutable checksum proof
  passed under PostgreSQL 17. An initial PostgreSQL 14 harness failed on an
  existing PostgreSQL 15+ security-invoker view; rerunning with the installed
  compatible version resolved that local harness mismatch.
- Earlier native Phase B, Today and work completion proofs passed. Six fictional
  businesses passed twelve desktop/mobile workflows on the published core
  baseline; those fixtures do not establish connected provider delivery.
- CI run `37318896258` for `69e883ba3de1518e9ef89d0c42c2290ecdea6443`
  passed all jobs, including a clean full-admin desktop/mobile rerun. Its AI run
  screenshots were opened. The new worker and mobile-fit source then passed the
  gated full-admin browser script locally against compiled
  `974dd7b8acfdd24895d638bd6e5a0cbcbca90424`: all 30 routes, desktop/mobile,
  keyboard, controlled inference, console checks, reduced motion and reload.
  Both AI run screenshots were opened; the mobile conversation control fits.
- CI for `974dd7b8acfdd24895d638bd6e5a0cbcbca90424` exposed two stale metadata
  checks: the public migration count and four silent-catch allowances. They were
  corrected and their focused stats, boundary and four adoption tests passed.
  The allowances were reduced, not widened. The successful connected-fork proof
  is run `37340256149`; the broader superseded run is not claimed green.
- Application source `7d9e4960c69a38c18117c87dd0e97b7018ba17f6` passed remote
  production build, TypeScript, built documentation, all fork journeys, native
  database proofs and full-admin desktop/mobile verification in CI run
  `37344619207`. Its AI history screenshots were opened and checked. That run
  failed a separate homepage timing assertion: its driver sampled a finished
  entrance clock after navigation. The test now samples the actual animation
  from inside the page before navigation, retaining its running-clock and fresh
  entrance assertions. Final branch verification is recorded on PR 211.
- The retained production artifact for `7d9e4960` runs locally on port 3016;
  launcher, Today and AI routes returned HTTP 200. Its deployment ID matches
  `7d9e4960c69a`. Subsequent verification-only changes do not change this app.
- Local build admission receipts retain the disk-capacity and other-worktree
  gate refusals. No resource limits were bypassed or unrelated output removed.
  After capacity recovered, the local browser run used the normal gate.
- The admin inventory contains 66 pages and 398 fingerprints; the AI inventory
  checks 129 routes and 115 mutation handlers. These are source review boundaries,
  not universal parity acceptance.

Baseline: `c2b090e51ec74c0433d368adde9c150686686b2f`. Private operational receipts
remain under `/tmp/accelerate-command-center-core-audit-20261005`; raw workspace
metadata and credentials are not committed. The existing homepage preview at
port 3014 remains intact and uses its earlier hero source. The core preview is
`http://localhost:3016/demo/command-center` and contains fictional demo data.
