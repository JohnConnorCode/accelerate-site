# Opportunity Radar

Configure a reusable business profile for evidence-backed earned-growth work.
**Available now: validated profile, two presets, CLI setup and governed AI
configuration, bounded source briefing and model charge receipts.** Discovery, relationship intelligence, ranking, outreach,
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
