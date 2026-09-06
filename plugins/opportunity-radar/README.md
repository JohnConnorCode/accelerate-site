# Opportunity Radar

Configure a reusable business profile for evidence-backed earned-growth work.
**Available now: validated profile, two presets, CLI setup and governed AI
configuration, bounded source briefing, model charge receipts and a versioned
evidence store and reviewed business selection operated through AI approvals.** Automated discovery, relationship intelligence, outreach,
publication and outcome measurement remain unfinished. Enabling this foundation
does not start a background worker.

## Set up your business

From the application root with dependencies installed:

```sh
npm run radar:setup -- --preset superdebate
npm run radar:setup -- --preset service-business
npm run radar:setup -- --profile /absolute/path/public-profile.json
```

Each command returns a reviewable configuration packet without a database,
provider or model request. The service-business preset is a fictional unrelated
business; both presets use the same schema. Use your own organization, HTTPS
website, mission, expertise and audiences before activation. The full
[field and command reference](../../docs/plugins/OPPORTUNITY-RADAR.md) explains
optional settings and merging a preset with your file.

In **Integrations**, use the module settings for **Opportunity Radar**, or ask
Command Center AI to read its current configuration, preview the packet's exact
settings and propose the change. Approve the settings first, then separately
preview/propose and approve enablement. Missing required profile fields prevent
enabling. Public settings must contain no credentials, private relationship
history or customer messages. AI uses the same module services and approval
executor as manual configuration; a proposal does not save itself.

## Costs and current limits

Default model mode is `off`, with zero model calls and zero spend budget.
Choose `free-only` or `budgeted-low-cost`, an evaluated model ID and a positive
call limit before briefing. Free-only requires current zero pricing, including
request charges. Paid mode also requires positive run and daily dollar caps.
No default model, premium fallback, streaming or automatic inference retry is
allowed. Unknown pricing or incompatible structured output defers the request.

OpenRouter is the supported transport. A workspace maintainer registers model
capabilities and an evaluation outcome through the existing shared
[`registerModel` / `setModelEvalStatus` services](../../src/lib/ai/model-registry.ts).
There is no model-registration screen or bundled live evaluation in this release;
registration must reflect an actual reviewed evaluation, never a guessed pass.
Ask AI to run `get_radar_model_status` to list registered options and their
readiness. Local/open-weight transport is unavailable. Free-model availability
and limits vary; hosting and compute still cost money.

After saving the profile and enabling Radar, a controlled example is:

> Prepare a Radar brief for this supplied source. Use operation ID
> `b5b3457c-2c8d-47e4-9f39-2f59d17ed1bd`, source ID `workshop`, URL
> `https://example.test/workshop`, and text “Fictional Field Service Studio will
> host a maintenance workshop next month.” Do not publish or contact anyone.

`prepare_radar_brief` returns up to five observations with supplied source IDs,
unknowns and a model receipt. Supplied text remains unverified; the URL is a
reference and is not fetched. Review the draft before using it. With default
off settings, the expected result is **deferred**, with no Radar provider call.
AI chat itself uses its usual workspace model and has separate charges.

The host reserves worst-case run/day dollars and an admitted-call slot atomically
with shared runtime budgets before inference. The UTC daily cap includes failed
and cancelled admissions. Input uses a conservative UTF-8 byte bound plus framing;
large source packets defer instead of being silently truncated. Completed results
can be reused within the current UTC day when tenant, sources, profile, prompt,
model registration, pricing and limits match. Retry the same operation ID;
changing an admitted operation’s inputs is a conflict, not permission to execute again.

Receipts show reserved and actual dollars separately. Reservations are never
refunded automatically, even for known zero-charge pre-dispatch failures. This
can leave usable provider credit above the remaining application quota. Unknown
cost holds further calls. Documented pre-inference 4xx rejections record zero
provider cost. A 429 honors `Retry-After` (bounded to one day; 60 seconds when
absent) without automatic retry. After cooldown, a new admitted operation still
consumes quota. Timeouts and mid-generation errors remain uncertain. A charge above the admitted ceiling discards output and
records the overrun in shared usage; provider misbilling cannot be prevented by
an application quota. No paid search, PR database or provider call is part of the
fixture tests.

## Disable and recover

Disable through the same module controls or an approved AI proposal. Settings
and audit history remain. In-flight completion rechecks the configuration and
discards a result if it changed. There are no Radar background jobs to cancel yet.
For invalid input, correct the field reported by validation. For a stale proposal,
read current configuration and prepare a new one; do not reuse its digest.
Do not retry enablement until required profile fields are ready. Capability
readiness explicitly reports discovery, sending and publication as unavailable.

For an uncertain receipt, run `reconcile_radar_model_call` with its receipt ID.
It checks the stored generation's final provider usage without repeating inference.
Missing generation ID, unavailable metadata or mismatched identity keeps the hold;
inspect the provider's account record rather than blindly retrying. Reconciled
output stays discarded. After disablement, keep model mode off and re-enable the
module to access its AI receipt/reconciliation tools. No new inference is allowed
in off mode. PostgreSQL migrations must be applied by the installation's normal
migration runner; missing receipt storage fails closed.

Run `npm run test:radar-model`, `npm run test:openrouter-resilience`,
`npm run test:runtime-postgres`, `npm run test:radar-profile` and `npm run test:ai-module-controls` for both
presets, input refusal, tenant isolation, approval, disable, replay and stale
revision fixtures. They do not prove discovery or a full Radar business journey.
The [architecture and live card index](../../docs/plugins/OPPORTUNITY-RADAR.md)
tracks the remaining program; the [documentation contract](../../docs/contracts/PLUGIN-DOCUMENTATION.md)
defines the flagship release proof.

## Extend

The [profile contract](../../src/lib/revenue-os/radar-profile-contract.ts) owns
validation and settings metadata. The [manifest](../../extensions/opportunity-radar.module.json)
is generated from the reviewed settings contract. Presets provide public business
configuration, never authority to fetch a URL or evidence that a claim is true.
Run `npm run build:extensions`, `npm run verify:extensions` and the profile tests
after changes. Build new stages on shared WorkItems, canonical records, budgets,
model transport and approvals; do not create a private CRM or provider gateway.

The shared [`budgeted-model.ts`](../../src/lib/ai/budgeted-model.ts) owns cost
admission, bounded execution, cache identity and reconciliation.
[`radar-model.ts`](../../src/lib/revenue-os/radar-model.ts) supplies a versioned
neutral prompt, strict output parser and source-ID validation. Add future jobs
through that boundary with their own version, bounded schema and evidence rules.
New provider transports must implement equivalent admission and usage guarantees
in the shared adapter before becoming selectable. The
[reservation migration](../../migrations/20260908-model-call-reservations.sql)
keeps tenant receipts, append-only settlement history and shared budget accounting.

## Keep evidence and reviewed opportunities

Apply the normal migration catalog for your own installation before using the
store. There is no source worker or dedicated Radar page yet. In Command Center
AI, use `get_radar_store`, `preview_radar_store_change` and
`propose_radar_store_change`. The existing **Today** approval queue shows the exact
saved preview; only its approved executor applies a business change.

For a fictional maintenance business, ask AI:

> Preview importing this supplied source into Radar. Use a new operation ID,
> URL `https://example.test/workshop`, title “Fictional maintenance workshop”,
> and text “Fictional Field Service Studio announced a maintenance workshop.”
> Show the preview, then propose it for my approval. Do not fetch the URL.

Approve the proposed import. Its receipt returns the source-version ID and
`discovery_id`. The source starts **supplied**, which means its external contents
have not been verified. Read the receipt using its original `operationId`, or
read the saved text using `sourceVersionId`. Text reads return 2,000 Unicode
characters and `nextOffset`; request the next offset for the rest.

Ask AI to create a `partnership` opportunity with that source-version citation,
an observation, a title, summary and recommended action. Optional person/company
references must be actual IDs in your workspace. If you already have evidence in
the shared claim ledger, a citation can reference its existing `evidenceId`.
Importing a source does not manufacture a verified claim or a new CRM person.
Custom business kinds are supported as lowercase identifiers.

An opportunity begins `draft` in the neutral review lane. Move it to
`needs_review`, compare each supplied source with the real original, and propose
a source verification with your reason and its current revision. Only after every
current citation is verified can the opportunity advance to `approved`, then
`in_progress`. This approves work on the opportunity; it never approves sending,
publication, commitments or independent recognition. The current store does no
ranking, including for business material.

You can propose a source-linked draft asset or record a reported outcome on the
opportunity. Drafts remain `draft`; outcomes remain `reported`. Read an asset by
`assetId` with the same bounded text pagination. Outcome verification and metrics
belong to the unfinished outcome-measurement stage.

Every mutation needs a stable operation ID. Reusing it returns its committed
receipt; changing its input is a conflict. New content at the same normalized URL
creates a new source version, while identical content and metadata reuse the
existing version. URL fragments are dropped; query identity and order are kept.
No imported URL is fetched. An import cannot overwrite prior source contents.

If a source is wrong, propose retracting it with a reason. Replace the opportunity's
entire citation set through `replace_citations` using the latest opportunity
revision. Old citation sets and draft references remain readable history; the
opportunity returns to `needs_review`. Terminal completed/dismissed/declined
opportunities retain their core fields. A new follow-up opportunity is preferable
to rewriting that history. `no_response` can return to review.

Stale revisions, changed source reviews/configuration, foreign IDs and incomplete
citations require a fresh read and preview. A failed database transaction leaves
no partial source, opportunity, receipt or audit entry. A committed operation can
be found by operation ID even if the caller lost its response. Disablement blocks
new execution; records remain. To use module-owned AI reads after disablement,
keep model mode off and re-enable the module. No provider request is needed for
these storage operations.

The first approved store operation installs four missing bounded entity-type
declarations using the shared registry. Existing disabled/conflicting declarations
refuse execution. These setup declarations may remain when a later store operation
fails; they contain no source content or business result. No automatic read-policy
grant, merge/delete capability or parallel CRM is installed.

Developer ownership: [store contract](../../src/lib/revenue-os/radar-store-contract.ts),
[shared service](../../src/lib/revenue-os/radar-store.ts) and
[transaction migration](../../migrations/20260909-radar-evidence-store.sql).
Source/CRM/evidence links are tenant-composite. Content, citation versions, assets,
reported outcomes and receipts retain history. New operations extend the strict
contract and the existing action executor; do not add a second approval engine.
Run `npm run test:radar-store` for governed service fixtures. The normal
`npm run test:migration-ledger` native PostgreSQL proof includes source versioning,
concurrent replay, stale/foreign references, lifecycle gates and forced audit
failure rollback. Both business presets use these same services. These tests do
not certify the unfinished daily Radar UI, discovery or outreach journey.

## Choose business opportunities with reviewed estimates

After saving an opportunity and reviewing its sources, ask the admin AI to prepare
an assessment with `preview_radar_assessment`. Supply the opportunity ID and
current revision, a stable operation ID, an expiry within 30 days, a topic key,
effort from 1–5, time-to-value, one next action and up to three alternatives.
Classify the subject explicitly as ordinary business, public affairs or unknown.
AI suggestions cannot approve that classification.

Give each of the seven factors a 0–100 estimate or `null` for unknown, a short
rationale, low/medium/high confidence and the source-version IDs supporting it.
The factors are relevance, authority, timeliness, reachability, recognition,
differentiation and compounding value. They describe your judgment; an 80 is
neither an 80% chance of success nor verified recognition. A missing estimate
produces no score. Zero is a known estimate, not a substitute for missing evidence.

For example, a fictional equipment supplier's workshop could receive seven
operator estimates of 80, medium confidence and citations to its reviewed workshop
announcement. Its weighted score is 80. Give it effort 2, a one-week time-to-value,
a topic key such as `equipment-training`, and an action to discuss the workshop
format. Review the full preview, then use `propose_radar_assessment` with the same
inputs and digest. Approve the exact judgment packet in **Today**. Nothing is
saved to the assessment history before that approval.

`get_radar_selection` reads up to 50 recently updated, nonterminal opportunities.
It returns a business shortlist, a separate unranked review list and explicit
reasons for deferring items. A truncation flag means this is a bounded candidate
window, not a claim to have compared every historical opportunity. The profile's
**Daily shortlist limit** controls the result count. The request can also set
`maxTotalEffort` from 1–50 (default 10) and seven weights totaling 100. Defaults are
20/15/15/15/15/10/10 in the factor order above; the response repeats the weights.
These request overrides are not saved profile settings.

Selection priority applies a time-to-value multiplier, a seven-day half-life and
an effort adjustment to the weighted score. The response exposes the formula,
contributions and decay. It selects at most one item per topic key and stays
inside the effort allowance. Effort units are an operator scale, not minutes.
The algorithm makes no model or provider calls.

Public-affairs and unknown subjects remain unranked. A conservative text check
also refuses recognizable public-affairs signals in a proposed business
assessment; it is not a comprehensive language classifier or permission to skip
human review. Business classification requires verified source versions. An
opportunity edit, changed source review, missing citation or expired assessment
requires reassessment before ranked selection. A newer approved assessment
supersedes the current judgment while preserving every previous assessment.
Concurrent or stale proposals cannot silently overwrite the latest judgment.

Disable the plugin to stop new assessments and selection; retained operation
replay can still return the original receipt without another write. Apply the
normal migration catalog to add assessment storage and tenant-filtered current
views. No migration runs from a tool or request.

Developers can extend the pure selection contract in
[`radar-ranking-contract.ts`](../../src/lib/revenue-os/radar-ranking-contract.ts)
and the shared approval/read service in
[`radar-ranking.ts`](../../src/lib/revenue-os/radar-ranking.ts). Keep estimates
separate from claims, retain source/configuration freshness and prove new
selection rules in `npm run test:radar-ranking`. The native PostgreSQL proof is
part of the existing migration suite. The dedicated Radar dashboard, discovery,
relationship intelligence and execution journeys are still separate unfinished
work; this selection tool does not send outreach or publish content.
