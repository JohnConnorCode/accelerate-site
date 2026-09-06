# Opportunity Radar

A general-purpose earned-growth business plugin, with an optional SuperDebate
preset. Its intended loop is **Discover → Understand → Develop → Review → Act →
Measure → Learn**. It should find timely ways a business can contribute something
useful and earn independently observable recognition. It must not optimize for
bulk content, unsolicited message volume, manufactured credentials or impressions.

## Current implementation and release boundary

The profile foundation supplies a disabled module, generated settings fields,
validated public configuration, two presets, a local setup packet generator and
the existing governed AI configuration flow. Bounded source briefing uses shared
model reservations, charge receipts and provider-usage reconciliation. The evidence
store adds versioned supplied sources, discoveries, growth opportunities, canonical
evidence/CRM references, draft assets and reported outcomes through approved AI
commands. There is no daily Radar feed, source worker, ranking engine, sender,
publisher, graph collector or measurement service yet. Enabling this foundation does not start any of those activities.

The complete program is on the live Feature Board under
`opportunity-radar-program` (`ec0f7890-1b26-4fce-bd99-0c7772e9a728`). The board owns
claims, dependencies, acceptance and delivery. This document is the architecture
contract, not a substitute status tracker. Do not advertise the full plugin as
available based on a configured profile or passing setup tests.

## Business configuration and AI setup

All businesses supply their own public organization name, website, optional
spokesperson, mission/offer, earned expertise, business audiences, topics, public
assets, region and IANA time zone. An organization can operate without promoting
a named founder. Private contacts, conversations, relationships and credentials
belong in canonical CRM/connection stores, never public module settings.

```sh
npm run radar:setup -- --preset superdebate
npm run radar:setup -- --preset service-business
npm run radar:setup -- --profile /absolute/path/my-public-business-profile.json
npm run radar:setup -- --preset superdebate --profile /absolute/path/overrides.json
```

Without a preset or file, the command returns neutral defaults and missing fields.
It prints a reviewable packet; it never changes the workspace, calls a model,
fetches a website, spends money, sends a message or enables a worker. The repair
business preset is explicitly fictional. SuperDebate is an editable starting
point, not a list of verified accomplishments or relationships.

A custom JSON profile uses these public fields (omitted values receive defaults):

```json
{
  "organization": "Your business",
  "website": "https://your-business.example",
  "spokesperson": "",
  "mission": "What you do and the useful contribution you can make",
  "expertise": "Experience you can substantiate",
  "audiences": "The business customers and professional communities you serve",
  "topics": "Your business topics",
  "ownedAssets": "Public URLs or descriptions, one per line",
  "region": "",
  "timeZone": "UTC",
  "dailyShortlist": 5,
  "maxDiscoveries": 50,
  "dailyModelBudgetUsd": 0,
  "sourceMode": "free-first",
  "outreachMode": "draft-only"
}
```

In the Command Center AI, request:

> Configure Opportunity Radar for my business using the public profile below.
> Read its current module configuration first, preview the exact settings and
> ask me to approve them. Once applied, prepare a separate enablement approval.
> Do not start discovery, spend money, publish or send outreach.

The shared tools are `get_module_configuration`, `preview_module_configuration`
and `propose_module_configuration`. Filter reads to `moduleId: opportunity-radar`.
Use the packet's `change` for settings; preserve the exact returned digest when
proposing. After approval applies settings, preview/propose `enableChange`.
The existing action queue performs the write and checks current admin authority,
workspace, revision and approval. The same module settings form provides the
manual path. Required identity/mission/expertise/audience fields must be filled
before enabling. Turning a module off preserves its settings and audit receipts.

`radar-profile-contract.ts` owns validation and field definitions.
`plugin-settings-contract.ts` resolves reviewed settings contracts. Generation
writes the declared form fields into the manifest; `verify:extensions` rejects
drift. Both manual settings writes and AI proposals use the same full validator.
Unknown fields, invalid time zones, credential-bearing/non-HTTPS website URLs,
fractional item limits, excessive limits and unsupported sending/source modes fail.
A website setting is data, not permission to fetch a URL; fetch safety belongs to
the future ingestion adapter.

## Cost and model options

The verified transport currently uses OpenRouter through the shared gateway and
operator model registry. Radar must not hardcode a premium model or create a
second provider client. The profile offers **off**, **free-only** and
**budgeted-low-cost** preferences, an explicit registered model ID, independent
call/token caps and per-run/daily USD limits. Defaults are off, zero calls and
zero permitted model spending. Source briefing enforces these settings through the shared budgeted gateway.
The [operator guide](../../plugins/opportunity-radar/README.md) covers a worked
example, model registration limitations, conservative accounting and recovery.

Free-only permits only a currently verified zero-cost compatible model. A model
ID suffix alone is not pricing evidence. No available free model means defer,
not fallback to a paid model. Budgeted mode permits evaluated free/low-cost models
only after explicit model/budget selection. Reserve worst-case cost before each
call, account for retries, reconcile actual usage and pause if price/usage is
unknown. Never silently use the gateway's default or upgrade to a premium model.
Keep the maximum configured run cost within the daily budget.

Use deterministic filtering/deduplication/caching first and model calls only for
a small worthwhile shortlist. Avoid paid news/search/PR databases. Future public-feed and manual-import adapters must remain useful with model mode off. Explain source/model usage
and defer reason in each receipt. Local open-weight inference is a planned
**shared provider adapter**, not currently supported by this plugin; its token,
latency and resource limits still matter even without a per-token bill.

OpenRouter documents free variants and a free router, but availability and rate
limits vary; do not promise unrestricted production capacity. Refer to its
[free-model documentation](https://openrouter.ai/docs/guides/routing/model-variants/free)
and [free-router documentation](https://openrouter.ai/docs/guides/routing/routers/free-router)
when validating a model. A random free router is not a replacement for this
platform's capability/evaluation checks or resolved-model receipts.

## General-purpose product and optional domain extensions

Core opportunity types are media contribution, appearance, participant/expert,
partnership, practitioner insight, search/citation resource, original research
and event/discussion. Each produces one concrete next action and useful
alternatives. A business may disable types that do not fit its offer.

SuperDebate can later add debate motions, opposing expert matching, pre/post-event
research packets, participant assets, a founder notebook and a debate index.
Those are templates and adapters over the same records and services. Do not bake
John, Chicago, debate language or SuperDebate's URL into core schemas, prompts,
scoring or permissions. A repair studio, professional association or software
business must work without changing core code.

The preset references the project's own public
[founder page](https://superdebate.org/founder),
[practice page](https://superdebate.org/coach),
[guide](https://superdebate.org/how-to-debate) and
[events](https://superdebate.org/events). These are owned assets, not independent
validation. The supplied event totals, chapter counts, audience-vote counts,
relationships and notability predictions are not stored as established facts.

## Runtime ownership

| Responsibility           | Existing owner / required integration                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| Workspace configuration  | Module registry, module-actions, module-configuration and shared settings form           |
| People and organizations | Canonical CRM and identity review; links from Radar records                              |
| Relationship context     | Existing conversations, interactions, activity and confirmed relationship records        |
| Work and scheduling      | WorkItems, leases, retries, budgets and durable events; no Radar cron-to-prompt engine   |
| AI                       | Configured shared gateway, tool registry, traces and bounded context                     |
| Internal decisions       | Domain services with explicit optimistic concurrency and immutable audit                 |
| Consequential actions    | Existing action_queue, current permission/freshness recheck and approved domain executor |
| External connections     | Existing encrypted broker and provider services; no raw credentials in plugin code       |
| Operator/demo UI         | Shared admin surfaces and the same service contract in controlled demo fixtures          |

The shared manifest/tool/policy foundations are verified, but general entity
read/write grants and durable event registration are unfinished. The discovery
card depends on the event bus; that bus depends on the unified executor. Release
conformance depends on the complete manifest contract. Do not work around these
prerequisites with a new job queue, sender or plugin host.

## Records and evidence contract for the storage card

Use additive tenant-composite records and foreign keys. Final migrations belong
to `radar-evidence-store` and require isolated PostgreSQL concurrency proof and
an explicitly verified migration target before connected acceptance.

- **Source:** tenant, connector/type, canonical URL, allowlist, permitted use,
  update frequency, health, last success, next retry and retention policy.
- **Discovery:** tenant/source, canonical URL and content/version hash, title,
  author/publication references, published/discovered/fetched times, permitted
  excerpt or storage pointer, extraction version and verification state.
- **EvidenceLink:** subject/claim, source/version, supporting excerpt/location,
  observation versus inference, authoring provenance, confidence/unknown state,
  verified/retracted/superseded status. A URL alone does not verify a claim.
- **Opportunity:** tenant, kind, trigger discovery, linked canonical records,
  objective, rationale, one next action, alternatives, effort, time-to-value,
  policy classification, state, revision, owner and linked WorkItem/action IDs.
- **Asset:** tenant/opportunity, version, content type, source links, draft,
  rights/quote review, destination-specific proposal and publication receipt.
- **Outcome:** opportunity/action/asset, observed result, external evidence,
  independent-versus-owned classification, timestamps and correction lineage.

Deduplicate by tenant plus source/canonical URL and content hash. Different
versions must not overwrite prior facts. Unique action effects also include
approved content/recipient and step identity. Separate draft estimates from
verified facts and operator judgments. Never create a second flat media CRM.

Opportunity states: draft → researched → needs_review → approved → in_progress →
observed outcome; dismissed/cancelled/failed remain explicit. Decisions carry
actor, reason, revision and timestamp. Dismissal is not evidence of failure;
no response is not a decline. Raw source text cannot instruct a model, grant
permissions, authorize sends or change a business profile.

## Discovery, development and daily selection

Start with manual source import and opted-in public RSS/URLs. Expand only through
available reviewed connectors. Workers must enforce DNS/private-network and
redirect checks, byte/type/time limits, conditional fetches, per-source rates,
robots/access restrictions, copyright/retention and bounded extraction. No
login-wall bypass or scraping private contact information. Show unavailable
connectors instead of pretending Reddit, social, Trends, Search Console or
academic sources are universally free and accessible.

Use deterministic dedupe, freshness and eligibility before a model. Default
limits are 50 discoveries and five daily recommendations, with zero automatic
model spending. Higher caps require reviewed settings and actual worker-side
budget reservation. Avoid an arbitrary 500-search daily launch requirement.
`DO_NOTHING` should be a normal successful result. Retain scan counts, exclusions,
failures and source health rather than manufacturing five recommendations.

For ordinary, verified nonpolitical business opportunities, the ranking card
can use the requested weighted components: relevance 20%, authority 15%,
timeliness 15%, reachability 15%, recognition potential 15%, differentiation 10%
and compounding value 10%. These are explained estimates, not probabilities or
facts. Show effort (1–5) and time-to-value separately. Unknown inputs must trigger
research/review instead of becoming zero. Avoid fame-only candidate selection.

Political/public-policy material and ambiguous classifications bypass growth
scoring and ranking. Preserve neutral factual summaries and source citations in
an unranked manual-review lane. Do not score politicians, public officials,
parties, campaigns, policies, legislation or ballot measures along any axis.
A model cannot clear its own item for scoring by labeling it a business topic.

Each intelligence packet needs trigger, summary, why now, business fit, sourced
people, relationship history, one recommended action, 2–3 alternatives, draft
materials, evidence and unresolved questions. Match verified existing contacts
and offered introductions before cold paths. Co-occurrence or co-authorship
alone does not establish a personal relationship or an introduction offer.

## Review, outreach and content

Drafts answer why this person, why now, what useful contribution is available,
mutual value and the exact ask. Inspect CRM history and suppression first. Do
not invent praise, quotations, titles, email addresses, statistics or someone's
position. A proposed invitation is not a booked participant or endorsement.

Bind an approval to recipient, channel, exact content, source versions, profile
revision and current relationship/suppression state. Before an external effect,
recheck enablement, tenant/admin authority, evidence freshness, recipient identity,
prior outreach, cooldown, opt-out and approved scope. Use the existing sender and
receipt protocol. Partial failure, cancellation and safe retry are distinct.
Sensitive emails, public statements, commitments and partnership terms remain
manual review. Setup authorization is never send or publication authorization.

Repurposing supports transcripts, interviews, events and source assets. Quotes
need traceable text/timecodes; inferred summaries are labeled. Clip candidates
are not rendered video. Track rights, permission, missing transcripts and
supported rendering integrations before promising output. Search pages require
source quality, non-duplication and meaningful added value. No bulk page flood.

Distribution plans name specific owned, participant, earned and community
channels with channel-appropriate drafts and separate approvals. A future
original-data report needs methodology, sample size, observation window,
limitations, correction policy and permitted source data. No invented index or
causal persuasion claims from a small self-selected sample.

## Outcomes and learning

Primary observations: independent coverage/citations, verified referring domains,
appearances, invitations, partnerships and participant referrals. Owned pages,
syndication, duplicate articles and paid placements must be distinguished.
Metrics such as search visibility require an actual connected measurement source
and time window; missing access is unknown, not zero. Followers/likes/impressions
are secondary context, not proof of notability.

Record dismissed, approved, contacted, responded, declined, booked, published,
covered, cited and no-response outcomes with evidence. Propose changes to future
business ranking based on observations and sample size; the owner approves rule
changes. Never silently grant autonomy, alter budgets or learn political rankings.
No system can guarantee notability, coverage, search position or a zero operating
bill. Free-first avoids paid-source activation; configured models and hosting can
still cost money.

## Surfaces, failure proof and release

Planned routes are `/admin/radar/today`, opportunity detail, people/media/topic
views, drafts/outreach, research and performance. Prefer views over shared CRM
records to redundant sub-app databases. The daily view must make source quality,
missing integrations, public-affairs review, effort, approval state and next action
legible. AI/MCP operations must use the same services as every control.

Release fixtures include SuperDebate and an unrelated business; duplicate sources,
contradictory/retracted claims, unreachable/opted-out contacts, stale approvals,
disabled plugins, provider failures, exhausted budgets and empty discovery days.
Test restart/retry/concurrent claims and tenant separation in PostgreSQL. Test
admin/demo parity, keyboard/focus, reduced motion, mobile/desktop and console
state, and inspect screenshots. Hosted connections and actual sends require
separate evidence/authorization; fixtures are not live provider proof.

Live implementation cards, recorded 2026-09-06:

| Key                               | Deliverable                                                              |
| --------------------------------- | ------------------------------------------------------------------------ |
| `radar-profile-foundation`        | Public profile, presets, generated validation and governed AI setup      |
| `radar-model-cost-controls`       | Enforced zero/free/low-cost routing, budgets and shared provider options |
| `radar-evidence-store`            | Durable discoveries, provenance, opportunities and outcomes              |
| `radar-discovery-workers`         | Bounded source adapters, WorkItems and source health                     |
| `radar-opportunity-ranking`       | Explained business selection and unranked public-affairs review          |
| `radar-relationship-intelligence` | Canonical identities, history and verified introduction paths            |
| `radar-today-workspace`           | Daily actions, intelligence packets and shared admin/demo UI             |
| `radar-reviewed-outreach`         | Useful drafts, approval, current relationship checks and receipts        |
| `radar-content-distribution`      | Evidence-based assets and reviewed destinations                          |
| `radar-recognition-outcomes`      | Verified recognition, methodology and reviewed learning                  |
| `radar-release-conformance`       | Repeatable fork/install and two-business end-to-end acceptance           |
