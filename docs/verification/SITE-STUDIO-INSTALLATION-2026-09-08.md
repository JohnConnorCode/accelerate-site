# Installation website authoring evidence

Live work: `site-studio-installation-editor` (`7b54f4b4-7519-4758-a268-eeaa17fc0d17`).
Base: `f09d5ba79b43fcb35e84880f0e8c5130133c52bf`. Resumed: 2026-09-09.
Draft PR: https://github.com/JohnConnorCode/accelerate-site/pull/67.

This remains an implementation checkpoint, not acceptance of every item on the
broad installation migration card. No deployment or content publication was
performed. The additive website schema migration was applied and verified as
described below. The existing worker and its retained same-task chrome edits were
preserved; other application branches and workers were not reset or switched.

## Implemented

The owner editor creates service, landing and article pages, clones content into
new identities, and edits typed page fields, sections, rich text, metadata and
safe addresses. It supports local undo/redo, shared identity/navigation/header/
footer/dock/theme settings, existing image references, collections and article
entries, and portable import/export. Images can become logos, sharing images or
article images; referenced images cannot be removed silently.

AI suggestions support copy editing that preserves identity, addresses and layout,
or generation of a new registered layout and copy. Preparation makes no website
write. The owner reviews the candidate before adopting local edits and explicitly
saving. Muse Spark 1.3 is the default, with Nex N2.5 Mini free, Mercury 2.5 low-cost,
Claude Sonnet 4.6 and Claude Opus 4.6 premium choices. IDs, structured-output
capabilities and price ceilings were checked against
https://openrouter.ai/api/v1/models on 2026-09-09. No Contributor/data-sharing tier
is selected. Requests use the shared tenant-bound gateway, registry and usage
receipts with explicit model and strict pricing; no automatic model fallback.
Tenant registration restrictions still win, and these catalogue defaults do not
implicitly authorize other AI jobs. Both legacy generation APIs accept the same
supported model IDs and default.

Live and saved previews use isolated same-origin frames, validated snapshots and
real device widths. Public and preview output share a theme mapping and shared
chrome. Links and submissions are inactive in preview. Mobile has separate Edit
content and Preview page views, a compact content selector and a Website tools
dialog for secondary actions.

Publication, history, rollback and unpublish use the existing validated command
service and immutable receipts. Uncertain requests retain the original key and
payload. Stale edits retain local fields. Rollback preserves a newer draft.
Connected public rendering selects only the published revision at request time;
credential-free forks keep their bundled static content. New paths and collection
entries render through the catch-all; supported existing marketing routes can be
explicitly replaced at the same address. Untouched source routes keep their
existing rendering. The sitemap merges published addresses and excludes noindex
entries. Documentation/application/compatibility routes remain protected.

The founder's additional Work-board request is implemented as search, a compact
work-view selector, active filter chips, result count and board/list controls.
Advanced fields and saved views/sharing use the shared accessible dialog. All
live board operations in this continuation used the canonical database/CLI path;
browser checks touched fictional scenarios only. Parent and worker AGENTS.md
record DB-first, bounded-read and carried-forward recovery authorization rules.

## Workshelter reference and visible changes

Reviewed sibling `../workshelter-next/components/admin/content/PageList.tsx`,
`PageEditor.tsx` and supporting page-builder sources. Adopted the useful workflow:
page creation/cloning, separate manual and AI controls, responsive canvas,
unsaved-change protection, and review before publishing. Reused this repository's
validated document and command services instead of adding another page engine.
The sibling repository was not modified.

| Before                                               | After                                                                                           |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| New installation pages had no creation controls.     | Named starters, cloning and explicit page addresses.                                            |
| Editing exposed only generic saved content fields.   | Section controls, article blocks, collections, AI review and live device previews.              |
| AI used a fixed draft model.                         | Muse Spark 1.3 default with explicit free, low-cost and premium options and displayed ceilings. |
| Publication operations had no owner review surface.  | Saved-revision review, publication history, rollback and unpublish.                             |
| Work filters occupied a large panel on every screen. | Compact controls; advanced filters and saved views open on demand.                              |
| Mobile editor tools crowded the working area.        | Secondary tools in a dialog, content-area dropdown and separate preview view.                   |

## Verification

Passing local checks are retained in `/tmp/accelerate-studio-*.log`:

- `npm run verify:agent-contract`; reviewed admin route and AI source inventories.
- `npm run lint -- --max-warnings=0`.
- `npm run test:core`, including Site Studio, model registry and website authoring.
- Additional model-registry assertions verify all choices, Muse default, retained
  tenant restrictions and refusal to auto-authorize models for other jobs.
- Production build with TypeScript under the shared resource gate:
  `npm run resources:run -- env NODE_OPTIONS=--max-old-space-size=1536 CIRCLE_NODE_TOTAL=2 NEXT_DIST_DIR=.next-qa node scripts/next-release.mjs build`.
- `npm run verify:docs` and `npm run docs:llms:check`.
- `git diff --check`.
- Native PostgreSQL 17 upgrade/replay suite, including the website proof:
  `npm run resources:run -- env PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH" npm run test:migration-ledger`.

The first native rerun used the system PostgreSQL 14 binary and failed on the
existing `security_invoker` requirement. Its failure log remains
`/tmp/accelerate-studio-native-postgres.log`; the corrected PostgreSQL 17 result
is `/tmp/accelerate-studio-native-postgres-17.log`. No SQL was weakened for an
older local binary. Earlier resource gate refusals remain failures, not proof.
Only one heavy job ran at a time; owned QA servers are stopped after checking.

Browser journeys are `scripts/qa-website-editor.mjs` and
`scripts/qa-website-authoring.mjs`. Their results/screenshots are under
`/tmp/accelerate-website-editor/` and `/tmp/accelerate-website-authoring/` and are
included in CI artifact upload. They prove interrupted-save replay, conflict
preservation, export/reload/import, scenario isolation, actual 390px saved preview,
creation and live preview, five models/Muse default/free selection, AI review and
local apply, undo/redo, exact saved publication, rollback retaining the draft,
collection entry preview, mobile frame bounds, and advanced-filter keyboard/
Escape behavior. Screenshots were opened at desktop/mobile widths and in the
shared appearances. Browser runtime errors and fictional API network writes are
asserted empty. Fictional AI results do not prove live provider availability. A separate live
Muse Spark 1.3 smoke generated five validated sections from a fictional brief,
without saving or publishing a website (`/tmp/accelerate-studio-model-smoke-final.log`).
Earlier provider failures exposed body-abort errors hidden behind HTTP 200 and an
insufficient reasoning/output allowance. The gateway now preserves timeout status,
refuses malformed/truncated structured output, and permits an explicitly bounded
150-second Site Studio deadline. Site models use catalogue-supported reasoning
effort and at most 8,000 output tokens for page generation. Focused gateway tests
cover these failures and no-retry behavior. Live free Nex N2.5 Mini generation also passed with nine validated sections, and
low-cost Mercury 2.5 passed with four, using the same fictional brief and no website
write/publication. The first Nex attempt exhausted its output allowance with medium
reasoning; its final configuration uses the catalogue-supported `none` effort.
Receipts are `/tmp/accelerate-studio-free-model-smoke-final.log` and
`/tmp/accelerate-studio-low-cost-model-smoke.log`. The Claude choices have catalogue,
registry and controlled transport coverage; their live availability is not asserted.
The final local gateway build compiled but the shared memory guard stopped its
TypeScript phase; `/tmp/accelerate-studio-gateway-build.log` preserves that failure.
Remote CI subsequently passed build/TypeScript for the same application source.
Final exact-ref CI remains required after the free-model configuration correction.

## Live migration verification

The configured application environment resolved to project
`skjypuwkceoiunyhhqlm` at `aws-1-us-east-1.pooler.supabase.com`. Read-only ledger
preflight found no changed checksums or unknown migrations, and only the website
migration pending through the requested target. The standard migration runner
applied `migrations/20260909012125-installation-website-revisions.sql` successfully.
Its checksum is
`21e7c59b64900d00e0e2ab7d6d70f00ce17fd06aab9b2d5e4d935c1d6a79b303`.

Read-only follow-up verified all three tables have RLS, anonymous revision reads
and authenticated direct website updates are denied, the command RPC exists, and
website revision rows remain zero. No production customer content, publication
pointer, plugin setting, hosting alias or deployed code was changed. The migration
receipt is `/tmp/accelerate-studio-live-migration.log`; secrets were not printed.

## Remaining acceptance

AC1/AC5 are incomplete: all original source pages, documentation and existing
collections have not been imported into editable snapshots while preserving their
exact original layouts/forms/SEO. Inventory coverage and explicit route overrides
are not that migration. The bundled editable seed currently contains the homepage;
other source routes remain source-owned until explicitly replaced.

AC8 is incomplete: general-purpose AI/MCP reads and approved mutation tools have
not been added to the capability registry/action queue. The owner suggestion
endpoint is a read-only preparation flow, not a substitute for governed tool
parity. File upload, richer collection ordering and complete original-media import
also remain beyond the implemented reference-based asset manager.

Exact-commit CI and acceptance-linked completion submission remain necessary.
This PR must not be marked as completing the broad card solely because the scoped
builder and recovery journeys pass. Production release retains its separate
founder-controlled deployment requirements.
