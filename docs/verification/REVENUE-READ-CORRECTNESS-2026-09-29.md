# Revenue contract read correctness

Scope: `revenue-read-correctness`, based on published main
`e9f285804d2e1d3bad798db6fe9eae26e8df415f`. This is implementation and controlled
verification evidence. Review, integration and production deployment remain separate.

## Changes and source review

`analytics.ts` now owns the full tenant-scoped report. It reads clients, accepted
proposals and opportunities in ordered pages of 500, checks exact counts and unique
IDs, and refuses incomplete or over-budget sources. Revenue also requires a complete
read from the existing pipeline-stage resolver. The route retains its early module
and tenant guard and returns a sanitized unavailable/retry response for read failures.

`revenue-metrics.ts` is the browser-safe projection shared by live and fictional
Revenue reads. It uses cents for agreement sums and current active clients for every
monthly breakdown. The UTC start-month projection groups equal months and ends at
the active monthly total. Creation-date fallbacks and undated active values remain
visible. Accepted proposals, one-time agreement values and opportunity totals remain
separate. No historical churn dates or collected payments are inferred.

The existing `AdminReadBody` owns initial failure, keyboard Retry and cached-data
warnings. The Revenue page and chart explain the current-record basis, show accepted
proposal value and respect reduced motion. Client rows use record IDs and wrap at
mobile widths. The fictional report reads the same client overrides as Clients.

## Public content review

- `src/content/docs/pipeline/revenue.mdx`: verified labels, source formulas, missing
  dates, limits, fictional edit example and retry against the route, projection,
  Revenue page, Clients demo edit and shared read state.
- `src/content/docs/pipeline/overview.mdx`: identifies current agreements beside
  recorded opportunities and links to the detailed guide.
- `src/content/docs/manifest.ts`: reviewed; existing titles, URLs and descriptions
  still match both guides and their task, so no metadata change is needed.
- `src/content/changelog.ts`: dated behavior and recovery entry.
- `src/content/command-center.ts`: Numbers you can check explains source separation
  and incomplete-read recovery.
- `src/content/command-center-faq.ts`: specific Revenue answer covers the figures,
  chart, current churned share and payment/history verification.
- `public/docs-llms.txt`: regenerated from the guides. Revenue's fictional screenshot
  is refreshed from the real demo in a fresh reduced-motion browser context. The
  complete chart and active monthly total agree; the image and alt text were inspected.
- No plugin workflow, manifest or setup requirement changes. No migration, provider
  activation, external send or production mutation is included.

## Verification

Local focused verification passed: Revenue service/API failure matrix, Analytics
retained-value reconciliation, agent contract, zero-warning lint, documentation
source coverage, generated index freshness, search and open-source statistics.

The local production build was refused by the shared resource gate because only
2.3 GiB was available and 5 GiB is required. Build, TypeScript and browser proof use
a fresh CI checkout of the candidate. Final run and artifact receipts belong in the
PR and exact-commit work-board evidence; pending checks are not acceptance proof.

`qa:revenue` verifies desktop/mobile initial error, keyboard retry, retained stale
figures, empty state, client edits, six fictional scenarios, UTC context, console
errors and protected/provider isolation. It waits for settled figures and charts,
then captures changed guides and their loaded figures at both widths.
The existing docs journey additionally verifies documentation search and recovery.

## Boundaries

Reports remain bounded to 5,000 records per client, accepted-proposal and opportunity
source. A larger source requires a database aggregate rather than a partial total.
Ordered pagination detects truncation, count changes and repeated IDs; it is not an
atomic financial snapshot. Current statuses cannot establish historical MRR or a
period churn rate. `churnRate` and `mrrTimeline` remain compatibility API field names
with their current-record meaning stated in the UI and guide.
