#!/usr/bin/env node

import { accessSync, constants, realpathSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import {
  PROJECT_REF,
  POOLER_HOST,
  POOLER_PORT,
  repoRoot,
  runPsql,
} from "./lib/accelerate-database.mjs";

function fail(message) {
  console.error(`Migration failed: ${message}`);
  process.exit(1);
}

const requestedFile = process.argv[2];
if (!requestedFile) {
  fail(
    "pass one SQL file, for example: npm run db:migrate -- migrations/20260816-contact-importer.sql",
  );
}

const unresolvedPath = resolve(repoRoot, requestedFile);
let migrationPath;
try {
  accessSync(unresolvedPath, constants.R_OK);
  migrationPath = realpathSync(unresolvedPath);
} catch {
  fail(`cannot read ${requestedFile}`);
}

const repoRelative = relative(repoRoot, migrationPath);
if (
  repoRelative.startsWith(`..${sep}`) ||
  !repoRelative.endsWith(".sql") ||
  (!repoRelative.startsWith(`migrations${sep}`) && !repoRelative.startsWith(`supabase${sep}`))
) {
  fail("the SQL file must be inside migrations/ or supabase/");
}

console.log(`Checking Supabase project ${PROJECT_REF} through ${POOLER_HOST}:${POOLER_PORT}...`);
const connectionCheck = runPsql([
  "--command",
  "SELECT current_database() AS database, current_user AS role;",
]);
process.stdout.write(connectionCheck.stdout ?? "");
process.stderr.write(connectionCheck.stderr ?? "");
if (connectionCheck.error?.code === "ENOENT") {
  fail("psql is not installed or is not on PATH");
}
if (connectionCheck.status !== 0) fail("database connection check did not pass");

console.log(`Applying ${repoRelative}...`);
const migration = runPsql(["--file", migrationPath]);
process.stdout.write(migration.stdout ?? "");
process.stderr.write(migration.stderr ?? "");
if (migration.status !== 0) fail(`${repoRelative} did not complete`);

console.log(`Applied ${repoRelative} successfully.`);
