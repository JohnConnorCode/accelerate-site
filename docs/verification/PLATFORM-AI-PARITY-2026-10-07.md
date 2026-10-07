# Founder administration operation audit

Inspected published source `c2b090e51ec74c0433d368adde9c150686686b2f` for
`admin-ai-parity-platform`. This is implementation planning evidence. It does
not establish AI parity or accept any of the card's eight acceptance items.

## Current operations

| Entry point                  | Semantic operations                                                                                                       | Current owner                                    | Conversational status                                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/admin/features`        | List cards; read immutable history; create/edit definitions; replace dependencies; reorder; planning transitions; archive | `revenue-os/work-board.ts`                       | Implementation gap: founder proposals and exact human approval are absent. Preserve revision, request-key and audit checks.                                                      |
| Same route                   | Claim, resume, checkpoint, heartbeat, progress, block, release and submit implementation work                             | Same service and canonical dispatcher            | Existing scoped worker HTTP/MCP/CLI operations. These do not grant founder authority or self-review.                                                                             |
| Same route                   | Review, recover, reopen, recovery policy and delivery records                                                             | Same service                                     | Founder/operator controls. Review must remain a human decision; AI cannot accept its own implementation.                                                                         |
| `/api/admin/features/views`  | List shared/owned views; save a view; delete an owned view                                                                | `saveWorkView`, `deleteWorkView`                 | Implementation gap. Writes have no reviewed proposal, revision precondition or immutable command receipt.                                                                        |
| `/api/admin/features/agents` | List credential metadata; issue a credential once; revoke                                                                 | `issueWorkAgent`, `revokeWorkAgent`              | Credential issuance/reveal is a secure human handoff. Never return credential values to AI. Revocation lacks a conversational approval adapter.                                  |
| `/api/admin/tenants`         | List workspaces and memberships                                                                                           | Platform directory, or current-user tenant reads | Founder read adapter missing. Tenant reads must retain their existing scope.                                                                                                     |
| Same route                   | Create a provisioning workspace                                                                                           | `createTenantWorkspace`                          | Implementation gap. Creation and optional invitation can have different outcomes.                                                                                                |
| Same route                   | Activate, suspend, archive                                                                                                | `setTenantLifecycleStatus`                       | Implementation gap. Existing RPC locks the row and audits transitions, but accepts no reviewed expected state. Preserve bootstrap/archive guards.                                |
| Same route                   | Invite/resend administrator access; revoke membership                                                                     | `inviteTenantAdmin`, `revokeTenantAdmin`         | Implementation gap. Invitation receipts distinguish sent, not-required, failed and unknown; provider acceptance is not recipient delivery. Preserve owner revocation protection. |
| `/api/admin/login`           | Password authentication                                                                                                   | Supabase Auth                                    | Secure human handoff. Never ask a model to receive or submit a password.                                                                                                         |
| `/api/admin/password-reset`  | Request recovery without disclosing account existence                                                                     | Supabase Auth/Resend                             | Secure human handoff. Recovery links and tokens stay outside AI results.                                                                                                         |

The inspected clients are `admin/features/page.tsx`, `admin/tenants/page.tsx`
and the shared `work-board/WorkControls`, `WorkViews` and `WorkAgents` components.
They adapt these routes rather than writing directly through a browser database
client. The controls also maintain local filters, saved-view links and a temporary
claim credential; these are not additional business mutations. Feature-board
column configuration uses the shared Kanban owner and still needs its own
semantic review before the full card can satisfy AC1.

## Blocking authority and privacy gap

`requirePlatformAdmin` authenticates the human at the HTTP boundary. The shared
AI tool context has no separately authenticated founder command context. Tenant
MCP and worker credentials must not receive platform commands by adding them to
the existing tenant tool packs.

The existing approval and trace records are tenant-owned. `action_queue`,
`audit_log`, `agent_runs`, `agent_run_events`, `ai_conversations` and `ai_messages`
have no platform-command owner field. An application-level founder check does
not make platform payloads private from other authorized members of that tenant,
and API filtering alone would not protect direct database reads. Platform tools
must remain absent until owner isolation covers proposals, results, traces and
their child records.

The bounded prerequisite `platform-private-command-context` must extend these
existing owners with fresh founder authentication, immutable private ownership,
and database-enforced isolation. It must retain tenant membership checks,
existing shared records, approvals, expiry, replay, audit and recovery. No
parallel proposal queue or privileged tenant MCP interface is needed.

## Remaining implementation

After the prerequisite is verified, finish the semantic inventory, register
founder-only read/preview/propose adapters in the existing registry, and bind
exact approvals to canonical revision-checked services. Saved views and tenant
lifecycle commands need their owning services' freshness/replay guarantees
before exposure. Credential reveal, authentication and consent remain human
handoffs. Complete the live card's service, denial, stale state, replay,
five-business demo, desktop/mobile and build evidence before submission.

No platform write tool, database migration, provider effect or production change
was introduced by this audit. The original setup integration in PR #232 remains
a separate verified, unmerged handoff.
