# Collections workspace and shared demo verification

Card: `receivables-workspace-demo`. Base: approved reminders `58ec552`.
No production deployment, hosted migration, customer sends or Docker were used.
This receipt accepts the bounded native workspace reference, not the unfinished
third-party SDK, installer or universal custom-record view framework.

## Architecture and integration correction

`CollectionsWorkspace` is the single admin/demo screen. `collection-workspace.ts`
reads canonical cases, current observation references, contact IDs, WorkItems,
events and reminder actions/receipts. Reads are tenant-bound, bounded and expose
freshness/truncation; opening the screen never calls a provider. The same case
links and WorkItem IDs appear in Today and customer records. Policy schemas,
summary calculations and the branded reminder renderer are shared with the demo.

Real adapter integration exposed a gap missed by the earlier service fixtures:
`requireAdmin()` returns an authenticated RLS client, while Collections mutation
RPCs deliberately require host authority. `callCollectionHostRpc` now bridges
only four named operations, after matching the current actor/database/tenant and
rechecking active admin membership and tenant lifecycle. It returns RPC receipts,
never a privileged client. SQL still refuses direct authenticated observation
writes. Unknown operations and revoked/suspended/mismatched contexts cannot
escalate. Background clients are not silently elevated.

The Plugins page now derives native workspace entries from the extension registry
alongside workflow/report entries. Collections has a manifest-owned route and
navigation entry, a real enable/disable control, and registered API guard coverage.
No Collections-specific catalog exception or copied demo page was introduced.

## Acceptance evidence

- AC01: six cases per fictional business show overdue, partially paid, disputed,
  future promise, missed promise in a second currency and already settled facts.
  The workspace exposes source invoice IDs, observation dates and next actions.
  USD/EUR totals remain separate; missing evidence fails closed on the live read.
- AC02: browser journeys edit owner policy, persist it across reload, preview the
  shared branded email, queue exact content and approve through the canonical
  action API. Real host fixtures cover authorization and read-model joins;
  previous native SQL proof remains the persistence/receipt authority.
- AC03: Today and customer links read the same canonical WorkItems and case IDs.
  Native SQL writes remain the source of work/activity truth. Browser journeys
  follow both shared links. Receipt-only recovery displays the canonical attempt
  separately from a previously failed action; it never sends another message.
- AC04: all five business packs run the actual admin route/component against the
  shared session demo engine. Source invoices, cases, actions and receipts stay
  linked. The payment-before-approval fixture produces a skipped failed action;
  a separate partial-payment case produces a confirmed simulated send receipt.
- AC05: `qa:collections-workspace` passed at 1440 and 390 widths in all five packs:
  persistence/reset, module toggle retention, customer/Today navigation, keyboard,
  reduced motion and zero escaped API/provider requests or browser console errors.
  Paper/Night screenshots were captured and opened/inspected; mobile metrics use
  a compact two-column layout. Artifacts are in
  `/tmp/accelerate-collections-workspace/collections-{390,1440}-{Paper,Night}.png`.
- AC06: shared `collectionSummary` exposes last-observed eligible balances by
  currency, cases with recorded handling, missed promises and verified paid invoice
  count. Copy explicitly separates observed payment from reminder attribution.
  Cooldown follows confirmed send time and configured hours; test invoice reminders
  are labeled in both subject and content.

## Repeatable checks

- `npm run test:collections-workspace` runs actor bridge and host read fixtures,
  then all five scenario engines with stale/replay/disable/reset cases.
- `npm run test:collections-reminders`, `npm run test:collections-lifecycle` and
  `npm run test:demo-business-workflows` verify the underlying business paths.
- `npm run qa:collections-workspace` against the local app on port 3036.
- Types, strict lint, module/route/runtime/agent contracts, public documentation
  and source statistics, build, and `git diff --check` are required commit gates.

## Limits retained explicitly

The workspace displays up to 100 recent cases, 50 invoice operation choices and
bounded recent history. Invoice evidence reads page in bounded batches and refuse
incomplete results. The host supports up to 25 invoices per refresh/reminder.
The module does not scan/import an entire Stripe account, infer payment attribution,
send autonomously, or install untrusted native server code. Hosted first-owner
installation proof and generalized plugin SDK/conformance remain live backlog work.
