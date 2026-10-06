# Installation website operation recovery

The reload confirmation previously stayed active during a save, and file imports could apply after the editor was left. The installation editor now owns one synchronous operation lock for save, reload and import. The native fields and competing controls pause while an operation runs. Failed reloads retain local edits, pending commands and undo history; initial failures offer **Retry loading website**. Leaving aborts transport requests and prevents late results or cleanup from changing a replacement editor, including React's development remount.

Saved state is checked against the shared client-safe schema before adopting its document or rendering the saved preview. Save and publication commands use the existing command parser. A success receipt must match the exact request, operation, next version, previous publication and requested publication pointer. Publication operations must also preserve the current draft. Unverified outcomes retain the original frozen command for an identical retry.

## Verification

The original regression failed because **Replace local edits** was enabled while a save was pending. The extended `test:website-ai-recovery` executes the actual editor against deferred requests and file reads. It covers rapid duplicate clicks, malformed reads, failed reload and undo retention, strict-mode cancellation and cleanup, departed-editor writes and imports, mismatched receipt fields, and exact save/publish/rollback/unpublish retries. Existing AI page identity, custom address, limits and cancellation checks remain in that command.

`scripts/qa-website-editor.mjs` exercises the shared fictional demo at 1440 and 390 pixels. It holds a committed save reply while checking the reload confirmation and fields, corrupts a receipt and verifies exact replay, rejects a malformed reload while retaining edits and undo, and delays a real file read through import and undo. The existing scenario isolation, lost response, conflict, export, appearance, saved-preview and keyboard journeys remain. The AI suggestion browser suite covers normal and reduced motion at desktop and phone widths. Screenshots, runtime errors and outgoing mutation requests are recorded alongside command results in the external review receipt.

## Public content and boundaries

The Site Studio task guide, plugin overview, Command Center capability and FAQ, product changelog, plugin README and repository references describe the updated recovery. Existing manifest titles, descriptions, section links and URLs remain accurate; the generated index is regenerated. Search and public source statistics are checked. The admin route inventory is refreshed after reviewing the editor and saved-preview boundaries; these controls retain the same canonical website commands and their existing conversational equivalents.

This is an implementing-agent local review using fictional or controlled inputs. Command results, immutable source commit, browser captures and exact CI status are retained outside the source tree. No database migration, provider integration, authorization or canonical writer changes are included. Local checks do not establish production release, connected provider behavior or independently accepted review.
