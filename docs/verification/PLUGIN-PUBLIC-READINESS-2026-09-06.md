# Plugin implementation and public-documentation readiness audit

## Verdict

Working, bounded business exemplars exist on a completed local branch. Accelerate
is **not yet a publicly reproducible plugin-platform release**. Do not describe
all plugin work as available to someone cloning the published default branch.

## Evidence by surface

| Surface                                             | Verified state                                                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Published origin HEAD                               | `d7b6aa055531aa305206e5dba2bb4d5699ff7f9d`, checked with `git ls-remote origin HEAD`; local origin/main matches |
| Primary app checkout                                | `ca38615`, branch `agent/unified-action-executor`                                                               |
| Completed runtime consolidation                     | `30a6f7b`, separate branch                                                                                      |
| Completed business plugin/branding work             | `c7da31b`, branch `agent/plugin-data-boundary-hardening`; not contained in primary or published default branch  |
| Work board and ten additional plugin specifications | `8ebf408`, branch `agent/universal-work-board`; committed, not a deployment                                     |
| Public homepage                                     | `https://www.acceleratewith.us/` returned HTTP 200                                                              |
| Public docs index                                   | `https://www.acceleratewith.us/docs` returned HTTP 404                                                          |
| Public self-hosting page                            | `https://www.acceleratewith.us/docs/self-hosting/overview` returned HTTP 404                                    |

The public URLs were checked directly with redirect-following HTTP requests.
The web browser retrieval tool also failed to open the docs URLs; direct HTTP
checks establish the 404 result independently. This does not establish whether
an unpublished preview has working documentation routes.

## What works in the completed plugin branch

At c7da31b, independently rerun:

- `test:plugin-modules`: 29 modules, eight from extension manifests, contract gates pass.
- `test:plugin-isolate`: real QuickJS execution, bounded memory/time, no ambient
  authority, declared bindings, error and JSON boundaries pass.
- `test:report-plugins`: real isolate/report execution, scoped sources, disabled
  state, stale AI enablement, missing capability and failure receipt checks pass.
- `test:business-workflows`: isolated onboarding and meeting plans create assigned
  canonical tasks through approval; replay, invalid assignees and disable guards pass.
- `test:demo-business-workflows`: all five scenarios cover invoice review/send/page
  publication/revocation and tasks using local fixtures and shared admin behavior.

Real exemplars: Stripe invoicing, client onboarding and meeting commitments.
Four report examples remain available as smaller runtime demonstrations. This is
material functionality, not merely a manifest or a report mock. These reruns do
not claim a new live Stripe transaction or a clean database installation.

The architecture is appropriately bounded: manifests and closed input schemas,
compiled source hashes, QuickJS limits, tenant-scoped declared snapshots, preview
and approval, narrow trusted host actions, execution-time activation checks,
receipts and retained history. New effect types still require reviewed host
service/executor registration; arbitrary plugin code cannot grant itself database,
network, credential or external-action authority.

## Public documentation findings

1. **Release composition is the first blocker.** Published default HEAD does not
   contain the executable workflow plugin directory or host. A fresh public clone
   cannot reproduce the completed branch examples. Reconcile the completed runtime,
   plugin and dependent work into a verified release before advertising availability.
2. **The documentation routes are not publicly available at the canonical URLs.**
   Publishing the code/docs together and verifying real routes, links and examples
   is a release acceptance gate, not a prose-only task.
3. **The local public docs are introductory, not a plugin developer portal.**
   `src/content/docs/manifest.ts` exposes only Start, Command Center, Follow-up and
   Self-hosting overviews. There is no public plugin quickstart, contract reference,
   permission/lifecycle guide, versioning guide or runnable business walkthrough.
4. **The public self-hosting overview is not independently executable.** It says
   to clone/install/create environment/run migrations but supplies no exact commands,
   repository link, env template, tenant bootstrap, migration command or verification
   sequence. The repository guides contain more detail; the public page must link
   to the version-matched guide or provide those steps directly.
5. **Developer documentation is partial and split across release states.** The
   c7da31b `docs/contributing/EXTENDING.md` does document report/workflow manifests,
   isolation, source policy setup, approval, Stripe limits, branding and demo
   boundaries. The current primary/board baseline has an earlier version. This is
   not yet one discoverable, released, versioned contributor contract.
6. **Clean-room reproducibility is not proven by the current evidence.** Existing
   contract/isolate/workflow/demo tests are useful, but no audit here establishes
   fresh public clone → owned empty database → first plugin → enable/disable →
   duplicate/failure/retry → upgrade. That journey must become a conformance gate.

The bounded Stripe example does not claim subscriptions, saved-card charging,
refunds, webhook reconciliation, tax calculation or unrestricted currencies.
Those limitations are explicitly described in the completed branch guide and
should remain visible in public documentation. Likewise, a compile-time module,
a bundled isolated workflow and a dynamically installed third-party plugin are
different extension modes; documentation must identify which is supported.

## Required release and documentation gates

Use existing backlog owners, not a second parallel implementation program:

- `workshelter-reuse-baseline`: reconcile completed code/docs and pin the immutable
  release base; verify the public clone contains the actual examples.
- `plugin-developer-documentation`: publish one version-matched developer path:
  prerequisites → exact clone/setup commands → first report/workflow → data grants
  → approved host effect → enable/disable → demo → failure/retry → version upgrade.
  Include capability/schema references, threat boundaries and explicit limitations.
- `plugin-cli-and-scaffold`: produce a minimal complete exemplar and explain the
  compile step and when a new effect requires core host registration.
- `plugin-conformance-kit`: automate the fresh-clone/empty-owned-database journey,
  two-tenant isolation, queued-disable, replay, stale approval, failure receipts and
  upgrade compatibility; run documentation examples as tests.

No production deployment, merge or push was performed by this audit. Until those
release gates pass, describe the feature as **implemented on a development branch
with tested bundled exemplars**, not a fully released third-party plugin ecosystem.
