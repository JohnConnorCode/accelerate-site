# Full-product neutral fork implementation

## Scope and release boundary

This continues the [launch-readiness audit](2026-09-19-launch-readiness.md) from
candidate `0f91ff3eb4ba612ec9d7167ffc962e0923e996c0` (PR 115). The complete repository
is the primary distribution. The reduced neutral export remains optional.
The earlier audit contains the recent plugin, form transaction, editor OAuth,
and AI authoring findings; this report records the approved distribution follow-up.

Implementation and local verification are separate from review, merge and deployment.
No production database, hosting setting, OAuth configuration, provider connection,
or customer record was changed. This report does not establish live ChatGPT app
compatibility or universal admin/AI parity.

## Product and integration changes

| Before                                                                 | After                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `distribution/profile.ts` defaulted to the agency installation.        | The full repository defaults to neutral; the original installation explicitly opts into `NEXT_PUBLIC_DISTRIBUTION_PROFILE=branded` at build and runtime.                                                                                                                   |
| The neutral homepage and editor seed were different implementations.   | `neutral-website.ts` supplies one validated, editable product homepage to bootstrap rendering and the existing website editor/MCP seed. Saved publications retain precedence.                                                                                              |
| Static agency routes could remain reachable with neutral identity.     | Middleware routes agency addresses to owner-published content or 404 through the reserved `site-pages` owner. Product docs, demos, authentication and forms retain their application routes.                                                                               |
| Bundled media, icons and generated search could expose agency content. | Direct and optimized agency media are blocked; neutral icons, search, metadata and the documentation index use the neutral profile. New assets use `site-assets` or permitted HTTPS origins.                                                                               |
| Unmatched URLs used agency navigation and selected-work links.         | Shared neutral chrome and the neutral 404 link lead back to the homepage or fictional demo.                                                                                                                                                                                |
| Document pages could not connect the existing form workflow.           | A strict form block references a published token. UI, imports and MCP use the same document schema and website writer; public rendering reuses `PublicFormView` and the existing reviewed-intake owner.                                                                    |
| No editor discovery path existed for published forms.                  | The form picker and the scoped editor `forms` read view return published choices. Private response data is not part of that discovery response.                                                                                                                            |
| Form bindings had no website ownership or recovery contract.           | Saves, publication and rollback validate workspace ownership and module availability, with at most eight distinct forms. Failed/archived/foreign forms are refused. Completed retries still reach the atomic writer, which retains exact-request and authorization checks. |
| AI copy editing could treat an added binding token as ordinary text.   | Binding tokens are protected fields. Generation instructions forbid invented tokens; server validation rejects invalid bindings.                                                                                                                                           |
| New-page buttons always assumed a `/contact` page.                     | New pages inherit the website's configured main action link.                                                                                                                                                                                                               |
| Fork setup guidance treated reduced export as the main path.           | README, deployment/self-hosting guides, Site Studio docs, product FAQ and changelog explain the full-product default, optional export, connected forms and branded opt-in. Website tools includes an ordered setup guide.                                                  |

## Shared presentation changes

| Before                                                                             | After                                                                                                                                                              |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Document hero headings used a fixed size.                                          | `components.tsx` uses a responsive type scale, balanced wrapping, bounded measure and consistent letter spacing.                                                   |
| Feature grids could exceed narrow viewports, with little title separation.         | Columns shrink to the available width; a shared grid gap separates headings and cards. Cards use theme-aware layered shadows.                                      |
| Adjacent section blocks and call-to-action content could run together.             | `tokens.ts` supplies the default block gap; CTA blocks use explicit shared spacing. Explicit stored gap choices remain supported.                                  |
| Document links lacked one shared focus and target-size treatment.                  | `globals.css` scopes visible focus, minimum hit areas, heading wrapping and body wrapping to `.site-document`. No new animation system is introduced.              |
| Website font choices did not consistently reference the installed font variables.  | Public rendering and previews share the existing Inter and monospace variables through `website-theme.ts`.                                                         |
| A fixed website theme still showed a global light/dark toggle.                     | Header and mobile navigation hide that ineffective control when a website document owns the theme. Legacy unthemed chrome retains it.                              |
| Neutral identity could use the agency chevrons; multiword names lost their spaces. | `Logo.tsx` uses the configured name's initial in neutral mode and preserves spaces in the shared wordmark. Apple icons remain actual PNGs.                         |
| Connected-form loading, absence and binding lacked interface states.               | `WebsiteFormPicker.tsx` uses existing admin controls, a named selector, retry/empty states and disabled actions. Preview rendering explicitly prevents submission. |

## Release checks and build behavior

The two known candidate CI failures are repaired: open-source statistics now match
105 migrations, 249 named checks and 943 TypeScript source files; the module
contract recognizes the restricted editor channel without adding its five tools
to ordinary agent packs. CI now requires the full neutral repository, the branded
installation and the optional reduced export. Its aggregate check covers all
256 success/failure/cancellation/skip combinations.

A local rebuild exceeded the existing 3 GiB process-group limit when Next spawned
nine prerender workers. The build now uses two workers and completed all 481 pages
within the unchanged gate. This does not raise the memory limit or bypass another
worker's claim. Next's middleware/Edge deprecation and Edge import warnings remain;
they were warnings, not successful migration to the newer conventions.

## Verification ledger

- Full-product regression: neutral defaults, shared seed, direct/optimized asset
  isolation, reserved paths, neutral search, form ownership, publish/rollback,
  archived/disabled refusal and retry preservation passed with controlled transport.
- Site Studio, scoped editor transformations and signed-JWT authorization checks passed.
- Form Builder, tenant branding/isolation seam and booking-mode contracts passed.
- Architecture, repository hygiene, module contract, docs, search, copy guardrails
  and exact source-statistics checks passed.
- Production webpack build and TypeScript passed on the relevant application tree.
- Production browser checks passed at 1440px and 390px: no horizontal overflow,
  keyboard skip link, no WCAG A/AA violations reported by axe, no external homepage
  requests, blocked agency URLs, valid neutral search and a PNG Apple icon.
- Controlled form-picker browser checks passed: failure, empty, published-only
  choices, private save through the existing demo writer and non-submitting preview.
  This is not a live public submission-to-pipeline proof. Screenshots were opened
  and inspected under `/tmp/accelerate-full-product-fork-qa/`.
- The actual reduced export passed its identity, email, AI, document, asset and
  hosting-isolation checks using the existing locked dependency installation.
- `npm audit --omit=dev` reported zero known vulnerabilities at verification time.

The isolated worker then replaced its temporary shared dependency link with a
real `npm ci` installation: 700 packages installed and zero reported vulnerabilities.
The default Turbopack production build passed, including TypeScript and all 481
pages. The final preview-theme alignment was rebuilt and the full-product browser
suite passed again against that artifact. The existing editor and AI-authoring
browser suites also passed after the clean installation: eight appearances,
selected-state contrast, lost-response replay, stale edits, import/export, isolated
scenarios, suggestion review, undo/redo, save/publish/rollback and collection preview.
These remain controlled or fictional workflows, not hosted provider verification.

The complete core suite, lint with zero warnings, and repository formatting passed.
The final clean-dependency core repeat was interrupted by the machine memory gate
after the branding checks, then completed successfully in a bounded remaining
segment starting at `test:ai-module-controls`. Final lint and formatting passed
after that segment. No dependency versions or lockfile contents were changed.

## Remaining release requirements

1. Review the stacked candidate and require green remote CI before merge.
2. Explicitly opt the original deployment into `branded` before upgrading it.
   Forks must generate a hosting target in an account they control.
   A September 20 UTC check of PR 115 still reports Vercel's **Account is blocked**
   status. This external hosting restriction was not changed or resolved here.
3. Verify a clean connected installation with its own database and first owner,
   then a real public form submission, review, intake delivery and recovery.
4. Verify native OAuth discovery, consent, ChatGPT app connection, editor command,
   revocation and expiry against the intended deployment. Controlled JWT tests do
   not prove the hosted authorization flow.
5. Verify intended providers and backup/restore with controlled records before
   real customer use. Do not infer delivery from local fixture success.
6. Respect `ASSETS.md`: the code license does not relicense bundled trademarks,
   photographs, customer media or downloads. Neutral delivery hides those assets;
   the full repository still contains them.

No merge or deployment is implied by this implementation handoff.
