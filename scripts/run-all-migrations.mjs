#!/usr/bin/env node
/**
 * Collapses the 37-command manual migration sequence documented in
 * docs/REVENUE-OS-SETUP.md into one command. Reuses run-migration.mjs
 * unchanged, one child process per file, in order — no behavior change to
 * how any single migration is applied, only to how many commands a fresh
 * clone has to type.
 *
 * Every migration in the manifest is additive/idempotent (see AGENTS.md), so
 * re-running this after a failure is safe: earlier files no-op, and it picks
 * up again wherever it stopped.
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
