# Admin communication standard

Every core admin page should help an operator answer three questions: what this
page is for, what requires attention, and what they can do next.

- Name the business object or task. Do not use internal jobs, filenames,
  migration names, or engineering abstractions in normal operator copy.
- Use one canonical name in navigation, search, breadcrumbs, page headings and
  documentation. Stable URLs and module IDs are separate from display labels.
- Put a brief purpose statement below the page heading. Show two short steps in
  the shared **Help** disclosure when the workflow needs context.
- Explain action results before confirmation when they affect a customer,
  record, or future work. Use the actual state: empty, filtered, loading,
  unavailable, failed, or previously loaded.
- Keep technical diagnostics available on demand. An error recovery message
  should say what the operator can try before showing implementation details.
- Avoid invented certainty. AI suggestions, delivery state, capability status,
  and receipts must describe only the evidence currently available.

The shared navigation registry and `PageHeader` implement this standard for core
destinations. Extensions provide their own guidance only when their operator
workflow is materially different.

The language audit parses the navigation/guidance registries and follows rendered
page components to inventory core root and record-detail introductions. Run
`node scripts/audit-admin-language.mjs --check` or add `--json` for the full source
matrix. `node --import tsx scripts/test-admin-language.ts` checks canonical root,
search and breadcrumb identity, including query-specific destinations, and
injects missing guidance, broken guide links and heading drift. Record details
retain their own titles and the canonical parent breadcrumb.

This is source and shared-function evidence. The browser matrix in
`scripts/qa-admin-overhaul.mjs` separately measures headings, help, contact detail
breadcrumbs, viewport bounds and keyboard focus in the fictional demo. CI retains
its screenshots and summary; inspect those before declaring visual acceptance.
