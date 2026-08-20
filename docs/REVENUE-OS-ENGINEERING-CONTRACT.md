# Revenue OS engineering contract

This is the stable architecture for Accelerate automation, intelligence, and
data. It defines where truth lives, how work executes, and what evidence is
required. Feature status stays on the Feature Board; this document changes only
when the operating contract changes.

## System law

All human, AI, integration, webhook, and scheduled work uses the same domain
services. Entry points adapt input and output; they do not recreate business
rules.

```text
UI / API / form / webhook / cron / AI tool
                    |
        authenticate + validate + authorize
                    |
       identity resolution + canonical linkage
                    |
       atomic claim / idempotency / confirmation
                    |
             Revenue OS domain service
                    |
     canonical state + immutable event/receipt/audit
                    |
       Today / Pipeline / Conversations / Health
```

If a proposed implementation cannot fit this flow, stop and update the
architecture card before adding an exception.

## Layer boundaries

| Layer | Owns | Must not own |
|---|---|---|
| Entrypoints | Authentication, payload parsing, validation, response mapping | Pipeline rules, identity merging, sending logic, provider health truth |
| Domain services | Invariants, transitions, deduplication, canonical writes | Rendering, route-specific response shapes, raw client credentials |
| Execution | Claims, retries, terminal status, run summaries | Assuming a request or provider acknowledgement equals success |
| Data ledgers | Canonical records, immutable events, receipts, provenance | Hidden derived state or destructive reconciliation |
| Intelligence | Bounded context, registered tools, proposals, explanations | Raw database access, unregistered tools, direct external action |
| Operator surfaces | Prioritization, review, confirmation, recovery | A second copy of business logic or analytics formulas |

## Canonical data ownership

| Concern | Canonical data | Authoritative writer | Required evidence |
|---|---|---|---|
| Person identity | `contacts`, alternate emails, source provenance | `identity.ts` | Match precedence, ambiguity result, source IDs |
| Business identity | `companies`, domain, research, qualification | `identity.ts` | Domain/source evidence; never display-name-only merge |
| Revenue state | `opportunities`, `stage_events` | `pipeline.ts` | Valid transition, actor, source, reason, one stage event |
| Work commitments | `tasks` | `tasks.ts` | Dedupe key, owner/context, due state, audit/activity |
| Communication | `conversations`, `messages` | `communications.ts`, `google.ts` | Provider/thread ID, direction, status, idempotency key |
| Operational history | `activities` | Domain service that caused the event | Stable external/source ID and canonical links |
| Human/AI decisions | `action_queue` | `actions.ts`, `action-executor.ts` | Impact tier, approval, atomic claim, terminal result |
| Automation health | `job_runs`, `source_runs`, `webhook_receipts` | `runs.ts` and integration adapters | Start, terminal status, summary/error, cursor/replay key |
| AI trace and feedback | `agent_runs`, `agent_run_events` | `ai-agent.ts`, `agent-learning.ts` | Model/tool trace, bounded result, immutable rating |
| Revenue reporting | canonical opportunity/events plus first-party `website_events` | `analytics.ts` | Window, cohort rules, unknown attribution, reconciliation |
| Compatibility | Original source tables plus canonical linkage | `legacy-adapter.ts` | Source ID preservation and production parity before retirement |

Canonical IDs take precedence over normalized email. Email may assist resolution,
but ambiguous matches fail into review. Compatibility tables are sources and
projections during migration, not permission to add permanent dual-write logic.

## Universal mutation contract

Every material write answers these questions in code and tests:

1. **Actor:** Who or what requested it, and are they authorized?
2. **Input:** Is the payload bounded, normalized, and schema-valid?
3. **Identity:** Which canonical records are affected, and is the match certain?
4. **Impact:** Read, internal write, external action, or destructive action?
5. **Confirmation:** Does this exact action require founder approval?
6. **Claim:** What deterministic key prevents concurrent/replayed execution?
7. **Service:** Which one domain service validates and performs the change?
8. **Receipt:** What record proves success, partial work, skip, or failure?
9. **Audit:** What actor, origin, before/after summary, and timestamp are retained?
10. **Surface:** Where can the founder inspect and recover it?

A mutation is incomplete when it changes state without a receipt, or records a
receipt without confirming the intended work actually happened.

## Automation contract

Scheduled jobs, campaign steps, synchronization, webhooks, and delayed follow-up
use the same execution pattern:

1. Authenticate the cron/webhook or validate provider signature and replay ID.
2. Claim a bounded unit of work atomically before any side effect.
3. Process oldest eligible work first unless a documented safety rule overrides.
4. Re-read stop conditions immediately before the side effect.
5. Execute through a domain service, never a provider call embedded in a route.
6. Persist provider/canonical receipts and advance cursors only for completed work.
7. Finish `success`, `partial`, `skipped`, or `failed` with an honest summary.
8. Expose backlog, last success/failure, and safe recovery in Setup/Health.

Retries reuse the logical idempotency key. An uncertain provider outcome is not a
safe retry until receipt reconciliation establishes whether the side effect
occurred. Stale claims need a bounded, audited recovery policy.

## Intelligence contract

`ai-tools.ts` is the only AI tool registry. Every tool declares a stable name,
bounded JSON schema, impact tier, confirmation requirement, and executor.

- **Read:** may execute directly against bounded live records.
- **Internal write:** proposes an `action_queue` item unless a policy explicitly
  permits the exact deterministic operation.
- **External action:** always shows exact recipient/record/content/timing and
  requires founder confirmation unless it is inside an approved policy version
  (see below).
- **Destructive:** fail closed until a specific reviewed tool and recovery policy
  exist.

Tool schemas and impact tiers are enforced at dispatch, not advertised and
ignored. A tool call is validated against its declared schema before the executor
runs; a `read` tool that stages an action, and a mutating tool that does not, are
both refused.

### Approved policy versions

An external action may run without per-instance confirmation only from inside an
**approved policy version**: a versioned, founder-signed record that fixes the
trigger, the envelope, the guardrails, the message template, and the model. This
generalises the rule campaigns already follow, where `activateCampaign` suspends
sending whenever `version` moves past `approved_version`. The founder approves a
policy once, not a message at a time, and any material edit bumps the version and
suspends the policy until it is re-approved.

A policy version is only a legitimate substitute for confirmation when all of the
following hold:

1. **Bounded trigger.** A named event, not a model's judgement that it is time.
2. **Bounded envelope.** Explicit per-run, per-day, and per-contact caps; an
   allowed time window; and an eligibility rule that names who is excluded.
3. **Re-read stop conditions immediately before the side effect**, matching the
   automation contract. Suppression, an existing client, and a human who has
   already replied all stop it.
4. **One kill switch**, checked at execution rather than at scheduling, that
   halts sending mid-flight.
5. **Grounded content.** The message is generated only from the inbound text and
   the canonical record. No invented pricing, availability, dates, commitments,
   or capabilities.
6. **A recorded decision either way.** Declining to act is written down with its
   reason, exactly like acting. A policy that only records what it did cannot be
   audited for what it wrongly skipped.

Anything outside the approved envelope falls back to `action_queue` and founder
confirmation. It never widens itself, and the model never edits the policy.

Approved actions execute through `action-executor.ts`, which calls the same
pipeline, task, communication, Google, or campaign service as the UI. Tool runs
record inputs/results with sensitive content bounded or redacted. The model never
receives service credentials or an uncontrolled database dump.

Learning is governed telemetry, not autonomous prompt mutation. Founder feedback
is immutable and promoted only as bounded aggregate quality signals. Raw prompts,
outputs, documents, messages, or free-form feedback never become system
instructions automatically.

## Read-model and UI contract

Today, navigation counters, notifications, and AI ranking consume the shared
priority selector. Pipeline stages use the shared transition service. Analytics
uses the shared canonical analytics service. Specialized source tools use the
compatibility adapter until reconciliation proves retirement is safe.

An operator surface must expose loading, empty, degraded, error, retry, and
success states. Unknown configuration or missing evidence is not “healthy.”
Responsive behavior is native, not a desktop table hidden behind horizontal page
overflow.

## Failure semantics

| State | Meaning | Required operator behavior |
|---|---|---|
| `success` | Intended bounded work completed with evidence | Show receipt and next expected work |
| `partial` | Some intended work completed; bounded remainder exists | Show completed/deferred counts and recovery |
| `skipped` | Work was safely unnecessary or stopped by policy | Show the reason and stop rule |
| `failed` | Intended work did not complete | Preserve input/claim, safe error, and retry/reconcile path |
| `degraded` | Capability works incompletely or evidence is stale | Keep unaffected paths available; identify missing capability |
| `not_configured` | Optional/required dependency is absent | Explain accomplishment, exact setup, and whether flow is blocked |

Never translate an exception into HTTP 200 plus a healthy status. Never expose
secret values, provider tokens, or raw internal stack details in recovery UI.

## Adding or changing a capability

Use this order:

1. Identify the canonical entity, event, and authoritative service.
2. Add an additive idempotent migration only if the current schema cannot express
   the invariant or receipt.
3. Implement or extend the domain service with explicit input/output types.
4. Add audit/activity/run receipts and deterministic keys.
5. Expose the service through API/UI/cron/webhook adapters.
6. Register an AI tool only when the normal service path is complete; declare
   impact and confirmation explicitly.
7. Add happy, invalid, duplicate/replay, concurrency/provider-failure, and safe
   retry coverage proportional to impact.
8. Add responsive Playwright and screenshot review for operator-facing changes.
9. Update Setup/Health when activation, freshness, or recovery changes.
10. Attach commands and evidence to the Feature Board card.

Do not add a second sender, identity resolver, pipeline updater, priority formula,
analytics formula, AI execution path, or job ledger.

## Verification matrix

| Change type | Minimum verification |
|---|---|
| Pure read/service | Typecheck, lint, deterministic service test, missing-schema/error path |
| Internal mutation | Above plus authorization, validation, before/after audit, duplicate/concurrency path |
| External action | Above plus confirmation, idempotency, provider failure, uncertain outcome, receipt reconciliation |
| Cron/webhook/sync | Above plus auth/signature, replay, cursor/backlog, partial/failed terminal state |
| AI tool | Registry/schema/impact tests, unknown-tool failure, bounded context, confirmation/executor parity |
| Analytics | Window/cohort fixtures, unknown attribution, cross-screen reconciliation |
| UI/interaction | Desktop/mobile Playwright, keyboard/focus, reduced motion, screenshots opened and reviewed |
| Migration | Ordered/idempotent dry verification, schema readiness, compatibility and rollback/recovery notes |

The Feature Board may legitimately show missing tests as remaining work. An agent
must not silently treat a planned test as passing evidence.

## Change authority and escalation

A card authorizes only its described outcome and normal implementation steps.
Stop and create or update a dependent card when work requires a new provider,
broader recipient/audience, destructive migration, weakened authorization,
unreviewed automation volume, or a different canonical owner. Never infer those
permissions from “finish,” “holistic,” or “agentic.”
