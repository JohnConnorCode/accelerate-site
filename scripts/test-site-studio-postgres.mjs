import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  runPsql,
  psqlArgs,
  readDatabasePassword,
  POOLER_HOST,
} from "./lib/accelerate-database.mjs";
assert.ok(["localhost", "127.0.0.1"].includes(POOLER_HOST));
const a = "acce1e8e-0000-4000-8000-000000000001",
  b = "22222222-2222-4222-8222-222222222222";
const id = randomUUID(),
  id2 = randomUUID();
const j = (value) => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const context = (tenant) =>
  `SET request.headers='{"x-tenant-id":"${tenant}"}'; SET request.jwt.claim.role='service_role'; SET ROLE service_role;`;
const draft = (identifier, slug, checksum) => ({
  id: identifier,
  title: "Service page",
  slug,
  status: "draft",
  version: 1,
  source: "template",
  checksum,
  document: { metadata: { title: "Service page", slug }, root: [] },
});
const command = (tenant, operation, identifier, checksum, value) =>
  context(tenant) +
  `SELECT write_site_draft('${operation}','${identifier}',${checksum ? "'" + checksum + "'" : "NULL"},${value ? j(value) : "NULL"},'owner@example.test');`;
function sql(input) {
  const r = runPsql(["-qAt"], { input });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function fail(input) {
  const r = runPsql(["-qAt"], { input });
  assert.notEqual(r.status, 0);
  return r.stderr;
}
sql(
  `UPDATE tenants SET status='active',config=jsonb_set(config,'{modules,site-studio}','true',true) WHERE id IN ('${a}','${b}');`,
);
const one = JSON.parse(
  sql(command(a, "create", id, null, draft(id, "studio-proof", "a".repeat(64)))),
);
assert.equal(one.version, 1);
sql(command(b, "create", id2, null, draft(id2, "studio-proof", "a".repeat(64))));
assert.match(
  fail(command(b, "revise", id, "a".repeat(64), draft(id, "foreign-write", "b".repeat(64)))),
  /Stale or unavailable/,
);
const actor = `SET request.jwt.claim.role='authenticated'; SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111'; SET ROLE authenticated;`;
assert.equal(
  sql(
    `SET request.headers='{"x-tenant-id":"${a}"}'; ${actor} SELECT count(*) FROM site_drafts WHERE id IN ('${id}','${id2}');`,
  ),
  "1",
);
assert.match(
  fail(
    `SET request.headers='{"x-tenant-id":"${a}"}'; ${actor} SELECT write_site_draft('discard','${id}','${"a".repeat(64)}',NULL,'owner@example.test');`,
  ),
  /permission denied/,
);
const two = JSON.parse(
  sql(command(a, "revise", id, "a".repeat(64), draft(id, "renamed-proof", "b".repeat(64)))),
);
assert.equal(two.id, id);
assert.equal(two.version, 2);
assert.equal(two.createdAt, one.createdAt);
assert.match(
  fail(command(a, "revise", id, "a".repeat(64), draft(id, "stale-proof", "c".repeat(64)))),
  /Stale/,
);
const run = (input) =>
  new Promise((resolve) => {
    const child = spawn("psql", psqlArgs(["-qAt"]), {
      env: { ...process.env, PGPASSWORD: readDatabasePassword() },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      err = "";
    child.stdout.on("data", (v) => (out += v));
    child.stderr.on("data", (v) => (err += v));
    child.on("exit", (code) => resolve({ code, out, err }));
    child.stdin.end(input);
  });
const races = await Promise.all([
  run(command(a, "revise", id, "b".repeat(64), draft(id, "race-one", "c".repeat(64)))),
  run(command(a, "revise", id, "b".repeat(64), draft(id, "race-two", "d".repeat(64)))),
]);
assert.equal(races.filter((r) => r.code === 0).length, 1);
assert.match(races.find((r) => r.code !== 0).err, /Stale/);
const current = JSON.parse(sql(`SELECT draft FROM site_drafts WHERE id='${id}'`));
assert.equal(current.version, 3);
assert.equal(sql(`SELECT count(*) FROM site_draft_revisions WHERE draft_id='${id}'`), "3");
sql(
  `CREATE FUNCTION private.reject_studio_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action LIKE 'site_draft.%' THEN RAISE EXCEPTION 'controlled audit refusal'; END IF; RETURN NEW; END $$; CREATE TRIGGER studio_audit_proof BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION private.reject_studio_audit();`,
);
assert.match(
  fail(command(a, "revise", id, current.checksum, draft(id, "rollback-proof", "e".repeat(64)))),
  /controlled audit refusal/,
);
assert.equal(sql(`SELECT version FROM site_drafts WHERE id='${id}'`), "3");
sql("DROP TRIGGER studio_audit_proof ON audit_log; DROP FUNCTION private.reject_studio_audit();");
assert.match(
  fail(`UPDATE site_draft_revisions SET actor_email='changed' WHERE draft_id='${id}';`),
  /immutable/i,
);
assert.equal(sql(command(a, "discard", id, current.checksum, null)), "true");
assert.equal(
  sql(`SELECT count(*) FROM site_drafts WHERE id='${id}' AND discarded_at IS NULL`),
  "0",
);
assert.equal(sql(`SELECT count(*) FROM site_draft_revisions WHERE draft_id='${id}'`), "4");
const blockedId = randomUUID();
sql(`UPDATE tenants SET config=jsonb_set(config,'{modules,site-studio}','false') WHERE id='${a}'`);
assert.match(
  fail(command(a, "create", blockedId, null, draft(blockedId, "disabled-proof", "a".repeat(64)))),
  /disabled/,
);
console.log(
  "PASS: Site Studio tenant ownership, stable rename, stale/concurrent writes, immutable revisions, audit rollback, discard history and disabled writes (native PostgreSQL).",
);
