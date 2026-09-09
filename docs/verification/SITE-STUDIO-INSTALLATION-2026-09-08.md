# Installation website editor implementation evidence

Live work: `site-studio-installation-editor` (`7b54f4b4-7519-4758-a268-eeaa17fc0d17`).
Base: `f09d5ba79b43fcb35e84880f0e8c5130133c52bf`. Resumed checkpoint: 2026-09-09.

This is an implementation checkpoint, not feature acceptance or release approval.
No production migration or deployment has been performed for this change. Draft
PR #67 retains the unfinished work. The founder prioritized editing the current
installation website and independent fork ownership; custom domains, multi-site
hosting, broad Architect installation and unrelated executor work remain outside
this claim. Other agents' design/theme source is preserved in their checkouts.

## Implemented and verified locally

- The reviewed inventory covers all 45 marketing route files, distinguishing
  content pages, collections and application behavior. Inventory coverage is not
  evidence that every page has already been migrated.
- Portable snapshots validate identities, public paths, asset references, safe
  links, bounded rich text and typed appearance values. They cannot carry tenant
  authority, arbitrary component code or publication pointers.
- The native PostgreSQL upgrade suite passed for immutable website revisions,
  receipts and atomic save/publication operations: concurrent writes, replay,
  changed-payload refusal, stale versions, previous-publication rollback,
  unpublish, tenant isolation, anonymous SQL denial, audit rollback and module
  disable. The SQL has not changed since those passing native runs.
- Public-selector unit tests prove that drafts and foreign revisions cannot be
  returned, failures are explicit, and unpublish cannot resurrect the bundled
  website. That selector is not yet connected to the public route tree.
- All twelve homepage sections now have registered content adapters. The sample
  plan and product screenshot content are editable too. The selected-work cards
  still use the source portfolio collection. Default full-homepage SSR, including
  the hero grouping, matches the existing Studio renderer. Seven newly migrated
  components also matched the published baseline in a separate SSR comparison.
- The owner-only API requires platform ownership, active bootstrap administrator
  membership, tenant binding and enabled Site Studio. It bounds request bodies,
  validates the shared command and returns the atomic receipt directly. It never
  turns a successful write into a false failure through a follow-up read.
- The admin editor saves private drafts, preserves fields on conflicts, retries
  an uncertain save with its original key, imports/exports portable snapshots,
  reorders/hides sections and edits page content. Saved previews use an isolated
  viewport. Only `/site-preview` permits same-origin framing; its CSP forbids
  other ancestors. Real draft data still requires the owner API. Preview
  interactions do not count as public analytics or conversions.
- The shared admin demo uses fictional scenario session state and the same editor,
  preview and command schema. It performs no database or provider writes.
- Public user documentation includes concrete editing, interrupted-save,
  stale-edit and fork/import examples. Feature copy and FAQ describe the current
  private-draft limits explicitly.

## Browser evidence

`scripts/qa-website-editor.mjs` now runs in the credential-free CI journey. Its
local result and opened screenshots are under `/tmp/accelerate-website-editor/`.
The workflow proves a lost response replays revision 1, a conflicting save keeps
local edits, export preserves those edits, reload asks before replacement, and
saved preview displays revision 2. It verifies scenario isolation, invalid-import
preservation, valid private import, mobile keyboard save, a real 390px preview
viewport, same-origin framing headers, and absence of draft text in anonymous
frame HTML. It records browser errors and network mutations.

The appearance loop reads the actual theme registry and waits for its applied
ID; labels such as Paper/Night are not mistaken for the light/dark IDs. Screenshots
cover Paper, Night, Signal, Studio and Frost. Desktop and mobile use reduced
motion. Earlier homepage checks also covered normal animation and keyboard FAQ
controls. These scoped checks do not establish complete website-editor acceptance.

| Before | After |
| --- | --- |
| Homepage content lived in source components. | Twelve registered adapters preserve default markup while accepting validated content. |
| An interrupted save had no installation-editor recovery surface. | The UI retains the exact request for retry and preserves local edits on conflicts. |
| The draft preview inherited the admin canvas. | A separate same-origin viewport renders page content at its own width and background. |
| The iframe border reduced the requested mobile viewport. | An outline preserves an exact 390px content viewport. |
| Reduced-motion visitors could briefly miss the highlighted hero phrase. | The static phrase is visible before hydration; the browser checks its text. |

## Verification and resource notes

The focused Site Studio suite, native-template/default parity, fictional revision
suite, demo contract, documentation coverage, admin token contract and reviewed
route inventory pass. Full lint and TypeScript/build checks have passed. The
latest application build uses one static-page worker and a smaller 1536 MB Node
heap under the unchanged 3 GiB process-group limit:

```sh
npm run resources:run -- env NODE_OPTIONS=--max-old-space-size=1536 CIRCLE_NODE_TOTAL=2 NEXT_DIST_DIR=.next-qa node scripts/next-release.mjs build
```

Earlier memory-limit and disk-limit stops remain failures in the local logs;
they are not passing evidence. Only owned, completed release dependency/build
output and this worker's rebuildable QA cache were removed to recover space.
Source, lockfiles, receipts, active workers and other projects were preserved.
CI run `34302054060` passed for the previous commit `a6bb67f`; the resumed changes
require their own exact-commit CI result before advancing.

## Work still required for acceptance

- Migrate the remaining real pages, shared header/footer/navigation, collections
  and assets while preserving existing URLs, layouts, forms and SEO.
- Finish the visual editor and complete collection/asset workflows. Generic
  snapshot fields and image references are not a finished media library or rich
  collection editor. Shared website chrome is not rendered by the preview yet.
- Connect public routes to published revisions and add explicit publication
  review, history, rollback and unpublish controls. No UI save publishes today.
- Add governed AI/MCP equivalents through the same service and approval queue.
- Verify the complete owner/fork journey, update the user examples for the finished
  flows, pass exact-commit CI, submit the reviewed handoff, then satisfy the
  separate migration and production-release requirements.

The claim remains active; no acceptance or completion handoff has been submitted.
