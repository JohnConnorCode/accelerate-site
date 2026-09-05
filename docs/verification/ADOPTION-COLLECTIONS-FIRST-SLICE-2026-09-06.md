# Adoption backlog and Collections Action Desk first slice

The live Feature Board is authoritative. This is a dated handoff index, not an
independent roadmap or a bulk-overwrite manifest. Founder instruction: expand the
platform-adoption backlog with detailed cards, then plan and begin a substantive
business plugin. Base: `main` at `5965b879e0a4123d9ef3da51f3ae38e40609ecfe`.

## Backlog delivery

Nineteen cards were created or expanded through the canonical revision-checked
work service: nine new cards and ten updates, with 116 named acceptance items.
Each carries business value, ordered implementation, scope/exclusions, source
references pinned to the merged base, verification, northstar phase and dependency
keys. Existing owner/status and historical notes were preserved. Seventeen UUID
dependency updates were applied after checking the entire live graph for cycles.

| Card key                             | Change   | Acceptance items |
| ------------------------------------ | -------- | ---------------- |
| `release-migration-ledger`           | New      | 7                |
| `install-runbook`                    | Expanded | 6                |
| `guided-first-run-setup`             | Expanded | 6                |
| `first-value-business-journey`       | New      | 6                |
| `runtime-record-permission-contract` | New      | 6                |
| `custom-data-model`                  | Expanded | 6                |
| `plugin-record-view-contract`        | Expanded | 6                |
| `csv-hubspot-importers`              | Expanded | 6                |
| `plugin-cli-and-scaffold`            | Expanded | 6                |
| `plugin-contract-versioning`         | Expanded | 6                |
| `plugin-install-lifecycle`           | Expanded | 6                |
| `plugin-conformance-kit`             | Expanded | 6                |
| `plugin-developer-documentation`     | Expanded | 6                |
| `release-restore-upgrade-proof`      | New      | 6                |
| `release-performance-envelope`       | New      | 6                |
| `receivables-decision-engine`        | New      | 7                |
| `receivables-case-lifecycle`         | New      | 6                |
| `receivables-approved-reminders`     | New      | 6                |
| `receivables-workspace-demo`         | New      | 6                |

Versioning no longer waits for registry publication; local CLI/conformance work
precedes distribution. The generic record view contract now depends on the custom
record model instead of an unrelated support-demo gate. Existing installation,
manifest, identity and compensation dependencies were retained where applicable.
This is staged delivery, not a claim that the prerequisite implementations exist.

## Plugin choice and business result

**Collections Action Desk** is the first new business plugin. Its parent remains
`receivables-collections-plugin`. It must move verified overdue invoices through
account/currency cases, reviewed reminders, payment promises, disputes, follow-up
work and provider-confirmed settlement. It cannot be accepted as a read-only report.

The four child cards separate deterministic decisions, persistent cases/provider
observations, approved reminders and the integrated operator/demo experience.
The first child can be implemented against the already accepted isolate/runtime
without skipping the parent's uncompleted installation and UI dependencies.

## First slice implementation

`plugins/receivables-collections/contract.ts` validates bounded, fresh and complete
invoice observations, explicit policies, exact minor units, expected tenant,
unique identities and real UTC dates. `plan.js` runs in the existing QuickJS
isolate with one read binding. `evaluate.ts` supplies a development/conformance
entrypoint and source-hash receipt; it is not a new live plugin host.

The decision code groups eligible invoices by account/currency, retains exclusions,
respects suppression, promises and cooldowns, and routes broken promises to review.
It returns stable source-linked actions instead of fabricated provider outcomes.
The fictional CLI example consolidates USD 125 and USD 75 invoices into one USD
200 reminder decision and excludes a separate USD 50 disputed invoice.

Commands: `npm run preview:collections` and `npm run test:collections`.
No credentials, schema changes, provider calls, sends, installation/activation or
live UI are required or claimed by this slice. The full plugin remains unfinished.

## Verification and handoff

The real-isolate suite covers grouping, partial remaining balances, separate
currencies, non-open/settled/disputed/paused invoices, missing/due-today dates,
promises, suppression precedence, exact cooldown/freshness boundaries, leap dates,
duplicate IDs, missing policies, future timestamps, stale/incomplete observations,
tenant binding, invalid/overflow money, 100-invoice bounds and deterministic order.
The README records the exact next-slice host responsibilities and limitations.

Normal typecheck, lint, agent contract, build and diff checks accompany the commit.
Logs are `/tmp/collections-*.log`. No browser proof is claimed: no UI changed.
The first child is submitted separately for review; no parent completion or
production/provider proof can be inferred from these deterministic fixtures.

## Installation issue found during verification

A credential-free full application build compiles and typechecks, then fails
prerendering `/roadmap`: `src/lib/roadmap.ts` calls
`createPlatformServiceRoleClient` without a configured Supabase URL. The detailed
reproduction is recorded on `install-runbook`. This is separate from the new
collections preview/tests, which passed without provider/database credentials.
The full application build is verified with the existing configured environment;
this does not establish the missing credential-free installation acceptance.
