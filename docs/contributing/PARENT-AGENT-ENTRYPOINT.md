# Accelerate agent entrypoint

The application repository is `accelerate-site/`. It may be checked out to an
active feature branch with unfinished work. Do not switch it, reset it, or assume
that its startup scripts are the published version.

For a new backlog request, use the clean published-main control checkout at
`.agent-worktrees/control-main/`. Read its `docs/NORTHSTAR.md` first, then its
`AGENTS.md`; that is this repository's canonical engineering and handoff contract.
Run from this parent directory:

```sh
npm --prefix .agent-worktrees/control-main run agent:go -- --json
```

A plain-language request to pick up work and finish it authorizes this flow. The
user does not need a card key or command name. Continue in the isolated worker
checkout printed by the runner through implementation, verification, commit and
handoff submission. Never implement ticket work inside the control checkout.
Resume an already claimed task in its existing worker checkout.

Work volume is advisory, never a reason to stop authorized work or ask the founder
to clear a slot. A request to resume a named expired task authorizes its atomic
revision-checked continuation without another approval. Preserve the retained
checkout, unfinished changes and audit history; never take over a live claim.
Machine resource gates and separate review/release requirements still apply.

The control checkout is a detached view of published `origin/main`. Before a
new pickup, fetch main through `accelerate-site`, verify the control checkout is
clean, and advance only that clean detached checkout to `origin/main`. If the
control checkout is missing, create it with `git worktree add --detach` at that
ref. Preserve any unexpected changes and use a new clean control checkout;
never reset another agent's work to repair startup.

The private board profiles live in the Git common directory and are shared by
worktrees. Let the runner resolve them. Never ask the user to paste credentials,
tokens or secrets, and never offer unclaimed work. Missing access is a precise
`SETUP_REQUIRED` result, not permission to invent a claim.

The active application and all worker source trees remain intact. Sibling
folders, generated output, environment files and production data enter a ticket
only when its scope or the user's explicit task includes them. Review, merge and
deployment retain their separate release requirements in the canonical contract.
