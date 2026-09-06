# Development and integration baseline

Published `main` is the control-checkout baseline. Temporary `agent/*` branches
are candidates, not competing sources of truth. Before new work, fetch origin
and record the exact verified base. Existing tickets keep their approved bases;
never reset an active worktree merely because main advanced.

## One integration owner per candidate

The integration owner inventories worktrees and PR heads, includes only completed
handoffs, resolves conflicts, and verifies one pinned combined commit. Other
agents continue in their own worktrees. A new head does not silently join a run
already being verified. Publish one integration PR with included commits,
exclusions, test evidence and remaining release gates.

Use `npm run dev:doctor -- --maintainer --json` before integration or merge.
It checks the declared GitHub identity, single-owner review policy, required CI
and freshness of origin/main using read-only requests. It does not change branch
protection, fetch, claim work, merge or deploy. Connection failures are actionable
prerequisites, not permission to invent an account or bypass checks.

`workflow-policy.json` declares this installation's GitHub account and repository.
JohnConnorCode is the sole GitHub identity. PRs retain evidence and required
`verify` CI, strict updates and administrator enforcement; do not require that
account to approve its own PR. The integration owner reviews the code and results
before a normal merge. Team installations must explicitly design their review
policy rather than silently inheriting the single-owner configuration.

## Complete the handoff

1. Verify the exact candidate and recheck its head before merging. Squash merging
   is supported. A green source branch is not proof of a changed integration tree.
2. Record the merge receipt and compare the resulting main tree with the verified
   candidate. Squash merges change ancestry: retain the source-to-main receipt
   instead of repeatedly reporting the same work as unmerged.
3. Close superseded PRs only after verifying their heads were included. Retain
   branches, worktrees, dirty edits and active claims until ownership permits cleanup.
4. Update new-ticket baseline guidance to main. Live card definitions, acceptance
   and review remain on the Feature Board; do not rewrite active ticket bases.
5. Treat production as a separate action. Read deployment-target.json and run
   deploy:check with the correct account before pulling configuration or building.
   A failed account lookup is not evidence of a hosting suspension. Obtain explicit
   release authorization and verify hosted outcomes and recovery after deployment.

## Assigned work

The handoff includes the exact base, scoped board access, isolated test context,
acceptance checks and integration owner. `dev:doctor -- --board` verifies the
shared protocol without claiming. A missing connection should produce a concrete
sign-in or access step while independent work continues. Never substitute
production keys or claim fictional verification is live evidence.

Review and baseline history remain in the dated verification receipts. They are
historical evidence, not instructions to clone an obsolete integration branch.
