# Private page draft preview verification

Private draft sizing previously limited a container inside the admin page. Viewport units and media queries still used the admin window, public content inherited admin styles, and CTA links could leave the draft.

The detail screen now reuses `WebsiteLivePreview` and the existing live `/site-preview` frame. Private documents use the public `SitePageRenderer` in an independent 390, 768 or 1440 pixel viewport, scaled to fit the available screen. The page toolbar retains the scenario-aware **All drafts** link. Existing draft read, rename, discard, receipt and recovery behavior stays in its current owner.

The frame validates schema and the 512 KB document bound before accepting same-origin parent messages. An invalid message preserves the last valid preview. Private live frames receive the validated detail document, omit demo scenario initialization, and do not fetch the owner website API. Published pages retain their real links and form behavior. Preview click, keyboard and auxiliary-click interception applies to private and installation website previews; FAQ disclosure remains interactive.

## Verification coverage

- `test:site-draft-recovery` executes actual detail/create components and checks title retention, stale receipts, refreshed revisions, route isolation and uncertain writes. Container-style assertions were removed because the detail no longer owns preview sizing.
- `test:website-ai-recovery` preserves installation editor cancellation, late-reply and stale-review coverage.
- `test:site-studio` and `test:site-draft-demo` cover validated documents, size bounds, shared draft operations, installed demo transport and scenario isolation.
- `qa:site-studio` checks actual private iframe widths, media queries, responsive hero type, keyboard size controls, public style isolation, ordinary/Enter/middle link activation, FAQ disclosure, invalid and oversized parent messages, wrong-source messages, preserved control spacing, and recovery at outer widths 1440 and 390. All API/provider requests are rejected and counted; screenshots accompany console/page-error checks. These are fictional and controlled browser journeys, not connected provider or production data proof.
- Lint and the production build validate the source tree. CI supplies the full core suite and wider website journeys for the exact submitted head.

## Public documentation review

The Site Studio guide, plugin overview, product changelog, Command Center capability and FAQ, plugin README, repository README and repository changelog describe the real responsive previews and inactive links/forms. Existing manifest titles/descriptions remain accurate and match frontmatter; URLs and section links do not change. The generated docs index is regenerated and verified. Search, public source statistics, and admin route inventory checks cover the updated tree.

Local command receipts, desktop/mobile screenshots, immutable commit and CI status are recorded in the external review receipt. This document does not establish release acceptance, migration execution, provider configuration or production deployment. No dependencies, database schema, authorization boundary or publication writer change.
