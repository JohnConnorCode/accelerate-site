# Approved AI module controls receipt

Verified application tree: `8fb6a6727d5b3f379edcbd70c3fe270d51865fc8`.
Implementation: `b312af0`; the follow-up fixes only test counter annotations.
Live child: `admin-ai-approved-module-controls`
(`35937ff8-6a21-469e-90a0-9e8e023c88dd`).

Three core-owned tools read declared module settings, preview exact changes and
stage one-hour pending proposals. AI and MCP share schemas, host module
validation and the existing action queue. Optional modules can be enabled,
disabled or configured; core toggles, unknown fields, invalid values and no-ops
refuse. The 48 KB read cap requests a focused module instead of silently dropping
settings. Stable-key digests bind tenant, target state and current module
definition. Public setting declarations are returned; arbitrary configuration
and credentials are not.

Human approval and the normal module form call the same fresh-admin writer and
canonical CAS update service. Expected target revision is checked before bundled
source registration and again on a CAS retry. Unrelated settings and other tenants
are preserved. Disabled plugins reject business execution while core management
remains available. Bundled read policies persist through disable and repeated
enablement. Their registration and the config save are separate, idempotent
operations; atomic rollback or automatic compensation is not claimed.

## Five local acceptance items

- AC1: Typed read/preview/proposal tools appear in all three AI packs and MCP;
  module contract passes with 30 modules and 56 registered tools (version v8).
- AC2: Controlled tests cover exact before/after digest, stable key ordering,
  malformed/unknown/core/no-op refusal, stale proposal/target revision, replay and
  dedupe. Both direct service and executor stale paths install zero policies.
- AC3: Real administrative Supabase transport is driven through a shared controlled
  fixture. Approved execution and direct form service update the same state using
  the shared current-admin authority and CAS, preserving unrelated config/tenant.
- AC4: Enable, disable, declared settings and bundled-policy installation pass;
  existing policies do not duplicate. Revoked membership, suspension, foreign
  tenant, tampering, host failure and autonomous attempts produce no config save.
  A stale caller configuration cannot bypass the disabled Collections domain gate.
- AC5: Full core suite, branding regression, AI operations, strict lint, corrected
  exact production build with TypeScript, module/runtime/agent/docs/index/statistics
  and inventory checks pass. Source inventory is refreshed. The first build caught
  a test counter inference error; only the subsequent successful build is evidence.

Logs: `/tmp/ai-module-controls-core.log`,
`/tmp/ai-module-controls-build-fixed.log`, `/tmp/ai-module-controls-browser.log`.
The existing `qa-demo-business-workflows.mjs` ran against the production build on
port 3036 at 1440/390 widths for all five business packs, with keyboard/reduced
motion, branding, invoice/workflow approvals, module toggles and reset checks.
It passed with no console errors or escaped API/provider requests. Demo business
operations remain session-local simulations on shared admin components; live AI
and hosted authorization are not represented as verified by that browser test.

The owned local server/browser are closed after verification. No Docker, schema
change, real send, hosted migration or deployment occurred. Review is transparent
founder-authorized agent self-review; merge delivery is recorded separately.
The configuration parent remains open for provider/sync controls and wider
permission/executor acceptance. Universal admin write coverage remains in progress.
