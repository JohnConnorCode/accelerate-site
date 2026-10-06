# Client workspace recovery and integration

The client record, related tasks and email history now use existing admin queries and independently recoverable regions. Identity-sensitive reads disable previous-key placeholder data. A successful client PATCH adopts the confirmed record without treating a subsequent optional read failure as a failed save. The editable form keeps its local values during refreshes and resets when a different client opens.

Follow-ups use the existing task writer and link to the exact Work inspector. Creation refreshes client tasks and history and invalidates the existing Work task and Today snapshot query keys. The shared quick-add form retains failed drafts, supports native keyboard submission and locks controls while pending. Client values use native required, nonnegative cent validation. This is browser validation; server authorization and mutation contracts are unchanged.

## Reproducible proof

Run `scripts/qa-client-interactions.mjs` against a production server through the shared resource gate. `PLAYWRIGHT_BASE_URL` selects the server; `QA_CLIENT_OUTPUT` selects an external artifact directory. The journey covers desktop 1440px and phone 390px, reduced motion, fictional Northline and SuperDebate records, exact Work inspector links, saved notes and cross-record refusal. Added recovery checks cover initial failures, independently delayed history, retained snapshots and edits on failed refresh, scoped retries, invalid values, cent persistence, locked saves, retained failed task drafts, one submission during pending keyboard activation, updated activity and a previously cached Work view.

The added initial-read check fails on base `0116d10733aea5f2edfa3d640379ccd723ae0f89` because it cannot find Retry. Local command logs and immutable build/browser receipts belong in `/Users/johnconnor/.local/share/accelerate/reviews/20261005-admin-client-workspace/`; the PR records their final results. No customer records or provider calls are used.

## Release-content review

Updated the Clients guide and Delivery overview, public changelog, task/notes capability descriptions, demo FAQ, README and repository changelog. Existing guide titles and manifest descriptions still match their task. Regenerated `public/docs-llms.txt`. Reviewed client-onboarding plugin documentation: its approval-gated task checklist and service contract are unchanged, so its existing status remains accurate. Reviewed client/task API guards and shared demo adapter: no provider, schema, tenancy or authorization changes. Refreshed only the three affected route/component fingerprints in the admin inventory; existing data and AI parity boundaries are unchanged.

Production release remains separate from implementation, verification and draft PR submission.
