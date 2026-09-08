# Admin polish integration

The candidate integrates `f71943f0e97fc7d347245033830e23aae3650a13` and
`1e1495c2443b3e06e04bfcb325adc35e4f039fbf` onto published main
`9276b402158ebc44d568e76bac48f7dd7d19bca8`. The original polish worker and
all unrelated worktrees remain intact. Delivery reconciliation PR #63 was initially excluded; it merged independently
before the final merge attempt and is now retained through the updated main base.
The live polish card remains in review; this PR does not record founder acceptance.

## Integration corrections

| Before                                                                                                     | After                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| The source branch relied on theme registry and radius changes absent from main.                            | Restore shared appearance persistence/types and the dialog radius token.                  |
| Newer Campaign, Contacts, Work, Pipeline, Feature Board, Radar and utility dialogs override theme corners. | Use shared dialog surfaces and flat list elevation while preserving their newer behavior. |
| Main and the polish branch have different test lists and release copy.                                     | Retain main's suites and content, append polish coverage, regenerate both inventories.    |

## Verification

Full core suite, zero-warning lint, full-repository formatting, agent contract,
admin token contract, documentation validation, generated docs index and admin AI
route inventory pass locally. The combined inventory has 92 routes and 82 mutation
handlers; it does not assert semantic parity.

The local webpack build completed TypeScript but was terminated by the shared
resource gate during page generation above the 3 GiB process-group memory limit.
This attempt is a failure, not a passing build. Its log is retained at
`/tmp/admin-polish-integration-build.log`. Production build and browser verification
run on the PR's GitHub runner; their exact outcome will be added before handoff.

The integrated local browser suite passes all five appearances at 1440×1000 and
390×844, including 20 zero-violation contrast audits. Mouse/keyboard order,
Escape cancellation, stage/order partial failure, reload, native touch and
card-body swipe, edit/discard/focus, custom theme import/export/save/isolation,
and normal/reduced-motion slow/cached/error navigation all pass. Desktop and
phone captures for every appearance, the feature editor, custom theme dialog,
touch overlay and slow navigation capture were opened and inspected. Artifacts:
`/tmp/admin-polish-integration-qa/`; log: `/tmp/admin-polish-integration-browser.log`.
The dev server logged an early closed stream during navigation; the browser
suite reported no page or console errors. Its owned server and browsers exited.

Initial CI surfaced the source review inventory and public repository counts
that predated these additions. Reviewed the new theme/confirmation components
and changed route boundaries, retained the existing Content parity follow-up,
and refreshed the fingerprints. The inventory covers 51 pages and 288 sources.
Public counts now reflect 226 checks, 788 TypeScript files and 150K lines.

The first remote run (`34244895629`) passed production compilation, TypeScript,
prerender coverage and plugin packaging. Its broader browser step exposed an old
Branding assertion that selected the first input, now the theme name. The journey
now targets Display name by its accessible label and waits for the named save
control to return disabled before verifying the value and reloading. No product
behavior or approval checks were weakened.

No production deployment is included.

## Main update before merge

The candidate `ac14d156f011232d1d5b11a772b82a731ca31101` passed every required
check in CI run `34246431266`. The normal merge attempt then encountered newly
merged main `02acb5241c8b2b9ced83f167faf5224999b1b2cc` (PR #63).
The integration retains both changelog entries, refreshes combined source counts
and inventory fingerprints, and preserves the delivery handoff in the pipeline
record and demo runtime alongside the polish changes. The combined source tree
requires a new CI run before merge; prior CI does not verify this update.
