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
