# Private page drafts in the fictional demo

## Outcome and ownership

The full admin demo previously returned an empty draft list and a 404 for every
private draft mutation. It now uses the actual Site Studio pages to create,
preview, rename and discard scenario-local drafts. Reload preserves saved copies;
switching fictional businesses isolates them, and reset removes them.

`draft-operations.ts` and `draft-revision.ts` hold the existing pure domain rules.
The existing `drafts.ts`, `revision.ts` and `generate.ts` server-only entry points
retain their import boundaries. `brief.ts` shares the existing brief formatter.
The live HTTP adapters reuse the same strict transport schemas; authentication,
tenant storage, provider execution, rate limiting and immutable database writes
retain their existing owners.

`admin/demo/site-draft-runtime.ts` implements only the scenario's session-storage
repository and fictional transport. Checksums use SHA-256 of the document.
Repository writes recheck checksums and slug ownership after asynchronous hashing,
so concurrent requests cannot overwrite a newer document or claim the same slug.
The 200-draft list ceiling is also the demo creation ceiling. Confirmed changes
produce bounded simulated receipts, visible in the shared Activity read model.

The creation screen labels AI example mode and hides the live model picker in
that mode. The draft detail identifies an AI example as simulated. The demo
uses the built-in service template and calls no provider. Connected generation
continues to use the shared authenticated model gateway.

## Verification and evidence

- `test:site-draft-demo` executes the shared operations and the installed demo
  handler: validation, gallery limits, SHA-256 receipts, concurrent saves/creates,
  stale discard, session restore, scenario separation, module refusal, reset,
  Request-object input, malformed JSON and simulated Activity entries. Native
  fetch is forbidden throughout the installed-runtime checks.
- `test:site-draft-recovery` continues to execute actual component source with
  controlled failed and uncertain responses, retaining connected-mode behavior.
- `test:site-studio` covers existing creation, revisions, regeneration, renderer,
  database transport, website commands and model catalogue contracts.
- `qa:site-studio` retains controlled recovery cases and adds the unmodified demo
  handler at 1440 and 390 pixels: Enter creation, explicit AI labeling, rename,
  reload, Keep draft, scenario separation and confirmed discard. Protected and
  external requests, console/page errors and page overflow fail the journey.
- Public guide, plugin overview, Website pages capability and changelog are
  checked on desktop and phone. Existing image figures must load before capture.

Exact source identity, command outcomes and inspected browser images belong in
the handoff receipt under
`~/.local/share/accelerate/reviews/20261005-site-studio-demo-drafts/`.

## Public information and limits

Updated the Site Studio task guide, plugin overview and README, product and
repository changelogs, Command Center capability and FAQ, root README and source
statistics. Manifest title and description remain accurate. The generated docs
index and admin route/AI inventories are reviewed and regenerated.

Browser-session examples do not prove connected database persistence, real AI
availability, production migrations or publication. Private preview width
controls constrain the rendered container; actual phone browser checks use a
390-pixel viewport. The separate installation editor owns publication and its
responsive iframe previews. This change does not publish any application or
website revision; merge and production release remain separate handoffs.
