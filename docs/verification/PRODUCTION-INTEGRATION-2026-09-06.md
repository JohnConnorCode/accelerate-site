# Production integration checkpoint, 2026-09-06

This is a local integration receipt, not a production-readiness or deployment
claim. Branch: `agent/production-integration`. Base: `5965b879e0a4123d9ef3da51f3ae38e40609ecfe`.
Merged source: `agent/verification-workflow-efficiency` at `31b14ea`, including
work-completion truth at `1bbc1e9`. The merge commit containing this document
identifies the checkpoint; no external deployment occurred.

## Reconciliation

- Retained the newer live work-board protocol, tenant-bound AI context,
  canonical autonomy policy, atomic model resource reservations, durable
  action/work/run links, and stale-claim recovery from the integration base.
- Combined those contracts with explicit completed, skipped, deferred, partial,
  failed and awaiting-approval results, exact active-claim settlement fences,
  truthful activity and bounded retries.
- Draft preparation completes only from a valid durable proposal. Generic
  action work waits for execution receipts. Neither a proposal nor model prose
  proves an external action was executed.
- Added a foreign-tenant work guard before model/run creation and corrected
  mixed failed/awaiting-approval cycle reporting.
- Preserved the fast staged-only commit hook and fail-closed CI aggregation.
  Qualified two Workshelter source references so repository hygiene checks
  distinguish external provenance from local documentation.

## Local resource controls

Builds and typechecks use the per-user cross-worktree resource gate. Local review
runs its core suite through the same gate. Other heavy QA commands must use
`npm run resources:run -- <command> [args...]` as required by `AGENTS.md`.
Five focused tests cover exclusivity across processes, memory/disk policy,
process-group accounting, real child exit and spawn failure, and termination on
capacity loss. The gate limits Node heaps and monitors the job's resident memory;
it is not a hard OS quota or control over unrelated applications.

Removed only the completed work-completion checkout's disposable dependency
copy and the completed workflow checkout's symlink to it, after verifying clean
source trees and no processes using those checkout working directories. Current
integration reuses the existing integration dependency installation. No unrelated
application was force-quit.

## Passing evidence

- `npm run test:work-completion`: 38 cases.
- `npm run test:runtime-consolidation`: database error gates, tenant boundaries,
  typed outcomes, bounded retries, claim fences, cycle summaries, policy
  revocation and observations versus authority.
- `npm run test:verification-workflow`: 15 cases and 16 CI aggregate combinations.
- `npm run test:resources`: five cases, including real child-process behavior.
- `npm run verify:agent-contract`, `npm run verify:runtime-boundaries`,
  `npm run verify:oss`, and `npm run verify:build-plan`.
- Actionlint against `.github/workflows/ci.yml`.
- Scoped ESLint for the new resource gate/tests and changed runtime regression,
  work executor and coworker agent files; touched-file Prettier; `git diff --check`.

## Outstanding verification and handoff

The resource gate refused the integrated build with 4.4 GiB available disk;
startup requires 5 GiB. No build was launched and no pass is claimed. Full
integrated core tests, full lint, TypeScript/build, PostgreSQL regression and
browser verification remain outstanding. Earlier branch evidence does not
substitute for verification of this reconciled source.

Local `main` has not been advanced to this checkpoint. Production was not
changed. GitHub access is available, but remote main is substantially behind
local main (481 files differ before this merge); running PR CI would also publish
that broader local integration. This checkpoint does not publish it merely to
work around local capacity.

The current scoped work-board token is not configured. No obsolete service-role
writer was used and no live card review/shipped state was fabricated. Submit
exact-commit evidence through the current protocol after required verification
and scoped credentials are available.
