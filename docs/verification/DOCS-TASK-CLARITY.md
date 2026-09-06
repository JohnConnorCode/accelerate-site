# Documentation clarity review

This change rewrites 14 guides around user tasks: where to start, what to do,
what result to check and what to do when it fails. It also updates navigation and
search descriptions and adds the shared documentation writing guide.

The source baseline is `e73f2e0` on `agent/docs-command-center`. The review used
that branch's 55-page documentation set, preserving its navigation and components.

Source checks corrected these factual claims:

- `src/app/api/admin/revenue/route.ts` reads clients and accepted proposals;
  Revenue is not a shared opportunity-based cash-collection report.
- `src/app/admin/resources/page.tsx` lists downloads and filters the loaded page;
  it is not a resource publishing editor or a global search.
- Content Calendar's `New Content`, board/list views and status changes track
  editorial work. A status change alone does not publish the content.
- Bookings exposes company, fit, source, call and stage information. The guide
  no longer treats booking status as evidence of a won deal.
- Client status and monthly values describe account records, not confirmed payment.

Verification: the 55-page manifest/link check passes, the generated docs index is
current, changed MDX compiles, and formatting/diff checks pass. These are content
and structure checks. This pass does not claim a new browser journey, production
verification or implementation of the feature gaps described in the guides.
