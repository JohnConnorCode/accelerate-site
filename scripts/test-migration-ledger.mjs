import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { migrationCatalog, migrationProgram } from "./lib/migration-ledger.mjs";
import {
  psqlArgs,
  readDatabasePassword,
  POOLER_HOST,
  repoRoot,
} from "./lib/accelerate-database.mjs";

// This suite creates and drops only its own uniquely named scratch databases.
assert.ok(
  ["localhost", "127.0.0.1"].includes(POOLER_HOST),
  "Ledger tests require a local PostgreSQL target",
);
const env = { ...process.env, PGPASSWORD: readDatabasePassword() };
function execute(database, sql) {
  const args = psqlArgs(["-qAt"]);
  args[args.indexOf("-d") + 1] = database;
  return spawnSync("psql", args, { env, input: sql, encoding: "utf8" });
}
function success(result) {
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function entry(file, sql) {
  return { file, sql, checksum: createHash("sha256").update(sql).digest("hex") };
}
const baseline = entry(
  "001.sql",
  "CREATE TABLE accounts(id int PRIMARY KEY, name text); INSERT INTO accounts VALUES(1,'Original customer');",
);
const upgrade = entry(
  "002.sql",
  "ALTER TABLE accounts ADD COLUMN active boolean NOT NULL DEFAULT true;",
);
const names = [];
function scratch() {
  const name = `accelerate_ledger_test_${randomBytes(6).toString("hex")}`;
  success(execute("postgres", `CREATE DATABASE ${name};`));
  names.push(name);
  return name;
}
try {
  const catalog = migrationCatalog(repoRoot);
  assert.ok(catalog.length >= 63);
  assert.throws(() => migrationProgram(catalog, { through: "not-a-migration.sql" }));
  const db = scratch();
  success(execute(db, migrationProgram([baseline, upgrade], { through: baseline.file })));
  assert.equal(success(execute(db, "SELECT count(*) FROM accelerate_schema_migrations;")), "1");
  success(execute(db, migrationProgram([baseline, upgrade])));
  success(execute(db, migrationProgram([baseline, upgrade])));
  assert.equal(
    success(execute(db, "SELECT name FROM accounts WHERE active;")),
    "Original customer",
  );
  assert.equal(success(execute(db, "SELECT count(*) FROM accelerate_schema_migrations;")), "2");
  const changed = { ...baseline, checksum: "a".repeat(64) };
  assert.notEqual(
    execute(db, migrationProgram([changed, upgrade])).status,
    0,
    "Checksum drift must fail",
  );
  assert.notEqual(
    execute(db, migrationProgram([baseline])).status,
    0,
    "Unknown recorded migration must fail",
  );
  const broken = entry("003.sql", "CREATE TABLE partial_write(id int); SELECT 1/0;");
  assert.notEqual(execute(db, migrationProgram([baseline, upgrade, broken])).status, 0);
  assert.equal(success(execute(db, "SELECT to_regclass('partial_write') IS NULL;")), "t");
  assert.equal(success(execute(db, "SELECT count(*) FROM accelerate_schema_migrations;")), "2");
  const repaired = entry("003.sql", "CREATE TABLE partial_write(id int);");
  success(execute(db, migrationProgram([baseline, upgrade, repaired])));
  assert.equal(success(execute(db, "SELECT count(*) FROM accelerate_schema_migrations;")), "3");
  assert.equal(
    success(
      execute(db, "SELECT has_table_privilege('anon','accelerate_schema_migrations','INSERT');"),
    ),
    "f",
  );
  const legacy = scratch();
  success(
    execute(
      legacy,
      "CREATE TABLE valuable_business_data(id int); INSERT INTO valuable_business_data VALUES(42);",
    ),
  );
  assert.notEqual(execute(legacy, migrationProgram([baseline])).status, 0);
  assert.equal(success(execute(legacy, "SELECT id FROM valuable_business_data;")), "42");
  const concurrent = scratch();
  const slow = entry(
    "001.sql",
    "CREATE TABLE effects(id int); SELECT pg_sleep(1); INSERT INTO effects VALUES(1);",
  );
  function runAsync() {
    return new Promise((resolve, reject) => {
      const args = psqlArgs(["-qAt"]);
      args[args.indexOf("-d") + 1] = concurrent;
      const child = spawn("psql", args, { env });
      let errors = "";
      child.stdout.resume();
      child.stderr.on("data", (chunk) => (errors += chunk));
      child.on("error", reject);
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(errors))));
      child.stdin.end(migrationProgram([slow]));
    });
  }
  const concurrentResults = await Promise.allSettled([runAsync(), runAsync()]);
  assert.equal(concurrentResults.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(concurrentResults.filter((result) => result.status === "rejected").length, 1);
  success(execute(concurrent, migrationProgram([slow])));
  assert.equal(success(execute(concurrent, "SELECT count(*) FROM effects;")), "1");
  console.log(
    "PASS: populated upgrade, replay, checksum drift, unknown history, transactional failure/resume, legacy refusal, ledger privileges, concurrent runners.",
  );
} finally {
  for (const name of names) success(execute("postgres", `DROP DATABASE ${name} WITH (FORCE);`));
}
