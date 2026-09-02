#!/usr/bin/env node
/**
 * Collapses the 37-command manual migration sequence documented in
 * docs/self-hosting/REVENUE-OS-SETUP.md into one command. Reuses run-migration.mjs
 * unchanged, one child process per file, in order — no behavior change to
 * how any single migration is applied, only to how many commands a fresh
 * clone has to type.
 *
 * Every migration in the manifest is additive/idempotent (see AGENTS.md), so
 * re-running this against a fresh install, or to resume after an early
 * failure, is safe: earlier files no-op, and it picks up again wherever it
 * stopped. One narrow exception: a handful of early migrations create a
 * transitional constraint that a much later migration in the same manifest
 * deliberately supersedes (for example, a global unique index on contact
 * email that migrations/20260830-tenant-uniqueness-cutover.sql later drops
 * in favor of a tenant-scoped one). Re-running the full batch from scratch
 * against a long-lived, already-migrated database can hit that transitional
 * constraint colliding with real data that only exists because the cutover
 * already happened — that is expected, not a bug, and does not affect a
 * fresh install. Use `npm run db:verify-schema` to check an existing
 * installation's health instead of re-running the whole manifest.
 */
import { spawnSync } from "node:child_process";
import { MIGRATION_MANIFEST } from "./lib/migration-manifest.mjs";
import { repoRoot } from "./lib/accelerate-database.mjs";

for (const [index, file] of MIGRATION_MANIFEST.entries()) {
  const step = `[${index + 1}/${MIGRATION_MANIFEST.length}]`;
  console.log(`\n${step} ${file}`);
  const result = spawnSync(process.execPath, ["scripts/run-migration.mjs", file], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(
      `\n${step} failed on ${file}. Every migration here is safe to re-run, so fix the ` +
        `error above and re-run "npm run db:migrate:all" from the start — files already ` +
        `applied will no-op.`,
    );
    process.exit(1);
  }
}

console.log(`\nApplied all ${MIGRATION_MANIFEST.length} migrations successfully.`);
