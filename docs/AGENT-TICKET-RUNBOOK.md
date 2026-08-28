# Agent ticket runbook

Use this procedure for every managed Feature Board card. It is deliberately
explicit so an agent can resume safely without relying on undocumented context.

## 1. Orient and claim

From `accelerate-site/`:

```bash
git status --short
npm run verify:agent-contract
npm run seed:features -- --verify
```

Preserve unrelated changes. Find the card by stable key or exact title in
`scripts/feature-backlog-data.mjs`. Read its description, dependencies, starting
points, guardrails, acceptance criteria, and current evidence. Read every directly
linked service/migration before editing.

Do not start when a dependency is genuinely unmet. Set the card Owner to a
specific agent identity, set `in_progress`, and record the intended slice in the
manifest. Reconcile intentionally:

```bash
npm run seed:features -- --apply
npm run seed:features -- --verify
```

The manifest is the durable managed-card definition. The board is the operational
projection. A live-only managed-card edit will be overwritten by reconciliation.

## 2. Write the implementation contract

Before code, answer in the card evidence or working notes:

- What observable business/operator outcome changes?
- Which canonical entity and service own it?
- Which entrypoints and downstream consumers are affected?
- What is the idempotency/replay/concurrency boundary?
- Is the impact read, internal write, external action, or destructive?
- What confirmation, audit, activity, run, or provider receipts are required?
- What failure/degraded states must remain usable?
- Which acceptance items require local versus production evidence?

If those answers conflict with `REVENUE-OS-ENGINEERING-CONTRACT.md`, stop and
raise an architecture decision instead of inventing an exception.

## 3. Implement through the authoritative path

1. Extend the existing module named in `src/lib/revenue-os/README.md`.
2. Keep route/UI/provider adapters thin.
3. Validate and normalize at the boundary and again where the invariant matters.
4. Use canonical IDs and refuse ambiguous identity matches.
5. Claim work before side effects and reuse deterministic keys on retry.
6. Record canonical state, immutable receipt/activity, and audit evidence.
7. Expose truthful loading, empty, degraded, error, success, and recovery states.
8. Preserve compatibility records until their reconciliation acceptance passes.

When a required primitive is missing, add it as a separately testable service or
dependency card. Do not bury a framework replacement inside a feature route.

## 4. Verify the failure matrix

Always run:

```bash
npm run verify:agent-contract
npx tsc --noEmit
npm run lint
git diff --check
```

Before a shipped handoff:

```bash
npm run build
```

Then run the scoped test named by the card. For admin work, use the repository
Playwright scripts, not an in-app browser dependency. Open and inspect generated
screenshots. For material data/automation work, prove at least:

- authorized happy path;
- invalid/unauthorized input;
- duplicate or replay;
- concurrent or stale state where relevant;
- provider/database failure;
- truthful terminal receipt;
- safe retry or explicit reconciliation;
- no duplicate external effect.

Never claim production acceptance from local mocks. Never run destructive tests
against uncontrolled production records.

## 5. Record evidence and hand off

Update the card’s `evidence` with:

- exact files and authoritative services changed;
- migrations or environment/setup impact;
- commands run and pass/fail results;
- screenshots or production receipt identifiers without secrets;
- decisions and guardrails preserved;
- known limitations and exact remaining work;
- discovered follow-up card keys.

Set `shipped` only when every acceptance item is evidenced. Otherwise keep
`in_progress` and state what remains. Clear or transfer Owner explicitly. Apply
and verify the board manifest again.

### Release gate

Do not deploy as an automatic final step. A production release requires an
explicit founder instruction to deploy, publish, promote, roll back, or get the
completed work live. Treat that instruction as authorization for the named
release only, not as standing permission.

After explicit release authorization:

1. Inspect `git status --short`, `git worktree list --porcelain`, and local
   branches not merged into the release branch.
2. Reconcile every completed, in-scope agent change. Preserve incomplete,
   unrelated, or ambiguous work and stop if safe ownership cannot be established.
3. Run the required verification against the complete release tree, commit it,
   and confirm the release branch and its upstream point to the intended commit.
4. Build and deploy that exact commit. Any post-verification change reopens the
   verification gate.
5. Record the commit SHA, deployment receipt, canonical alias, live checks, and
   clean/synchronized repository evidence in the handoff.

## 6. Recovery and rollback

- Code regression: revert only the scoped change; preserve unrelated worktree
  edits. Do not use destructive repository resets.
- Migration problem: stop writers that depend on the new schema, keep compatible
  reads/fallbacks active, and use an additive corrective migration.
- Provider uncertainty: pause further work, preserve the claim, reconcile the
  provider receipt, then retry only if no side effect occurred.
- Automation incident: pause the campaign/job/source, record the failed/partial
  run, surface backlog, and link a recovery card/runbook.
- Bad AI action proposal: reject/expire the queue item; do not edit history.
- Bad canonical merge: stop downstream automation and create an identity-review
  item; never silently merge or delete provenance.

Escalate when safe recovery needs new authority, destructive action, a new
provider, real customer contact, or production data mutation beyond the card.
