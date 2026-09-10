import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  runPsql,
  psqlArgs,
  readDatabasePassword,
  POOLER_HOST,
} from "./lib/accelerate-database.mjs";
assert.ok(
  ["localhost", "127.0.0.1"].includes(POOLER_HOST),
  "Website proof requires an isolated local database",
);
const tenant = "acce1e8e-0000-4000-8000-000000000001";
const other = "22222222-2222-4222-8222-222222222222";
const json = (value) => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const sql = (input) => {
  const result = runPsql(["-qAt"], { input });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
const fails = (input, pattern) => {
  const result = runPsql(["-qAt"], { input });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, pattern);
};
const context = (id) =>
  `SET request.headers='{"x-tenant-id":"${id}"}'; SET request.jwt.claim.role='service_role'; SET ROLE service_role;`;
const command = (
  operation,
  version,
  { key = randomUUID(), document = null, revision = null, id = tenant } = {},
) =>
  `${context(id)} SELECT public.write_site_website('${operation}','${key}',${version},${revision ? "'" + revision + "'" : "NULL"},${document ? json(document) : "NULL"},'owner@example.test');`;
const snapshot = (title) => ({ schemaVersion: 1, pages: [{ title }] });
sql(
  `UPDATE tenants SET status='active',config=jsonb_set(config,'{modules,site-studio}','true',true) WHERE id IN ('${tenant}','${other}');`,
);
fails(command("unpublish", 0), /Save the website/);
assert.equal(sql("SELECT count(*) FROM site_websites"), "0");
const firstCommand = command("save", 0, { document: snapshot("First saved page") });
const first = JSON.parse(sql(firstCommand));
assert.equal(first.version, 1);
assert.equal(first.publishedRevisionId, null);
assert.deepEqual(JSON.parse(sql(firstCommand)), first);
assert.equal(sql("SELECT count(*) FROM site_website_revisions"), "1");
fails(
  command("save", 0, { key: first.requestKey, document: snapshot("Different content") }),
  /request key reused/,
);
fails(
  command("save", 1, { document: snapshot("Foreign"), id: other }),
  /Installation website context/,
);
const published = JSON.parse(sql(command("publish", 1, { revision: first.draftRevisionId })));
assert.equal(published.publishedRevisionId, first.draftRevisionId);
const second = JSON.parse(sql(command("save", 2, { document: snapshot("Private second draft") })));
assert.equal(second.publishedRevisionId, first.draftRevisionId);
assert.notEqual(second.draftRevisionId, first.draftRevisionId);
fails(command("publish", 3, { revision: first.draftRevisionId }), /current saved draft/);
fails(command("rollback", 3, { revision: second.draftRevisionId }), /previously published/);
fails(command("publish", 2, { revision: second.draftRevisionId }), /Stale website/);
const run = (input) =>
  new Promise((resolve, reject) => {
    const child = spawn("psql", psqlArgs(["-qAt"]), {
      env: { ...process.env, PGPASSWORD: readDatabasePassword() },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, out, err }));
    child.stdin.end(input);
  });
const races = await Promise.all([
  run(command("publish", 3, { revision: second.draftRevisionId })),
  run(command("save", 3, { document: snapshot("Concurrent draft") })),
]);
assert.equal(races.filter((result) => result.code === 0).length, 1);
assert.match(races.find((result) => result.code !== 0).err, /Stale website/);
const rollback = JSON.parse(sql(command("rollback", 4, { revision: first.draftRevisionId })));
assert.equal(rollback.publishedRevisionId, first.draftRevisionId);
const revisionCount = sql("SELECT count(*) FROM site_website_revisions");
const unpublished = JSON.parse(sql(command("unpublish", 5)));
assert.equal(unpublished.publishedRevisionId, null);
assert.equal(sql("SELECT count(*) FROM site_website_revisions"), revisionCount);
// Client roles cannot list drafts or call the privileged write boundary, even
// with a forged tenant header. Only the owner-checked server adapter can call it.
for (const role of ["anon", "authenticated"]) {
  for (const table of ["site_websites", "site_website_revisions", "site_website_receipts"])
    fails(`SET ROLE ${role}; SELECT * FROM ${table};`, /permission denied/);
  fails(
    `SET ROLE ${role}; SELECT public.write_site_website('unpublish','${randomUUID()}',6,NULL,NULL,'forged@example.test');`,
    /permission denied/,
  );
}
fails("UPDATE site_website_revisions SET checksum=repeat('0',64);", /immutable/i);
fails("DELETE FROM site_website_receipts;", /immutable/i);
sql(
  `CREATE FUNCTION private.reject_website_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action LIKE 'site_website.%' THEN RAISE EXCEPTION 'controlled audit refusal'; END IF; RETURN NEW; END $$; CREATE TRIGGER website_audit_proof BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION private.reject_website_audit();`,
);
try {
  const before = sql(
    "SELECT jsonb_build_object('state',(SELECT to_jsonb(s) FROM site_websites s),'revisions',(SELECT count(*) FROM site_website_revisions),'receipts',(SELECT count(*) FROM site_website_receipts))",
  );
  fails(command("save", 6, { document: snapshot("Must roll back") }), /controlled audit refusal/);
  assert.equal(
    sql(
      "SELECT jsonb_build_object('state',(SELECT to_jsonb(s) FROM site_websites s),'revisions',(SELECT count(*) FROM site_website_revisions),'receipts',(SELECT count(*) FROM site_website_receipts))",
    ),
    before,
  );
} finally {
  sql(
    "DROP TRIGGER website_audit_proof ON audit_log; DROP FUNCTION private.reject_website_audit();",
  );
}
sql(
  `UPDATE tenants SET config=jsonb_set(config,'{modules,site-studio}','false',true) WHERE id='${tenant}';`,
);
fails(command("save", 6, { document: snapshot("Disabled") }), /Site Studio disabled/);
sql(
  `UPDATE tenants SET config=jsonb_set(config,'{modules,site-studio}','true',true) WHERE id='${tenant}';`,
);
console.log(
  "PASS: website save/publish/rollback/unpublish, exact replay, key misuse, stale writes, concurrent publication, draft isolation, cross-tenant denial, immutable history, audit rollback and module disable on native PostgreSQL.",
);
