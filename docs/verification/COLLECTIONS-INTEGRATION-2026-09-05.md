# Collections integration receipt

Verified application revision: `50d0a574864ad45e8fdf6c74a870960d39b6247c`.
The integration merge `173be1b` joins the completed Collections workspace `7574b0a` with main
`0e39bfd`. Local verification and acceptance are separate from production rollout.
No Docker, hosted business migration, real customer send or deployment was used.

## Included work

- Installation migration ledger, native populated upgrade/replay proof and
  credential-free exploration.
- Real QuickJS Collections decisions, durable tenant cases and canonical
  WorkItems, digest-bound human-approved reminders, safe uncertain-send recovery.
- One native admin/demo workspace, all five fictional business packs, plugin
  enable/disable controls, Today/customer links and observed metrics by currency.
- Main's work-completion receipts, CI coverage, design token reconciliation,
  dependency security fix and fast commit/resource-budget workflow.

The merge preserves both core suites and adds Collections browser evidence to
CI. It fixes a new Collections error border to use the shared danger token,
updates public statistics from the resolved Git index, corrects stale plugin
README wording and exercises saves/approvals with keyboard activation in browser QA.

## Verification

Core suite, native populated migration replay, case lifecycle and reminder SQL
concurrency/tenant tests, controlled provider failure/recovery fixtures, strict
lint, changed-file formatting, architecture/module/runtime guards, generated docs
and public source statistics passed. Native concurrency proves two independently
approved actions acquire exactly one dispatch reservation. An unknown provider
outcome blocks further sends; recovery requires an authoritative message receipt.
The native harness disposes of its own clusters.

The original final-build attempt was deliberately terminated when another
project's build was found still running. Its receipt is retained as deferred,
not passing. The subsequent build completed compilation, types and pages but the old wrapper
returned `kill EPERM` during final cleanup and left its lock behind. PID 15326
and its build descendants were confirmed absent before explicitly removing that
owned stale lock; no other process was stopped.

Repair `50d0a57` checks group existence before final signalling and always releases
its lock/listeners if cleanup fails. Inspection errors still fail the command.
All eight resource tests pass, including capacity refusal, retained failure,
lock reuse and termination of a real surviving child. Limits were not raised.
Only the subsequent completed build satisfies final acceptance.

`npm run build` completed successfully on `50d0a57`, including TypeScript and
367-page generation, through the resource gate. The exact production build was
served locally on port 3036 without credentials. Both `qa-turnkey.mjs` and
`qa-collections-workspace.mjs` passed. The latter exercised all five packs at
1440 and 390 widths: keyboard policy saves/approvals, stale payment cancellation,
confirmed simulated receipts, plugin disable/enable retention, customer/Today
links and demo reset. No API/provider requests escaped and no browser console
errors occurred. Paper/Night screenshots at both widths were opened and inspected.
The owned browser contexts and local server were closed after verification.

Reproducible commands and retained local receipts:

- `npm run resources:run -- npm run test:core` — `/tmp/collections-integrated-core.log`.
- `COLLECTIONS_REMINDER_POSTGRES_PROOF=1 npm run test:collections-lifecycle`
  and `npm run test:collections-reminders` — `/tmp/collections-integrated-checks-complete.log`.
- `npm run test:resources` — eight passing behavioral tests after the cleanup repair.
- `npm run build` — `/tmp/collections-integrated-build-verified.log`.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3036 npm run resources:run -- sh -c
'node scripts/qa-turnkey.mjs && node scripts/qa-collections-workspace.mjs'`
  — `/tmp/collections-integrated-browser.log`.
- Screenshots: `/tmp/accelerate-collections-workspace/collections-{390,1440}-{Paper,Night}.png`.

## Repository and handoff limits

The current branch and main integration checkout must be clean before advancing
main. Other worktrees are preserved. The read-only inventory is retained at
`/tmp/collections-final-branch-inventory.json`.

- Separate Docs and Sales commits were not included: their live acceptance and
  integration readiness had not been established during this reconciliation.
- The separate bounded-context branch remains outside this merge; its card was
  planned without delivery evidence.
- Uncommitted work in the original checkout, backlog refinement, booking,
  inbound, proposals, system health and Workshelter baseline is preserved.

The live `receivables-collections-plugin` parent remains open with an exact
baseline and structured completed/remaining handoff. Its remaining scope includes
Collections AI/MCP/job adapters, grounded AI wording through the existing gateway,
explicit dispute reasons, disabled-plugin history access, complete lifecycle and
plugin conformance/contributor proof, and the production-only acceptance item.
The deterministic native reference is not a completed third-party plugin SDK.

Child acceptance records carry local evidence and a transparent founder-authorized
agent self-review reason. Review, merge and deployment remain distinct board facts.
