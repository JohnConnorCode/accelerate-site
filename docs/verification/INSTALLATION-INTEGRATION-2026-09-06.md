# Installation integration checkpoint

Reconciles `941bf9c` (installation migrations and credential-free exploration)
into the production-integration checkpoint `6019097`. Source worktree was clean.
The source receipt is [installation verification](TURNKEY-INSTALLATION-2026-09-06.md).

Resolved package/CI conflicts by retaining resource-gated local builds,
fast commit hooks, independent CI checks/build jobs and fail-closed aggregation,
while adding migration catalog, PostgreSQL ledger and public-roadmap checks.
No database migration or provider operation was performed during integration.

Passing on the reconciled tree: migration catalog (63 ordered files), catalog
regressions including target mismatch refusal, public-roadmap absence/outage
behavior, and Actionlint. Earlier source-branch PostgreSQL/browser evidence is
retained as source evidence; it does not claim the integrated build passed.

The earlier receipt's decision to keep the branch local is superseded by the
continued integration task: a draft integration PR will run GitHub Actions to
verify the accumulated source away from the resource-constrained development
machine. Public/default-branch release and production deployment remain separate.
The hosted two-tenant upgrade preservation and first-owner sign-in gates from the
source receipt remain outstanding.
