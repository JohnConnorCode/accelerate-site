# Agent ticket runbook

Use this procedure for every managed Feature Board card. It is deliberately
explicit so an agent can resume safely without relying on undocumented context.

## 0. Read the northstar first

Read `docs/NORTHSTAR.md` before picking up any card. It defines what Accelerate
is building: an **agent-native business runtime** with five product layers
(See → Remember → Notice → Act → Learn), five implementation phases (A–E), and
ten architectural principles that govern every decision. Every card on the board
maps to a northstar phase; every card's notes include that mapping. When
implementation choices arise, the northstar principles resolve them.

Key concepts you will encounter on the board:

- **WorkItems** (Phase B): durable, lease-based, explainable units of work — not cron→prompt→hope
- **Coworkers** (Phase C): first-class identities configured over the shared runtime — not separate LLMs
- **Capability Graph** (Phase B): one canonical source of workspace capabilities and policies
- **Autonomy Policy Engine** (Phase B): five-level ladder from Prohibited to Autonomous, with hard safety floors
- **Evidence & Claim Ledger** (Phase B): evidence-backed facts; models propose, deterministic rules verify
- **Tool Registry**: all agent actions go through narrow business-action tools, never raw SQL or unrestricted APIs
- **Human truth hierarchy**: human-confirmed > human-entered > verified external > model inference

## 1. Orient and claim

From `accelerate-site/`:

```bash
git status --short
npm run agent:next
```

`agent:next` atomically claims one dependency-ready card (advisory lock +
lease — two agents racing the same card, exactly one wins, the other gets a
different card or `wip_limit_reached`), creates an isolated worktree +
branch so this claim can't collide with another agent's uncommitted changes
in a shared tree, and prints the full context in one call: description,
dependencies, starting points, guardrails, acceptance criteria, and current
evidence. That replaces hand-reading `scripts/feature-backlog-data.mjs` for
this step. Still read every directly linked service/migration named in the
"Starting points" line before editing.

Do not start when a dependency is genuinely unmet — release it
(`npm run agent:release -- --card <id>`) and claim something else instead.
`owner`/`status`/the lease are live-managed columns now: never hand-edit
them in the manifest, and `npm run seed:features -- --apply` deliberately
ignores those two fields on an existing row, so a manifest edit to either
is silently a no-op. Everything else about a card (title, description,
acceptance, dependencies, labels) is still manifest-owned; edit it there
and reconcile with `npm run seed:features -- --apply` then `--verify`.

WIP admission is enforced by the atomic claim service, including the dispatcher's
explicit `--force` override. Manifest verification checks card definitions and
mirrored state; it does not impose a second concurrency gate that would prevent
already-claimed work from completing.

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

Set `shipped` only when every acceptance item is evidenced:
`npm run agent:complete -- --card <id> --evidence "<the evidence above>"`
appends it to the card's notes, marks it shipped, and removes your
worktree. Otherwise keep `in_progress` and state what remains — running
long is fine, renew with `npm run agent:heartbeat -- --card <id>` before
the lease expires; abandoning entirely is
`npm run agent:release -- --card <id>`, which returns it to backlog for
someone else to pick up and leaves the worktree in place to inspect. Any
manifest field besides the live-managed `owner`/`status`/lease (title,
description, acceptance, dependencies, labels) still needs its own
`npm run seed:features -- --apply` / `--verify` if you changed it.

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
