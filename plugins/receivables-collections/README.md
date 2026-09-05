# Collections Action Desk

**Status: default-off native business workspace with durable cases, approved reminders and five shared demos.**
The live Feature Board parent is `receivables-collections-plugin`. The decision
engine runs in the existing QuickJS isolate; the host loads authorized Stripe
facts, persists cases and schedules WorkItems. The operator workspace and demo
use the same admin route and components. Generalized SDK installation and
third-party conformance remain separate backlog work.

## Business outcome

An operator should recover overdue balances with fewer missed follow-ups and
without sending duplicate or inappropriate reminders. The complete workflow is:
verified invoice facts → account/currency case → next safe action → reviewed
reminder or payment promise/dispute → fresh approval checks → receipt → settlement.

A report alone does not meet the parent card's acceptance. The dependent cards
`receivables-case-lifecycle`, `receivables-approved-reminders` and
`receivables-workspace-demo` deliver persistence, actual effects and shared UI.

## Run the first slice

From the application repository with dependencies installed:

```sh
npm run preview:collections
npm run test:collections
```

The fictional example has two eligible invoices totaling USD 200.00 and a USD
50.00 disputed invoice. It returns one `prepare_reminder` decision referencing
only the two eligible invoices, plus an explicit exclusion for the dispute.
No provider or database credentials are needed. The fixed historical `asOf` is a
simulation clock; this is not evidence of current invoice balances.

To inspect another controlled fixture:

```sh
npm run preview:collections -- ./snapshot.json 00000000-0000-4000-8000-000000000001
```

Custom input is labeled unverified. Passing its schema does not prove provider
provenance, account ownership, permissions or activation. Never use this developer
preview as an authorization or sending endpoint.

## Input and decision contract

`contract.ts` owns the v1 closed input/output schemas. `plan.js` is the pure
business program. `evaluate.ts` is the shared live/conformance adapter into the
existing isolate, with 250 ms execution budget, 8 MiB heap and a source hash.
The only binding is the already-validated snapshot. There are no network,
filesystem, database, credentials, model or mutation bindings inside the isolate.

A snapshot names one expected tenant, a UTC `asOf`, a provider observation time,
completeness, up to 100 unique invoices and explicit account/currency policies.
Observations must be no more than 15 minutes old relative to that snapshot clock.
The live adapter chooses the server clock and establishes complete,
authorized provider/account facts for the explicitly tracked invoice set. A truncated provider page must refuse planning;
it must not set `complete: true` because 100 records were fetched successfully.

Supported currencies match the initial Stripe workflow: USD, EUR, GBP, CAD and
AUD. Remaining balances are authoritative provider minor units, never reconstructed
from opportunity values or summed across currencies. Partial payment uses the
verified remaining balance. Inputs are bounded to 100,000,000 minor units per
invoice and 64 KiB per validated snapshot. The host preserves provider
invoice identity and verifies account linkage.

Rules, in precedence order:

1. Exclude non-open, settled, disputed, paused, missing-due-date and not-overdue
   invoices, retaining one reason per excluded invoice. Due today is not overdue.
   `paused` is indefinite; `pauseUntil` includes the entire named UTC date.
2. Group the remainder by canonical account/currency, retaining sorted invoice IDs.
3. Communication suppression blocks a reminder, even for a broken promise.
4. A promise due today or later waits until the next UTC day after the promise.
5. A past promise with a remaining balance requires human review, not escalation.
6. A recorded reminder inside the configured cooldown waits to the exact boundary.
7. Otherwise prepare one consolidated reminder for human review.

Missing policies, inconsistent paid balances, duplicate identities, invalid dates,
future observation/receipt times, mixed tenants and incomplete/stale snapshots
fail closed. Empty complete input returns an empty plan. Input order cannot change
the plan. The engine does not resolve ambiguous customer identity or infer consent.

## Host integration

The host loads authorized live observations and persisted case policies from
canonical services. It owns permission/activation checks, provider paging,
completeness, immutable observation IDs and tenant-composite references. The
reminder service re-reads payment, hold, dispute, recipient, suppression and
plugin state immediately before the effect. A decision here is never permission
to send. Approved content and invoice facts bind a digest, code version, action
identity and provider idempotency receipt through the existing action executor.

No new database schema was needed for this first slice. The case migration depends
on the installation/migration-ledger repair, so the entire plugin can be reproduced
from an empty owned database rather than only the existing development environment.

## Durable case host

`src/lib/revenue-os/collections.ts` now refreshes up to 25 explicitly tracked,
platform-created invoices through the canonical Stripe reader. Cases group a
canonical CRM billing contact and currency. This scope does not claim to scan
every invoice in a Stripe account. A provider failure writes no partial batch;
absence never implies payment. Source metadata, connection version, mode,
customer and currency must match the original invoice action.

The case RPCs serialize ingestion and edits, reject stale revisions and older
observations, retain immutable events, and write canonical activities, audit and
WorkItems. Disputes and indefinite pauses cancel active pursuit. Promises and
timed pauses set the next check. Settlement requires every tracked case invoice
to have a verified paid status and zero remaining balance. Closed cases remain
history; disabling or upgrading never deletes them. No reminders are sent by
this layer. The approved-reminder service and shared workspace connect the operator
journey. Run `npm run test:collections-lifecycle`; it needs native PostgreSQL
client/server binaries and uses a disposable cluster without Docker.

## Approved reminders

`POST /api/admin/collections/reminders` takes `{caseId}` to create a current,
branded preview. Sending the same endpoint `{caseId,digest}` stages an expiring
`send_collection_reminder` action. The existing human approval executor performs
the effect; a preview or proposal never sends email.

The host determines recipients, amounts, invoice sets and Stripe payment URLs.
Approval binds the case revision, sender/reply identity, rendered content,
branding revision, decision source hash and current invoice facts. A changed
balance, dispute, pause, suppression, recipient or disabled module refuses the
send and retains a skipped action checkpoint. Language is deterministic in this
version; no additional AI provider is required or allowed to change billing facts.

One transactional case reservation excludes concurrent reminders. Canonical
`messages` records and `action:<id>` provider idempotency keys protect each send.
Uncertain acceptance blocks all further reminders for that case. Re-reviewing
the original failed action can reconcile a confirmed canonical provider receipt
without a second send. A retry never clears uncertainty or invents success.
Cooldown (default 72 hours, configurable 1–720) begins only at confirmed send time.

An external payment and an email provider cannot share a database transaction.
The host re-reads billing immediately before reservation; a payment occurring
after that read cannot be atomically recalled from an already accepted email.
This is not a promise of external transactional isolation.

```sh
npm run test:collections-reminders
COLLECTIONS_POSTGRES_PROOF=1 COLLECTIONS_REMINDER_POSTGRES_PROOF=1 npm run test:migration-ledger
```

These checks use controlled provider fixtures and disposable native PostgreSQL.
They do not send real customer mail or constitute hosted provider acceptance.

`PATCH /api/admin/revenue-os/actions` with `{id, decision: "reconcile"}` reconciles a known
dispatch receipt without sending, including after approval expiry or module
disable. Normal tenant authorization still applies. A failed action can remain
failed while this separate receipt correctly reports a late provider acceptance.

## Operator workspace and shared demo

Open `/admin/collections` after enabling Collections and Stripe invoicing. The
workspace shows last-observed balances per currency, invoice provenance and
freshness, ownership, promises/holds, reviewed content and execution receipts.
Today and customer records link to the same case WorkItems. Financial facts are
refreshed explicitly; opening a page does not contact a provider. Verified paid
invoice counts do not claim that the reminder caused the payment.

All five full admin demo packs use this exact workspace with session-owned
fictional cases and the shared reminder renderer. A controlled payment-before-
approval simulation proves that a stale queued reminder is skipped. Reset restores
the original scenario. Disabling preserves history; re-enabling restores access.
Native workspace extensions are discoverable and toggleable from Plugins.

```sh
npm run test:collections-workspace
npm run dev -- --port 3036
# Separate terminal, against that local server:
npm run qa:collections-workspace
```

The integration added a narrowly scoped authenticated-host RPC bridge: after
current membership/lifecycle checks, only the four host-owned Collections RPCs
may use tenant-scoped service authority. SQL remains host-only, so an authenticated
browser cannot inject provider observations. Test invoices are labeled in both
subject and content. Actual email dispatch still requires explicit human approval.

## AI and MCP workflow

Registry `revenue-os-tools.v6` exposes the same Collections domain services to
internal AI and the tenant MCP endpoint. These tools belong to the core and
outreach packs. Discovery respects workspace module configuration; the host
rechecks current tenant/module state on execution even if a client cached discovery.
The Collections module must be enabled. Preview/proposal additionally require
Stripe invoicing and a usable tenant-owned Stripe connection.

| Tool                          | Input                                                                                     | Result and authority                                                                                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_collection_cases`        | Optional `caseId`, `contactId`, `status` (`open`/`settled`), `maxCases` (1–10; default 5) | Recorded case/contact/invoice/observation/WorkItem IDs, last-observed balances, policies, next work and bounded recent history. No provider call or mutation.                                                           |
| `preview_collection_reminder` | `caseId`                                                                                  | Current host-verified recipient, amounts, invoice links, exact subject/text and digest. No proposal or email. HTML and connection internals stay on the host.                                                           |
| `propose_collection_reminder` | `caseId`, exact preview `digest`                                                          | Pending `send_collection_reminder` action receipt. The existing operator approval surface retains the complete content; the agent receives IDs/status/expiry and the WorkItem link when one was supplied by the server. |

Start with this MCP request:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_collection_cases",
    "arguments": { "maxCases": 5 }
  }
}
```

Use a returned `caseId` to preview, then pass that preview's digest to propose.
The proposal re-reads current facts. Payment, a new dispute/pause, suppression,
recipient changes or a disabled module can invalidate the preview. Tool failures
are MCP tool-error results, never fabricated success. Retrying the same valid
proposal returns the existing pending action. No Collections tool approves an
action, sends email, edits billing facts or accepts a caller-supplied tenant,
recipient, balance, payment URL or approval flag.

Case reads apply their case/contact/status/window filters before the database
query. Each returned case includes up to 25 invoice details and three entries
per history category; explicit truncation flags describe omitted details. Balance
summaries use the complete stored invoice references for the returned cases, stay
separate by currency and identify their observation scope. Missing evidence refuses
instead of becoming zero debt. Reads are not a live Stripe refresh. A response
above 48 KB is refused with guidance to narrow the request; stored action bodies
and reminder HTML are never returned as general agent context.

The demo capability surface shares these tool descriptors and the registry version,
and respects the same module toggle in all five fictional workspaces. The demo
assistant remains a simulation; these tests do not claim an actual external MCP
connection to a demo or AI-written reminder language.

Run `npm run test:collections-agent-tools` for the internal registry/MCP workflow,
query bounds, tenant and module refusal, pending-action replay, WorkItem/actor
provenance and all-five-demo capability checks. The shared controlled provider
fixture is also used by `test:collections-reminders`. No Docker or real email is
required. Scheduled case handlers and model-generated wording remain parent-card
work; adding these tools does not silently activate an unattended cadence.
