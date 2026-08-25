# Revenue OS module map

The full architecture and invariants live in
`docs/REVENUE-OS-ENGINEERING-CONTRACT.md`. This directory is the authoritative
domain layer. API routes, pages, cron handlers, webhooks, and AI tools should call
these modules instead of recreating their rules.

| Module | Authoritative responsibility | Typical callers | Invariants / verification |
|---|---|---|---|
| `identity.ts` | Contact/company resolution and ambiguity refusal | Inbound, Google sync, Pipeline create | Canonical-ID precedence; exact primary/alternate email helper; never name-only merge; identity backlog/tests |
| `inbound.ts` | Canonical capture, attribution, activity, immediate task | Forms, chat, qualifier, manual Lead adapter | Idempotent source ID; confirmation failure cannot discard inquiry |
| `pipeline.ts` | Controlled stage transition | Pipeline API, AI executor, inbound, future calendar/proposals | Valid transition, loss reason, stage event, audit, optimistic concurrency |
| `tasks.ts` | Deduplicated operator commitments | Today APIs, inbound, AI executor, meeting/campaign workflows | Stable dedupe key; audit/activity; no duplicate open task |
| `activities.ts` | Normalized cross-channel activity receipts and bounded record timelines | Inbound, pipeline, tasks, communications, provider adapters, record details, AI tools | Stable `(source, external_id)` replay boundary; canonical links; deterministic occurred-at ordering; provider facts remain immutable |
| `records.ts` | Bounded opportunity cockpit read model | Opportunity record API/admin, future contextual AI reads | Curated fields only; canonical activity reader; linked work is bounded; no provider payloads, proposal bodies, attendee payloads, or secrets |
| `communications.ts` | Auditable Resend delivery | Campaigns, confirmed email actions, transactional adapters | Claim before send; provider ID/status; uncertain outcome is not blind retry |
| `google.ts` | OAuth, Gmail/Calendar/Drive sync, threaded Gmail send | Google routes, cron, confirmed actions | Encrypted tokens, exact attendee/contact association, cursor/provider IDs, folder bounds |
| `integration-registry.ts` / `integrations.ts` | Versioned provider capabilities and the evidence-backed integration catalog | Integrations API/admin, Setup, future AI availability gates and adapters | Configuration is never health; planned providers stay unavailable; scopes, freshness, failures, cost posture, and provider boundaries remain explicit |
| `scheduler.ts` | Deterministic cadence keys and redacted scheduled-job summaries | Supabase Cron wake-up adapter and future proactive jobs | Postgres owns cadence only; authenticated routes call services; `withJobRun` owns claims and receipts |
| `notes.ts` | Idempotent founder knowledge capture on the canonical activity ledger | Global admin note composer, future knowledge retrieval | No parallel note store; exact canonical attachment only; content stays out of duplicate audit payloads |
| `campaigns.ts` | Policy/version activation, pause, due execution | Campaign APIs, cron, action executor | Approved version only; JIT send; stop rules re-read before send |
| `campaign-stops.ts` | Canonical campaign eligibility stops and pre-send recheck | Unsubscribe, Resend webhooks, campaign executor | One reason/state mapping; pending memberships stopped before future sends; no route-local suppression writes |
| `actions.ts` | Proposed action lifecycle and claim | AI tools, action APIs | Expiry/dedupe, explicit approval, one claimant, immutable decision history |
| `action-executor.ts` | Dispatch approved action to normal services | Action API/worker | Registered action only; same UI service; terminal executed/failed result |
| `queue.ts` | Explainable operator priority | Today, overview, AI snapshot | Deterministic reasons/tie-break; no opaque AI deadline ranking |
| `analytics.ts` | Canonical funnel/revenue plus first-party context | Analytics APIs/pages, AI reads | Explicit window/cohort; unknown attribution visible; shared formulas |
| `runs.ts` | Atomic job claims and job/source terminal receipts | Cron, sync, health | One active logical job; idempotent replay returns its receipt; truthful success/partial/skipped/failed summary/error/cursor retained |
| `audit.ts` | Material actor/origin/before-after ledger | Every mutation service | No secrets/raw tokens; observable audit failure policy |
| `contact-imports.ts` | Ad hoc source analysis, review digests, approval, claims, and row receipts | Contact Import API/UI | OpenRouter proposes only; exact reviewed snapshot; deterministic identity; no opportunity/send side effects |
| `ai-tools.ts` | Versioned tool registry, schemas, impact tiers | `ai-agent.ts` | Unknown tools fail closed; writes/actions require policy confirmation |
| `ai-agent.ts` | Bounded model loop, deterministic tool-pack selection, streaming callbacks, and trace | Shared admin AI stream API | Registered tools only; bounded turns/context; run/event receipts; page context is server-curated |
| `ai-conversations.ts` | Founder-owned persistent AI threads and replay-safe messages | AI conversation and stream APIs | Actor isolation; bounded history; `(conversation_id, client_message_id)` replay boundary; no provider payload storage |
| `ai-stream-contract.ts` | Versioned browser-safe command event protocol | AI stream API, global panel, Today, AI workspace | Sanitized deltas/tool evidence/proposal notices only; no raw tool output or secrets |
| `agent-learning.ts` | Immutable rating and safe aggregate signals | AI feedback API/agent context | No raw feedback promotion; 90-day aggregate only |
| `legacy-adapter.ts` | Temporary source-to-canonical linkage | Specialized admin APIs | Preserve source IDs; safe degradation; retire only after reconciliation |
| `db.ts` / `types.ts` | Shared normalization, schema errors, contracts | All domain modules | No route-local stage or normalization variants |

## Choosing a module

- New person/business matching extends `identity.ts`.
- New import format or contact cleanup policy extends `contact-imports.ts`; approved identity writes still extend `identity.ts`.
- New pipeline movement extends `pipeline.ts`.
- New task source extends `tasks.ts`.
- New message channel extends the communication contract; do not send directly.
- New scheduled/integration work wraps execution with `runs.ts`; use one stable
  job key and a deterministic claim/replay key whenever the invocation itself
  may repeat. Do not hand-roll cron locks in a route.
- New AI capability first needs a normal domain service, then a registered tool.
- Every admin AI surface uses the shared stream API and conversation service; do
  not create route-local chats, model loops, or transcript stores.
- All model traffic uses `src/lib/ai/openrouter.ts`; do not add a route-local provider SDK.
- New metric extends `analytics.ts`; screens do not calculate competing funnels.
- New compatibility read extends `legacy-adapter.ts` and names its retirement
  reconciliation card.

Tests do not yet cover every invariant above. The Feature Board cards
`revenue-os-tests`, `api-contract-tests`, and the scoped Playwright cards are the
source of truth for those gaps. Do not describe planned coverage as passing.
