# Connected learning implementation review

## What changed

The original failure was a partial unique index that treated every rule for an
action and scope as a replacement. Independent rules now coexist. An explicit
replacement, its proposal, and its audit history commit together; concurrent
approval and replay use database locks. Historical rules remain available for
review rather than being silently reactivated.

A shared context loader applies coworker, entity, plugin, authority and guidance
scope. It supplies bounded whole rules, source revisions and a context receipt.
Interactive agents, scheduled coworkers, proposal drafts, content briefs and the
inbound responder use that owner. Public chat and data-extraction jobs retain
their separate source boundaries. The responder receives only reviewed authority
and moves to policy version `inbound-responder.v3`; existing automatic-send
approval must be renewed deliberately after upgrade.

Private PDF, DOCX, text and Markdown uploads queue extraction through the existing
work engine. Limits are 4 MiB, 100 PDF pages, 500,000 characters, a 15-second parser
deadline and a bounded worker heap. Text search requires no model credential.
Drive evidence is checked against current access, selected folders and provider
revision before stored text is returned. Uploaded sources can be archived;
failed indexing can be retried. Parser dependencies are pinned and included in
server tracing.

Plugin knowledge declarations select existing host-reviewed sources rather than
adding data permissions. Meeting preparation and Client onboarding exercise
source retrieval alongside their existing report and approval workflows.
Coworkers can discover additional read tools within a 40-tool ceiling; their
permitted writes and action approval paths remain enforced.

Human-reviewed draft edits and explicit corrections create replay-safe proposals.
New action and tool receipts feed a bounded signal collector. Execution failures
produce review tasks; missing information is classified separately. A correction
whose proposal write failed retains enough input for the work engine to retry.
Neither observations nor successful actions grant approved authority.

Get started derives progress from stored records for the first opportunity. It
separates AI connection, document indexing, retrieval, model execution, scheduler
execution and a completed linked task. Invited tenants and self-hosted owners use
the same tenant-bound service. Manual inquiry and task work needs no AI or mail
key. The fictional demo explicitly distinguishes simulation from verified live
capabilities.

## Research and implementation choices

The research favored explicit evidence, reviewed changes and repeatable checks:

- [Intercom's optimization workflow](https://www.intercom.com/help/en/articles/11390088-optimize-fin-instantly-with-the-help-of-ai)
  informed the distinction between a content gap and an execution defect.
- [Intercom batch testing](https://www.intercom.com/help/en/articles/10521711-batch-test-fin-ai-agent)
  informed regression coverage around the original failure and unaffected work.
- [Glean connector documentation](https://docs.glean.com/connectors/about)
  and [agent memory](https://docs.glean.com/agents/concepts/memory) informed source
  access checks and separating durable memory from retrieved evidence.
- [Notion custom agents](https://www.notion.com/help/custom-agents) informed
  versioned capability declarations and explicit operational prerequisites.
- [Supabase hybrid search](https://supabase.com/docs/guides/ai/hybrid-search)
  informed retaining full-text search as a useful credential-free baseline.
  Optional vector retrieval is not implemented or claimed as evaluated here.
- [PDF.js releases](https://github.com/mozilla/pdf.js/releases) and
  [Mammoth raw-text extraction](https://github.com/mwilliamson/mammoth.js)
  informed pinned parsers and extracting text without converting untrusted HTML.

These are design influences, not evidence that another product's implementation
has been reproduced or that Accelerate achieves equivalent model quality.

## Local verification and its limits

The focused command is `npm run test:connected-learning`. It covers scope,
context limits, parser behavior, real PostgreSQL approval concurrency and audit
rollback, correction recovery, signal replay, tenant isolation, authenticated RLS,
and live-access/revision decisions against a fully intercepted Drive transport.
The PostgreSQL fixture uses a controlled tenant-context function; existing tenant
lifecycle and record-permission tests cover the application's authorization
contract separately.

Additional checks exercise Learning Inbox, correction capture, knowledge,
work completion, plugin reports and workflows, responder boundaries, tool grants,
action reversibility, tenant isolation and public search. Fixture evaluations
prove persistence and retrieval behavior. They do not measure live model quality,
external delivery or a human user's time to first value.

`scripts/qa-connected-learning.mjs` runs the actual production UI at desktop and
mobile widths in the fictional workspace. Its artifacts are written to
`/tmp/accelerate-connected-learning-qa`. It checks proposal persistence, separate
approval, readiness recovery, keyboard focus, overflow and public guide rendering.
The browser, local server and disposable PostgreSQL instances close after checks.

Public content reviewed: Learning Inbox, Your first result, Meeting preparation,
Client onboarding, the product changelog, Command Center descriptions and FAQ,
plugin READMEs and the generated documentation index. The new first-use screenshot
and updated Learning Inbox image show fictional data.

## Installation and release boundaries

The canonical migration catalog includes, in dependency order:

1. `20260920-connected-learning.sql`
2. `20260927-knowledge-documents.sql`
3. `20260928-learning-signals.sql`

Apply the catalog to the intended installation before exposing the new routes,
then verify private storage, extraction, scheduler execution and model readiness.
The source change does not deploy the app or migrate production. Existing pending
plugin approvals may require a fresh preview because the host execution contract
has changed. Historical receipts remain intact.

A live provider smoke test, a fresh hosted invitation trial, a fresh self-hosted
installation trial and a real new-user observation remain separate operational
proof. No invitations, real customer sends, production schema changes or live
model evaluations were performed as part of the local verification. The UI
therefore reports receipts and evidence, not an invented improvement score.

## Continuation: retrieval and recovery hardening

The follow-up inspection found several bounded-context failures that were not
covered by the initial happy paths. Canonical query errors were silently treated
as no matches, document results could be crowded out by notes, and the first
200 alphabetically ordered policies could omit every official rule. The shared
services now report partial coverage, alternate canonical and document evidence,
normalize result limits once, and retrieve at most 200 rules per authority with
explicit overflow warnings. Oversized rules are skipped whole so smaller rules
can still fit. Plugin guidance allowlists reject untyped rules. Canonical entity
reads run concurrently; no new provider, dependency or schema is introduced.

Drive retrieval rechecks workspace activity, the selected connection and folders
after provider verification. Disconnects, account replacements and folder removals
during the request withhold evidence. This closes the observed request window;
it does not claim a distributed transaction with Google or prevent revocation
after a response has already been delivered.

First-use task proof now queries for dated and completed records directly, so
newer open tasks cannot push completed proof outside a 20-row window. The later
learning-reuse indicator still examines the latest 50 context events and 20
approved proposals; it is recent evidence rather than a permanent achievement.

Regression coverage includes concurrent access changes, 201 approved rules plus
older official guidance, untyped plugin guidance, oversized rules, partial data
failures, source diversity, invalid limits, and completed tasks followed by 25
new tasks. The document work handler is exercised through damaged storage bytes,
successful retry, replay, archive during extraction and cancellation. Storage and
Google are controlled fixtures, not live provider verification.

The follow-up research uses [Anthropic's context engineering guidance](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
for bounded, targeted retrieval and [Glean's connector guidance](https://docs.glean.com/connectors/about)
for preserving source permissions. These implementation choices are our application
of those principles, not vendor guarantees or measured model-quality gains.
Supabase's current changelog and [filter reference](https://supabase.com/docs/reference/javascript/using-filters-or)
were checked; the changes use the installed client's existing filter API.
Public Learning Inbox guidance and the changelog explain recovery; Command Center
capability descriptions and FAQ were reviewed and remain accurate.

Follow-up verification passed: agent contract, lint, knowledge retrieval,
connected-learning service/parser/PostgreSQL tests, all 58 work-completion cases,
report plugins, business workflows, responder envelope, documentation checks,
and the production build with all 537 static pages and TypeScript. An initial
build caught a test-fixture spread type; the fixture was corrected, its test and
lint rerun, and the final build passed. Both build logs remain under `/tmp`.
Production-browser QA passed at 1440px and 390px with zero page errors,
persisted proposals, separate approval, recovery, keyboard and reduced-motion
checks. Desktop Learning Inbox, mobile guide and mobile first-use screenshots
were opened and inspected. The QA server and browser exited normally.

Receipts: `/tmp/connected-hardening-checks.log`,
`/tmp/connected-hardening-build.log` (resolved fixture failure),
`/tmp/connected-hardening-build-final.log`,
`/tmp/connected-hardening-browser.log`, and
`/tmp/accelerate-connected-learning-qa/result.json`. No production migration,
merge, deployment, real invitation, paid model evaluation or live Google action
was performed in this continuation.

## Continuation: independent learning recovery and credential readiness

A failed correction previously aborted a batch of up to 50 signals. If its source
had been removed or its plugin disabled, the same oldest item could repeatedly
prevent later evidence from being reviewed. The existing signal service now
classifies each item independently and records `recovery_required` with a remedy
and the last attempt time. The original correction and actor remain unchanged.
Completed signals stay complete. Cancellation and database failures that prevent
saving recovery still propagate rather than producing a false success.

Both scheduler and handler use the same bounded selector. Each batch contains at
most 50 signals, with up to 25 due recovery items and capacity reserved for fresh
evidence. Failed items wait 15 minutes and are retried oldest-attempt-first, so a
large failed backlog rotates without excluding new work. The cooldown bounds retry
frequency, not the total number of attempts; unresolved source or plugin issues
remain visible for an operator to repair. No model call or authority promotion is
part of classification. The existing work engine owns leases and batch outcomes.

Corrections whose original input or actor is missing or invalid are classified as
`manual_review` rather than retried indefinitely. Their evidence stays available
with an instruction to inspect the source and submit a new correction.

Learning evidence prioritizes up to 25 items needing recovery or manual review ahead of recent evidence,
deduplicates the combined list and caps it at 50. It shows the affected correction
rule alongside its remedy, with wrapping for long text. The service retains the
same tenant authorization and public response excludes stored recovery inputs
and actor credentials.

First-use AI readiness now calls the same credential resolver as coworkers and
the responder. It recognizes only the permitted bootstrap environment fallback,
never exposes the key and never lends it to another tenant. An unreadable tenant
credential reports needs attention while manual progress stays available. A
configured credential remains separate from a verified model execution.

The recovery pattern follows [AWS's partial-batch guidance](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html):
retain successful items and retry failed items independently. This is applied to
the existing database-backed work engine, without introducing AWS or another
queue. The new deterministic regression covers removed sources, independent
outcomes, cooldown, due-only scheduling, replay, a 30-failure/60-fresh backlog,
cancellation, database failure, visible recovery evidence, and credential
isolation. The test database now preserves multi-column ordering, matching the
queries it is meant to exercise.

Public Learning Inbox, first-result guidance and the changelog were updated.
Command Center descriptions and FAQ were reviewed and remain accurate. No schema,
permission, provider or autonomous-action boundary changed. Live-provider trials,
fresh human onboarding trials and comparative model-quality evaluations remain
separate validation; this work does not establish their outcomes.

Verification for this continuation passed: `verify:agent-contract`, full lint,
`test:connected-learning` (including the new recovery suite and real PostgreSQL),
learning inbox, correction capture, all 58 work-completion cases, knowledge,
report plugins, business workflows, responder envelope, tenant isolation and all
six first-value scenarios. After adding the terminal manual-review case, affected
lint, connected-learning tests and documentation checks passed again. The final
production build passed TypeScript and generated all 537 pages.

Production-browser QA passed at 1440px and 390px with zero page errors, persisted
proposals, separate approval, first-use error recovery, visible recovery rule and
remedy, keyboard navigation, overflow checks and reduced motion. The initial
keyboard assertion incorrectly expected Tab from the last control to stay inside
the document; the test now starts from a defined control. Recovery screenshots
were centered above the mobile dock, opened and inspected. All owned servers and
browsers closed after each run.

Evidence: `/tmp/connected-recovery-checks.log`,
`/tmp/connected-recovery-final-checks.log`,
`/tmp/connected-recovery-build.log`,
`/tmp/connected-recovery-browser.log` (resolved test assertion),
`/tmp/connected-recovery-browser-verified.log`, and
`/tmp/accelerate-connected-learning-qa/result.json`. The implementation remains a
review handoff, without production migration, merge, deployment or live-provider
activation.
