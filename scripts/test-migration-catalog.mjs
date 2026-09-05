import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { migrationCatalog } from "./lib/migration-ledger.mjs";
import { MIGRATION_MANIFEST, EXCLUDED_MIGRATIONS } from "./lib/migration-manifest.mjs";
const root = mkdtempSync(join(tmpdir(), "accelerate-catalog-proof-"));
try {
  for (const dir of ["migrations", "supabase"]) mkdirSync(join(root, dir));
  for (const file of [...MIGRATION_MANIFEST, ...Object.keys(EXCLUDED_MIGRATIONS)])
    writeFileSync(join(root, file), readFileSync(file));
  assert.equal(migrationCatalog(root).length, MIGRATION_MANIFEST.length);
  const unknown = join(root, "migrations/unclassified.sql");
  writeFileSync(unknown, "SELECT 1;");
  assert.throws(() => migrationCatalog(root), /unclassified=migrations\/unclassified.sql/);
  rmSync(unknown);
  const last = join(root, MIGRATION_MANIFEST.at(-1));
  writeFileSync(last, "BEGIN;\nSELECT 1;\n");
  assert.throws(() => migrationCatalog(root), /Unsupported transaction wrapper/);
  rmSync(last);
  assert.throws(() => migrationCatalog(root), /missing=migrations\//);
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'import {psqlArgs} from "./scripts/lib/accelerate-database.mjs"; psqlArgs();',
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: "https://project-a.supabase.co",
        SUPABASE_PROJECT_REF: "project-b",
        SUPABASE_DB_HOST: "db.project-b.supabase.co",
        SUPABASE_DB_USER: "postgres",
      },
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not match SUPABASE_PROJECT_REF/);
  console.log(
    "PASS: catalog completeness, unclassified and missing files, broken transaction wrappers, mismatched database target refused before SQL.",
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
