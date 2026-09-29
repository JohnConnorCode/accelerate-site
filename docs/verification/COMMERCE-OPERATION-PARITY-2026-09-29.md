# Commerce operation audit and collection policy handoff

Inspected baseline: published `e9f285804d2e1d3bad798db6fe9eae26e8df415f`.
The exact candidate commit and executed evidence belong to the linked PR and live
`collections-approved-policy-parity` card. The parent `admin-ai-parity-commerce`
remains open. This is not a full commercial-operation parity or deployment claim.

## Semantic operation matrix

| Operation / admin adapter | Existing owner | AI/MCP coverage in this candidate |
| --- | --- | --- |
| Proposal list/detail, `proposals GET` | Route query | Gap: dashboard context is not full proposal reading |
| Proposal draft generation, `proposals/generate POST` | Route, shared AI gateway and proposal validator | Gap: extract canonical generation; model-produced pricing must not become trusted billing input |
| Proposal creation, `proposals POST` | Route insert and audit | Gap: move into validated, replay-safe domain owner before exposing a tool |
| Draft content, title, commercial totals, client name edits, `proposals PATCH` | `applyProposalWrite` / `updateProposalDraft` | Gap: exact preview and approved command adapter |
| Proposal status transition / decline reason, `proposals PATCH` | `applyProposalWrite`, proposal host RPC | Gap: lifecycle-specific approved tools; preserve public decisions and expiry |
| Stripe billing choices / invoice receipt / operation history, `invoicing GET` | Stripe host and action query | Partial: existing invoice workflow tools, no complete invoice-history tool |
| Invoice index pagination, `invoicing/list GET` | Route validation / `tenantStripeClient` | Gap: conversational paginated index |
| Create Stripe invoice draft, workflow adapter | `prepareWorkflowPlugin` / `reviewStripeInvoice` / executor | Existing approved workflow; no new billing writer |
| Propose invoice send, `invoicing POST` | `proposeStripeInvoiceSend` | Existing `propose_invoice_send` |
| Read published invoice pages, `invoicing/pages GET` | `listInvoicePages` | Gap: page-list tool |
| Generate page design, `invoicing/pages POST generate` | `generateInvoiceDesign` | Gap: conversational design generation |
| Preview / propose page publication, `POST preview/propose` | `previewInvoicePage` / `proposeInvoicePage` | Existing invoice-page tools, exact digest and approval |
| Revoke invoice page, `POST revoke` | `revokeInvoicePage` | Gap: approved revocation adapter |
| Read cases and workspace, `collections GET`, `collections/workspace GET` | `listCollectionCases` / `readCollectionWorkspace` | Existing bounded `get_collection_cases` |
| Track / refresh explicitly selected invoices, `collections POST` | `syncCollectionCases` | Gap: governed conversational refresh adapter |
| Edit dispute, pause, pause-until, promise date, owner, next action, `collections PATCH` | `updateCollectionCase` | **Implemented:** `preview_collection_policy` → `propose_collection_policy` → explicit approved executor → same writer |
| Preview / propose reminder, `collections/reminders POST` | Reminder host | Existing preview/proposal tools; separate reminder approval remains required |
| Approve, reject, retry / reconcile actions | Canonical action service and executor | Human approval controls, never model self-approval |
| Credential entry and OAuth consent | Integrations settings | Secure human handoff; credentials never enter tool inputs |

Additional surfaces inspected: `src/app/admin/proposals/page.tsx`,
`InvoiceIndex.tsx`, `InvoicePageDesigner.tsx`, `CollectionsWorkspace.tsx`, and the
shared action review dialog. These clients adapt the listed APIs; no additional
commercial browser database writer or server action was found in these surfaces.
Missing business tools are implementation gaps, not authentication-only handoffs.

## Delivered policy boundary

Only existing policy fields are accepted. Model input cannot change recipients,
amounts, currency, tax, prices, provider identity or payment links. Server-read
case revision, recipient and current verified invoice facts bind the exact
before/after policy. Changed facts require reapproval. Enabled modules, active
workspace membership and autonomous-mode refusal are checked at execution.

`updateCollectionCase` remains the only policy writer. Its existing SQL owner
serializes workspace changes, checks revisions, records immutable command
receipts, updates follow-up work, and records activity/audit transactionally.
Request replay recovers an already committed command without another write.
No schema or provider migration is included.

The case workspace distinguishes **Approve policy change** from **Approve and
send**. The common approval dialog shows customer context and the exact changes
without filling the review with internal invoice snapshots. All six demos reuse
this UI and the shared session transport; their deterministic conversation
simulation supports owner, pause and resume requests. Connected AI/MCP supports
all six policy fields.

## Verification

- `test:collection-policy`: canonical registry/MCP proposal and executor with
  controlled Stripe/host transport; all six fields, dedupe, denial, expiry,
  provider failure, stale case/payment/recipient, permission revocation, retry,
  concurrent approval and receipt recovery. No email sends.
- `test:collections-agent-tools`, `test:collections-workspace`, action and
  permission suites: existing paths and module/tenant boundaries.
- `scripts/qa-collection-policy.mjs`: real shared desktop/mobile demo components,
  exact review labels, keyboard approval, rejection, reload and stale payment;
  blocked external/API network escape and collected console errors.
- Public guide, plugin README, changelog, capability copy, FAQ and generated docs
  are updated together. Provider/hosting usage and the bounded live invoice reads
  are disclosed; local proofs do not establish production readiness.

Review, merge and production deployment remain separate from this handoff.
