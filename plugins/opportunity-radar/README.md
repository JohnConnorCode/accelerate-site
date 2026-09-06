# Opportunity Radar

Configure a reusable business profile for evidence-backed earned-growth work.
**Available now: validated profile, two presets, CLI setup and governed AI
configuration.** Discovery, relationship intelligence, ranking, outreach,
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
Preferences also support `free-only` and `budgeted-low-cost`, explicit model
selection, request/token limits and per-run/daily dollar caps. These are validated
preferences for the future worker, **not implemented spend enforcement**.
The current profile/CLI makes no model calls. AI chat around setup uses the
workspace's existing model configuration and can incur its usual charges.

The verified shared transport is OpenRouter. Free model availability and limits
vary; there is no guaranteed unlimited free service. Multiple evaluated model
options and strict no-paid-fallback enforcement belong to the cost-controls
card. Local/open-weight provider transport is not implemented in this slice.
Hosting and local compute are costs even when a model's API price is zero.

## Disable and recover

Disable through the same module controls or an approved AI proposal. Settings
and audit history remain. There are no Radar background jobs to cancel yet.
For invalid input, correct the field reported by validation. For a stale proposal,
read current configuration and prepare a new one; do not reuse its digest.
Do not retry enablement until required profile fields are ready. Capability
readiness explicitly reports discovery, sending and publication as unavailable.

Run `npm run test:radar-profile` and `npm run test:ai-module-controls` for both
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
