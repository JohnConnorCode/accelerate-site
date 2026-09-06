#!/usr/bin/env node
// A single entrypoint preserves prerequisites and the same checksum ledger.
import { spawnSync } from "node:child_process";
import { repoRoot } from "./lib/accelerate-database.mjs";
if (process.argv.length !== 3) {
  console.error(
    "Usage: npm run db:migrate -- migrations/file.sql (applies pending prerequisites too)",
  );
  process.exitCode = 1;
} else {
  const result = spawnSync(
    process.execPath,
    ["scripts/run-all-migrations.mjs", "--through", process.argv[2]],
    { cwd: repoRoot, stdio: "inherit", env: process.env },
  );
  process.exitCode = result.status ?? 1;
}
