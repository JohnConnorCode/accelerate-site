#!/usr/bin/env node
import {
  PROJECT_REF,
  POOLER_HOST,
  POOLER_PORT,
  repoRoot,
  runPsql,
} from "./lib/accelerate-database.mjs";
import { migrationCatalog, migrationProgram } from "./lib/migration-ledger.mjs";
try {
  const args = process.argv.slice(2);
  const through = args[0] === "--through" && args.length === 2 ? args[1] : undefined;
  if (args.length && !through && !(args.length === 1 && args[0] === "--check"))
    throw new Error("Usage: npm run db:migrate:all [-- --check | --through migrations/file.sql]");
  const catalog = migrationCatalog(repoRoot);
  if (args[0] === "--check") {
    console.log(
      `Migration catalog verified: ${catalog.length} ordered files; exclusions explicitly classified.`,
    );
  } else {
    console.log(`Database target: ${PROJECT_REF} at ${POOLER_HOST}:${POOLER_PORT}`);
    const result = runPsql(["--quiet"], { input: migrationProgram(catalog, { through }) });
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    if (result.error?.code === "ENOENT")
      throw new Error("Install PostgreSQL client tools (psql) before migrating.");
    if (result.status !== 0)
      throw new Error(
        "Migration stopped. Completed files remain recorded; the failed transaction rolled back. Correct the cause and rerun the same command. Never edit recorded migration files.",
      );
    console.log("Migration ledger verified and all requested migrations applied.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Migration failed");
  process.exitCode = 1;
}
