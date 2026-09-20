# Fresh-fork experience follow-up

Card: `fork-experience-polish-20260920`. Base: PR116,
`5f582b8e30121e3e36b44aaabac6148828a757a1`. This is an isolated continuation;
the submitted predecessor and its review history remain intact.

## Confirmed failures

PR116 Actions run `35479672106` passed the branded build/browser job and the
full-product fork job. It failed the admin route inventory, install-runbook
assertion and reduced neutral browser journey. The Vercel check separately
reported “Account is blocked.”

The browser error was reproduced against PR116's existing production artifact:
keyboard activation of **Open your workspace** sent `POST /api/analytics/events`,
which threw `supabaseUrl is required` and returned 500. Directly visiting the
same pages did not reproduce it. The page-view tracker skips WebDriver, while
CTA tracking did not check configuration. This affected the complete repository
as well as the optional export; it was not an export-only defect.

## First-use clarity and shared controls

| Before                                                                        | After                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct `/admin/login` showed sign-in fields without a connected installation. | `admin/login/page.tsx` uses the existing public configuration requirements on direct and redirected visits, showing setup instead of unusable credentials fields.                                                                                       |
| Setup offered only a repository filename.                                     | The setup card explains the next step and links to the actual installation guide and fictional demo. Both actions reuse existing admin colors, geometry, focus, press feedback and touch-sized controls; no new styling system or dependency was added. |
| Public guides did not describe these first-use actions.                       | The self-hosting overview and product changelog describe the setup links and inactive unconfigured analytics.                                                                                                                                           |

## Runtime reliability and isolation

| Before                                                                            | After                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The shared tracker attempted first-party writes without configuration.            | `analytics.ts` skips first-party collection without a public database URL. Configured public tracking remains active.                                                                                                                                                 |
| Conversion tracking excluded only the exact preview URL.                          | One shared public-page guard excludes admin, tenant, demo and preview route trees from first-party and conversion tracking.                                                                                                                                           |
| Analytics client construction could throw outside the handler's failure boundary. | The existing analytics adapter validates origin/input, returns an explicit non-acceptance for missing configuration, and safely reports failed writes or client construction without fabricating acceptance. Tenant binding and event deduplication remain unchanged. |

## Verification quality

| Before                                                                                            | After                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The install test rejected “connect your own Supabase project.”                                    | Its assertion accepts the same meaning with or without “own” and checks the direct-setup guards and real destination links.                                                                                                                                 |
| Editor components and shared form validation had changed without refreshed route review evidence. | The inventory records the reviewed setup, published-form ownership, exact-retry, reserved-path, preview and scoped MCP boundaries, with current source fingerprints. It remains a drift check, not a claim of universal AI parity.                          |
| Full-product QA missed the failing CTA click; browser errors lacked request locations.            | Both distributions run the actual desktop/mobile first-use journey. Checks include keyboard navigation, direct setup, touch targets, accessibility, demo edits and docs. Error receipts include failed request URLs and statuses.                           |
| No focused proof covered unconfigured analytics and the expanded private-path guard.              | Existing fork and renderer tests cover absent/partial configuration, origin/input rejection, configured public tracking, tenant-bound writes, replay identity, returned database errors, client construction failure and private-path tracking suppression. |

## Verification ledger

Focused local checks passed: agent contract; full-product fork; install runbook;
admin route inventory (61 routes, 357 source fingerprints); website renderer;
search; six-scenario demo contract; module contract; open-source readiness;
documentation; generated docs index; public statistics; guardrails; whitespace.

The clean-install production compilation passed, but the shared machine's memory
availability dropped to 10% during type checking, and the resource gate stopped
the job. No successful local final build is claimed. Build, lint and browser
evidence will be recorded from clean CI runners after final verification.

Dependency setup initially stopped at the shared memory threshold. The interrupted
install left a truncated native compiler and missing icon declarations. Incremental
repair did not restore the whole tree. A complete `npm ci --prefer-offline --maxsockets=1`
then passed using the unchanged lockfile: 700 packages installed, zero known
vulnerabilities. No resource limits or unrelated processes were changed.
The incomplete compiler is retained at `/tmp/accelerate-polish-incomplete-swc-20260920`.

## Release-content review

Reviewed `src/content/command-center.ts` and `src/content/command-center-faq.ts`.
Their existing full-fork, self-hosting, fictional demo and Site Studio descriptions
remain accurate: this follow-up adds setup navigation and fixes optional telemetry,
not a new business capability, provider or editor authority. No plugin operation
or public documentation URL changed. The docs index generator produces the same
index because section metadata did not change.

## Remaining release gates

Implementation, accepted review, merge and deployment are separate. Keep PR115,
PR116 and this continuation in the integration review. The original installation
must explicitly select the branded profile before upgrading. Resolve the hosting
account block through its owner before a separately authorized deployment.

The prior launch requirements still apply: controlled fresh database installation,
live ChatGPT OAuth/grant/expiry/revocation, real provider and form-intake receipts,
and backup/restore proof in the intended environment. Local mocks and browser
fixtures do not establish these outcomes. This pass makes no production writes.
The full repository retains the asset restrictions documented in `ASSETS.md`;
disabling agency delivery does not grant reuse rights to protected media.
