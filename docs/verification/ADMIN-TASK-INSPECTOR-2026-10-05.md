# Task inspector identity and recovery

Work task selection now uses the task query parameter for list, board, calendar and keyboard opening. Identity-sensitive reads disable previous-key placeholder data and refuse to seed editable fields from a different task. Initial failures remain in the inspector with Retry, failed refreshes retain the same task and draft, and a successful empty response shows an unavailable record without editable controls.

The existing daily-work check exposed a document reload when keyboard selection used the route router. The shared navigation hook now owns a native query replacement that preserves its history entry and Next's framework state. Work uses it for inspector opening and closing, so keyboard snooze preparation survives. The daily-work check verifies document and entry identity, snooze preparation and task selection in the URL at both widths. Its navigation assertion includes the existing Invoices section, and its local default uses the canonical localhost origin.

Instructions reuse the existing operator task description command. Pending task edits, snoozes and completions share a synchronous guard; the inspector holds submitted values and its close control while pending. Confirmed matching task receipts update the exact cached record. Late completion only closes its own active inspector; unmount clears that navigation identity. Existing task services, approval rules, authorization and tenancy remain unchanged. This does not add concurrent-editor conflict detection.

Stored record IDs generate source links through the existing presentation module. Work and legacy Today share that mapping. Client, contact and opportunity links resolve individual records; inquiry and partner links open their existing collections. Unresolvable sources remain plain text instead of using a person's display name as an identifier.

## Reproducible checks

The CI-owned `scripts/qa-client-interactions.mjs` includes inspector checks at 1440px and 390px with normal/reduced motion. It covers initial read failure, scoped retained-data retry, changing task IDs during a delayed read, a canceled read replying late, retained failed edits, mismatched write receipts, one pending keyboard submission, Escape/close locking, another selection during a delayed save, saved instructions and URL reload, unavailable tasks, snooze, exact client/contact links and leaving the task for Approvals before a write replies. The contact link is checked after the pending reply; demo document navigation cannot retain the test's in-memory delayed response. The unmount fence is reviewed in source. Existing client integration checks remain. `QA_TASK_INSPECTOR_ONLY=1` selects the new regression. `QA_CLIENT_OUTPUT` selects external screenshots and receipts.

The initial Retry assertion fails on base `0bd31df99b205fef8e27ecdd604321d493e69eed`, with a retained screenshot and log. Existing workflow-view checks exercise source-link identifiers, encoding, collection destinations and unsupported types. Task write-path and lifecycle parity checks exercise the unchanged shared writer. Local final results belong in the PR and `/Users/johnconnor/.local/share/accelerate/reviews/20261005-admin-task-inspector/receipt.json`.

## Documentation and boundary review

Updated Work, the Command Center overview, the related Clients guide sentence, capability descriptions, the daily-work FAQ, README and both changelogs. Existing guide titles and manifest descriptions still match their task; the docs index is regenerated. Reviewed client-onboarding plugin README and guide: preparation, approval, task creation and assignment behavior are unchanged. Refreshed the changed admin source fingerprints; data/AI parity boundaries remain unchanged. No new dependency, server API, provider or schema is introduced.

Implementation, verification, draft submission, merge and production deployment are separate states. The PR records the exact commit and verification outcome.
