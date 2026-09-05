# Collections Action Desk — decision engine

**Status: first implementation slice; not an installed or enabled business plugin.**
The live Feature Board parent is `receivables-collections-plugin`. This slice is
`receivables-decision-engine`; it proves the deterministic business decisions in
the existing QuickJS isolate. It does not contact customers, load Stripe data,
persist cases, create WorkItems or register a new UI/AI tool.

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
business program. `evaluate.ts` is a development/conformance adapter into the
existing isolate, with 250 ms execution budget, 8 MiB heap and a source hash.
The only binding is the already-validated snapshot. There are no network,
filesystem, database, credentials, model or mutation bindings inside the isolate.

A snapshot names one expected tenant, a UTC `asOf`, a provider observation time,
completeness, up to 100 unique invoices and explicit account/currency policies.
Observations must be no more than 15 minutes old relative to that snapshot clock.
The future live adapter must choose the server clock and establish complete,
authorized provider/account facts. A truncated provider page must refuse planning;
it must not set `complete: true` because 100 records were fetched successfully.

Supported currencies match the initial Stripe workflow: USD, EUR, GBP, CAD and
AUD. Remaining balances are authoritative provider minor units, never reconstructed
from opportunity values or summed across currencies. Partial payment uses the
verified remaining balance. Inputs are bounded to 100,000,000 minor units per
invoice and 64 KiB per validated snapshot. The future host must preserve provider
invoice identity and verify account linkage.

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

## Host integration handoff

The next slice loads authorized live observations and persisted case policies from
canonical services. It owns permission/activation checks, provider paging,
completeness, immutable observation IDs and tenant-composite references. The
reminder slice must re-read payment, hold, dispute, recipient, suppression and
plugin state immediately before the effect. A decision here is never permission
to send. Approved content and invoice facts need a digest, code version, action
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
this layer. The approved-reminder and workspace/demo cards connect the operator
journey next. Run `npm run test:collections-lifecycle`; it needs native PostgreSQL
client/server binaries and uses a disposable cluster without Docker.
