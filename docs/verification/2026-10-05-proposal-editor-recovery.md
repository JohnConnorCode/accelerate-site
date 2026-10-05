# Proposal editor identity and recovery

## Scope

This follow-on to PR #213 repairs the existing proposal page and editor. Reused local form state could show one record's values under another record ID. The page swallowed rejected writes, so the editor reported success. It ignored the canonical PATCH result when an edit created a successor draft. Clipboard success appeared before the browser accepted the link.

The editor now resets on record identity, preserves failed drafts, awaits writes and clipboard completion, and uses the shared workspace toaster so completion remains visible after navigation. Save and Mark Sent share a pending lock. A rejected clipboard request focuses and selects the native read-only share field for manual copying. The page uses the canonical returned proposal in its retained list row and detail cache, follows a successor ID, and checks the current path and proposal before changing the open record. A confirmed write followed by a failed list refresh produces a saved-changes warning.

## Existing domain contract

The proposal PATCH adapter already returns the canonical saved proposal. The transactional lifecycle creates a new draft for material edits to sent/viewed proposals and marks the prior version superseded. Draft edits retain their ID. No API, service, schema, tenant authorization, approval or provider behavior changes. Mark Sent records a status; this check does not prove email delivery. The client editor was reviewed and already propagates failed writes correctly.

The fictional runtime currently does not implement proposal PATCH. This change makes that unsupported write fail honestly instead of announcing success; it does not establish demo write parity. Browser recovery checks use controlled fictional responses to exercise the real page and editor without protected/provider requests. Canonical domain behavior is covered separately by the existing lifecycle and native PostgreSQL suites.

## Verification

- `test:proposal-editor-recovery` executes the actual page/editor sources with controlled adapters: record key, rejected write, successor receipt, late completion, confirmed-write/read warning with saved row/cache retention, incomplete receipt and pending/rejected/confirmed clipboard behavior.
- `test:proposal-lifecycle` verifies transaction keys, freshness, successor identity, validation, tenant scope and failure propagation.
- `qa-proposal-editor-recovery.mjs` checks the real production UI at 1440px and 390px with normal and reduced motion: keyboard search/navigation, record isolation, failed-save draft retention and retry, saved/read warning and reopen with confirmed fields, pending status controls, successor selection, late completion, selected clipboard fallback and successful copy. It asserts no console/page errors, horizontal overflow or escaped protected requests and retains screenshots plus a four-context receipt.
- Full lint, production build/typecheck, core tests, native database tests and browser suites must pass on the exact PR head in CI before review handoff. Focused evidence is retained as `proposal-editor-recovery-evidence`; inspect its desktop/mobile screenshots and receipt before reporting acceptance.

## Release information

Updated the Command Center overview, product changelog and repository changelog. Reviewed `src/content/command-center.ts`: its record navigation and revenue descriptions do not promise proposal editing or delivery and remain accurate. Reviewed `src/content/command-center-faq.ts`: proposal references describe approvals, delivery handoffs and revenue; this editor repair does not change those contracts. Regenerated the docs index and reviewed/refreshed the admin route fingerprints. API inventory is unchanged. Public check count includes the new scoped regression script.

Implementation, review, merge and deployment remain separate. This branch depends on PR #213 and its PR #208 foundation. No merge or production deployment is included in this handoff.
