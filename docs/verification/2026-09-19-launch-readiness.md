# September 19 launch-readiness audit and implementation

## Scope and release state

Reviewed published main `8baccd279ef2cd5f2bd21b2e401f6f9924642902`, the September
15–19 changes, and their immediately preceding plugin/editor dependencies.
The recent published changes cover Activity, Revenue, first-result onboarding,
Site Studio defaults and workspace appearances. Related checks include Forms,
AI page authoring, Stripe invoicing/subscriptions, Postiz social publishing,
client onboarding, meeting commitments, reports and the shared plugin runtime.
The approved Command Center copy changes from PR 114 are integrated into this
isolated candidate. Other feature branches and worktrees remain untouched.

This is source-level implementation and controlled verification, not a deployed
release. No production migration, OAuth setting, provider connection or customer
record was changed. Local acceptance does not establish live ChatGPT compatibility,
provider delivery, or complete universal admin/AI parity.

## Corrected defects and integration gaps

| Area                 | Finding                                                                       | Implementation                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Forms review         | Strict parsing rejected the adapter's `action` field                          | One strict review envelope, stable request keys and focused regression                                                                 |
| Public submission    | Definition validation, retries and notification creation could diverge        | Schema-aware validation and one transaction for submission, command receipt and notification; exact replay and conflicting-key refusal |
| Form editing         | Stale writers could overwrite a newer definition                              | Host-only definition commands with expected timestamps and atomic audit                                                                |
| Accepted intake      | A reviewed response could be reported as delivered despite downstream failure | Transactional review and durable intake action; existing canonical ingest/executor, visible pending/failed status and governed retry   |
| Site Studio defaults | Omitted module settings disagreed between boundaries                          | Shared enabled-by-default behavior in application and SQL; explicit disable remains effective                                          |
| Editor MCP           | No scoped authenticated path for complete installation website commands       | Five typed tools over existing website commands, exact preview, durable proposal, optimistic versions and atomic receipts              |
| Authorization        | Ordinary credentials must not acquire owner write authority                   | Separate native OAuth endpoint, explicit 30-day owner delegation, restricted token role and live grant/session/membership checks       |
| History              | Fixed revision/receipt windows could hide valid old rollback targets          | Bounded pagination, historical reads and targeted publication verification                                                             |
| AI generation        | UI-only rate limits could be bypassed by a new adapter                        | Existing owner rate limit moved into the shared suggestion service; budget and price controls retained                                 |
| Neutral export       | Copied content types disagreed with the neutral replacement                   | Shared content contract, explicit inclusion-manifest entry and compatible neutral content                                              |
| Stripe conformance   | A manufactured fixture did not verify the actual adapter contract             | Runtime-owned metadata and controlled tests of actual transport, credentials, bounds and error handling                                |
| Release wiring       | New commands require explicit clean-install registration                      | Five additive migrations, ordered catalog entries, schema signatures, CI regressions and refreshed inventories                         |
| Public documentation | Form demo and MCP descriptions overstated or omitted capabilities             | Actual boundaries, setup, recovery and release gates documented                                                                        |

## Shared styling review

The interface-polish review reused the existing design system. It did not add a
parallel stylesheet, component framework or dependency.

### Tokens and control geometry

| Before                                                                                     | After                                                                                                                      |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `SurveyRunner.tsx` used vendor-default surfaces and controls                               | SurveyJS theme variables resolve to shared admin/public colors, typography, radius, density, border and shadow tokens      |
| Public form status/error treatments depended on admin-only variables and a raw error color | `PublicFormView.tsx` uses public site radius, rule, muted and error tokens with established fallbacks                      |
| Public form caption and renderer accents lacked consistent semantic foregrounds            | Public form page and `website-theme.ts` share muted and contrast-derived on-accent tokens with the public/preview renderer |

### Existing primitives and truthful interaction

| Before                                                                                                    | After                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No visible owner connection consent/revocation surface                                                    | `SiteEditorConnections.tsx` uses `AdminSurface` and shared control classes; the Site Studio entry page links to it                                                            |
| Form review could imply downstream success immediately                                                    | `FormsWorkspace.tsx` distinguishes review from intake execution and exposes the existing governed retry path                                                                  |
| Failed public submission could clear or complete the questionnaire                                        | `SurveyRunner.tsx` waits for completion, blocks duplicate submissions and retains answers on failure                                                                          |
| Pending copy integration used inconsistent muted text and nonsemantic feature rows                        | The approved PR 114 copy/contrast changes use shared colors and semantic list structure                                                                                       |
| Selected secondary buttons reverted to a pale background on hover while retaining the selected foreground | `admin-components.css` excludes pressed buttons from secondary/ghost hover overrides; primary hover retains the contrast-validated color pair and shared shadow/lift feedback |

## Verification ledger

Local and controlled tests completed during this implementation:

- Form schema/review tests, verified host-actor bridge, intake recovery statuses.
- Isolated native PostgreSQL: submission/review replay, concurrent calls, stale
  definition, payload/key/tenant binding, exactly one notification, audit failure
  rollback, disabled module and suspended tenant refusal.
- Typed editor transforms, deterministic previews, schema/import/path validation,
  theme contrast, restricted discovery, annotations and forged/legacy delegation refusal.
- Real Supabase SDK verification of locally signed ES256 JWTs, with controlled
  transport for issuer/audience/client/expiry, owner and live revocation checks.
- Isolated native PostgreSQL delegated save/publish/unpublish/rollback, concurrent
  replay, exact proposal binding, expiry/revocation, policy prohibition, restricted
  token privileges and atomic audit rollback. Receipts do not fabricate per-call
  human approval.
- Full business migration upgrade/replay on PostgreSQL 17, including retained
  tenant data and existing Radar, proposal, Site Studio, website, campaign,
  onboarding and contact transaction suites. PostgreSQL 14 refused the existing
  `security_invoker` view option; rerunning with the installed supported server
  passed. Supabase-only extension provisioning is not exercised by this fixture.
- Plugin/runtime core checks passed in bounded segments after repairing registry
  version, guarded-tool expectations and generated permission-reference drift.
  Additional Stripe, Postiz, subscriptions and first-value checks use controlled
  transport/fictional data, not live provider accounts.
- Shared admin tokens: 95 tokens across eight appearances; extension, module and
  route guards; source/AI route inventories and their negative regressions.
- Documentation: 82 pages, no source errors or warnings. Full strict documentation
  coverage is not established. OSS hygiene and secret-pattern checks passed.
- Form UI: all eight appearances × two densities at 1440px and 390px, no horizontal
  overflow, token-matched control radii, retained stale-save edits, keyboard use,
  reduced motion and no browser console errors. Consent checked at both widths.
  These are controlled transports around the real UI, not a complete public-demo
  form-to-pipeline simulation. Screenshots were opened and inspected.

- Website browser checks: lost-response replay, stale-edit retention, export,
  import, scenario isolation, desktop/mobile saved preview, eight appearances
  with rendered selected-hover contrast of at least 4.5:1, and keyboard save.
  AI authoring checks cover page creation, model filters, local suggestion
  review, undo/redo, private save, publication, rollback and collection preview.
  Both suites reported no console errors or real network writes. Cold dev
  navigation intermittently reloaded the editor; the passing harness compiles
  tested routes before browser interaction. No speculative navigation rewrite
  was introduced. The complete form, consent, editor and AI-authoring browser
  sequence also passed against the final production build with
  `LAUNCH_QA_MODE=production npm run resources:run -- node scripts/qa-launch-readiness.mjs`.

Final build and exported-artifact results are recorded in
the exact-commit work-board handoff. The final branded webpack production build
passed, including TypeScript and 481 generated pages. Default Turbopack refused this worker's shared `node_modules` symlink;
that environment failure is not a successful default-bundler check.

Local screenshot/trace directories: `/tmp/accelerate-launch-readiness-qa`,
`/tmp/accelerate-website-editor`, `/tmp/accelerate-website-authoring`.
These machine-local artifacts are not shipped inside the open-source export.

## Release gates still requiring a configured environment

1. Review and deploy the exact candidate; apply the catalog to the intended
   database and verify the live schema. Review any existing native OAuth consumers
   before enabling the opt-in Site Studio token hook: it refuses unknown OAuth
   clients. Merely applying its migration does not enable the hook.
2. Follow [Site Studio ChatGPT setup](../self-hosting/SITE-STUDIO-CHATGPT.md).
   In the target ChatGPT client, verify consent, private read/edit, exact preview,
   execution receipt, publication, rollback, refresh and revocation. Confirm that
   normal owner sign-in and legacy workspace MCP behavior remain unchanged.
3. Exercise the fresh-install first-result journey and enabled provider workflows
   using controlled staging accounts. Do not convert fixture checks into claims
   of successful live billing, social delivery or AI-provider generation.
4. Complete normal independent review, CI, integration and release authorization.
   The Stripe adapter conformance check still reports an undocumented idempotency
   TTL warning; its blocking checks pass. Form Builder's complete public-demo
   intake simulation and automatic import of remaining source layouts are not
   delivered by this candidate.
