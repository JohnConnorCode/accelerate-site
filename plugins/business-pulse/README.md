# Business Pulse

Review pipeline risks, overdue commitments and upcoming meetings together. This is a deterministic, read-only report, disabled by default.
It does not contact customers, schedule work or change the underlying records.

## Run and inspect

1. Open **Plugins** (`/admin/plugins`) in an authorized workspace and enable
   **Business Pulse**. Configuration uses the shared module controls; this report has
   no additional settings or provider credentials.
2. Choose **Run report**. Inspect each finding and follow its linked source
   record before deciding what to do.
3. Check the inspected-row count and truncation flag in the report receipt.
   Results describe the inspected records, not an exhaustive business audit.

The report combines open opportunities with overdue next actions or updates older than seven days, overdue pending/snoozed tasks, and non-cancelled meetings in the next 48 hours.

The host reads tenant-scoped opportunities, tasks and calendar events using the bounded fields declared in its manifest). Each source is bounded
at 100 records, the combined snapshot at 64 KiB and displayed findings at 20.
The guest runs in QuickJS without network, database or filesystem access.
A run records its source-code hash, time and result in the shared agent trace.
The equivalent AI/MCP tool is `run_business_pulse`; the host rechecks current
activation even when a caller has stale configuration. The report itself requires
no business-write approval. AI chat surrounding it uses the workspace's model.

## Example and verification

A fictional stale deal, overdue task and upcoming meeting produce three findings. Run `npm run test:report-plugins`
from the application root for the controlled fixture, all four reports, tenant
isolation, disabled execution and source/output refusals. The fixture does not
connect to a real customer's database. `npm run test:plugin-isolate` exercises
sandbox limits. These tests do not prove every deployment's source registrations.

## Cost, disable and recovery

Report evaluation makes no model or paid API request. Hosting and database usage
still apply. A conversational request can incur the workspace model's charges.
Turn the plugin off in **Plugins** to stop new evaluations; a disable during
source acquisition also prevents publishing the result. Existing source records
and audit receipts remain.

An empty result means no matching findings in the inspected snapshot. For
missing readable-source errors, verify workspace entity registration using the
[extension guide](../../docs/contributing/EXTENDING.md). For truncation, inspect
the underlying business records; do not infer that uninspected records are clear.
For a failed run, correct access/source configuration and rerun. Repeating this
read-only report does not create tasks or send messages.

## Extend

Edit [`report.js`](report.js) and the
[manifest](../../extensions/business-pulse.module.json), preserving the declared source
fields and referenced record IDs. Reuse
[`report-plugins.ts`](../../src/lib/revenue-os/report-plugins.ts) and
[`plugin-host.ts`](../../src/lib/revenue-os/plugin-host.ts); never add provider
access inside guest code. Run `npm run build:extensions`,
`npm run verify:extensions` and the scoped tests after changes. Follow the
[documentation contract](../../docs/contracts/PLUGIN-DOCUMENTATION.md).
