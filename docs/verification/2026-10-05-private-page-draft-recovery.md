# Private page draft recovery

This batch follows the installation builder review in PR215 and targets the two
private Site Studio screens. The existing tenant-admin APIs, database adapter,
checksum-bound write services, AI gateway, model budgets and publication owner
are unchanged.

## Findings and implementation

- A failed detail refresh previously replaced the loaded draft with null and
  could leave an indefinite loading skeleton. Reads now check status, validate
  the native document, UUID identity and checksum, and retain the loaded preview
  and typed title on failure. Initial read failures have an in-place Retry.
- A title conflict previously claimed that the latest draft was loaded even
  when its follow-up read failed. Stale and uncertain saves now require an
  explicit successful latest read and review before saving or discarding.
  Typed titles are retained, matched confirmed titles need no second save,
  and removed records expose the unsaved title for copying.
- Title and discard state previously survived record changes, and uncanceled
  reads or late writes could replace the current screen or redirect it.
  Keys scope state to path and draft ID, read requests are canceled on exit,
  and write results cannot update or redirect an unmounted editor. Writes
  themselves are not canceled or described as rolled back.
- Discard previously had no way to cancel confirmation and accepted any success
  response. Keep draft cancels the choice. Discard uses the current checksum
  and checks the returned record ID; failed/uncertain outcomes require a read.
- Creation previously allowed fields to change while a submitted brief was
  pending and could navigate to an invalid receipt. The existing shared admin
  controls now form a native Enter-submit form, enforce server length limits,
  and lock while pending. Receipts are schema/checksum validated. A successful
  list refresh is required before retrying uncertain creation so the user can
  find an existing saved copy. Duplicate clicks do not dispatch another write.
- Gallery choices previously ignored a ninth selection silently. The screen
  opens the catalogue on demand, shows the eight-image count, disables additional
  unchecked choices at the limit, and omits the picker when the profile has no
  catalogue. The shorter subtitle distinguishes private drafts and publication.
- Unchanged title saves are disabled and Title saved confirms a receipt.
  The header shows the page address, source and update date instead of an
  internal checksum. Shared buttons and fields keep control states consistent.

## Verification boundaries

`test:site-draft-recovery` executes the actual component source with controlled
React hooks and transport. It checks failed and mismatched reads, conflict and
receipt recovery, retained titles, matching confirmed writes, record/path keys,
read aborts, late write replies, UUID letter-case equivalence, no-op saves,
length limits, Enter submission,
normalized custom addresses and repeated-create prevention. It is registered in
`test:core`; the public automated-check count is updated to 290.

`qa:site-studio` exercises the real production admin UI at 1440 and 390 pixels,
using a controlled private-draft adapter. The adapter matches the server's
summary and discard receipt shapes and updates document metadata with title
changes. It checks pending-field locks, Enter submission, stale title review,
failed refresh retention, latest-copy recovery, canceled discard confirmation,
uncertain discard and uncertain creation list recovery. Keyboard activation,
the image-selection ceiling, page errors, overflow and screenshots are checked. Both contexts use reduced
motion. The affected controls add no motion.

The private-draft demo API does not simulate creation, rename or discard. The
controlled browser adapter is interaction evidence, not default-demo, live
provider, production database or deployment proof. The installation editor's
existing fictional scenario workflow remains available. No new private-draft
AI/MCP operation or execution path is introduced; existing operation coverage
and its limitations remain accurate.

## Release content review

The Site Studio guide and plugin overview, plugin README, public feature
paragraph, FAQ and dated product changelog explain the current controls and
recovery. The feature description removes repeated preview/publication language
from its nearby promise. The guide distinguishes connected private drafts from the fictional
installation editor. Its existing entry-point figure still identifies those
surfaces; it does not illustrate the new recovery state. Page metadata remains
aligned with the manifest. The generated docs index is current, source
inventories are refreshed, and changed docs require desktop/phone inspection.

Exact local commands, browser screenshots and outcomes are retained in the
review receipt outside the source tree. CI, review acceptance, merge and
production deployment remain separate facts.
