# Tenant cutover release and activation runbook

This runbook executes Feature Board card `tenant-isolation-cutover`. It does not
grant release authority. Production migration, deployment, provider activation,
or a real client invitation begins only after an explicit founder instruction
for that release.

## Fail-closed stages

The cutover advances through four machine-checked stages. A blocked result stops
the release; do not waive a check verbally or edit a receipt to manufacture a
pass.

1. `npm run verify:tenant-cutover -- --stage=repository`
   requires `main`, a clean tree, exact upstream synchronization, no additional
   worktree or unmerged local branch unless each is explicitly named with
   `--exclude-worktree=<branch>` in the recorded release command, and all
   cutover files committed. Exclusion preserves unrelated investigation work;
   it never makes that work part of the release.
2. After authorized application of
   `migrations/20260831-tenant-suspension-guards.sql`, run
   `npm run verify:tenant-cutover -- --stage=post-migration`. The production
   database must enforce the just-in-time active-tenant guard while preserving
   the already-completed tenant-composite uniqueness cutover: every temporary
   and original-name global uniqueness artifact remains absent, and both former
   business-key primary keys remain tenant-composite.
3. Deploy the exact verified commit. Run the complete verification matrix,
   create the release receipt below, then run
   `npm run verify:tenant-cutover -- --stage=post-deploy -- --receipt=<path>`.
4. Before activating one controlled client, run
   `npm run verify:tenant-cutover -- --stage=pre-activation -- --tenant=<slug> --receipt=<path>`.
   The target must still be provisioning or suspended, all compatibility
   indexes must be gone, no non-bootstrap tenant may already be active, and no
   client provider connection may be enabled.

The database stages are read-only. They target only the fixed Accelerate Supabase
project through `scripts/lib/accelerate-database.mjs` and never print credentials.

## Release receipt

Store the receipt with the release handoff, not with secrets. It must use this
shape and name only evidence that was actually observed:

```json
{
  "version": "tenant-cutover-release.v1",
  "commitSha": "40-character verified commit",
  "deploymentReceipt": "immutable Vercel deployment identifier",
  "canonicalAlias": "https://www.acceleratewith.us",
  "migrations": {
    "suspensionGuard": "passed",
    "uniquenessCutover": "passed"
  },
  "verification": {
    "schema": "passed",
    "isolation": "passed",
    "providers": "passed",
    "adminRoutes": "passed",
    "rollback": "passed"
  },
  "activationTarget": "controlled-client-slug"
}
```

Required evidence includes `npm run db:verify-schema`, tenant migration,
isolation, lifecycle and suspension tests, provider and webhook defenses, the
authenticated retained-route desktop/mobile matrix, canonical alias checks, and
the rollback proof that suspension preserves tenant rows and receipts.

The controlled live isolation proof mutates only the two reserved `.invalid`
fixtures and therefore requires an explicit command acknowledgement:

```bash
npm run verify:tenant-production-isolation -- --confirm-controlled-production-isolation
```

It validates the fixed Supabase project before mutation and suspends every proof
tenant in a `finally` cleanup even when an assertion fails. Never substitute a
real tenant slug, email, contact, credential, or provider recipient.

## Rollback

If any post-deploy check fails, stop activation. Suspend every non-Accelerate
tenant through the audited lifecycle service; do not delete tenant data, restore
global uniqueness, or return to an unscoped application path. Preserve provider,
message, activity, audit, migration, deployment, and failed-check receipts.
Reconcile uncertain external effects before retrying. A code rollback may target
only a compatible tenant-aware commit; the tenant schema remains in place.
