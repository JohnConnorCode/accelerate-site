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
  b = "22222222-2222-4222-8222-222222222222",
  source = randomUUID(),
  request = randomUUID();
const context = (t) =>
  `SET request.headers='{"x-tenant-id":"${t}"}'; SET request.jwt.claim.role='service_role'; SET ROLE service_role;`;
const command = (t, key, version = 3, name = "NULL") =>
  context(t) +
  `SELECT duplicate_campaign_draft('${source}',${version},'${key}',${name},'owner@example.test');`;
function sql(text) {
  const r = runPsql(["-qAt"], { input: text });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function fail(text) {
  const r = runPsql(["-qAt"], { input: text });
  assert.notEqual(r.status, 0);
  return r.stderr;
}
sql(
  `UPDATE tenants SET status='active',config=jsonb_set(config,'{modules,campaigns}','true',true) WHERE id IN ('${a}','${b}'); INSERT INTO campaigns(id,tenant_id,name,status,version,approved_version,approved_at,approved_by,sender_name,sender_email,audience_definition,policy) VALUES('${source}','${a}','Source','active',3,3,now(),'owner@example.test','Owner','owner@example.test','{"filter":"reviewed"}','{"daily_limit":25,"stop_on_reply":true}'); INSERT INTO campaign_steps(tenant_id,campaign_id,step_order,delay_days,subject_template,body_template,active) VALUES('${a}','${source}',1,0,'Subject','Body',true),('${a}','${source}',2,3,'Later','Later body',false);`,
);
assert.match(fail(command(b, request)), /source unavailable/);
const copy = JSON.parse(sql(command(a, request)));
assert.equal(copy.status, "draft");
assert.equal(copy.version, 1);
assert.equal(copy.approved_version, null);
assert.equal(copy.approved_at, null);
assert.equal(copy.approved_by, null);
assert.equal(copy.sender_email, "owner@example.test");
assert.deepEqual(copy.policy, { daily_limit: 25, stop_on_reply: true });
assert.deepEqual(copy.stats, { duplicated_from: source, duplicated_from_version: 3 });
assert.equal(
  sql(`SELECT count(*) FROM campaign_steps WHERE tenant_id='${a}' AND campaign_id='${copy.id}'`),
  "2",
);
assert.equal(
  sql(
    `SELECT active FROM campaign_steps WHERE tenant_id='${a}' AND campaign_id='${copy.id}' AND step_order=2`,
  ),
  "f",
);
assert.equal(
  sql(`SELECT count(*) FROM campaign_members WHERE tenant_id='${a}' AND campaign_id='${copy.id}'`),
  "0",
);
assert.equal(JSON.parse(sql(command(a, request))).id, copy.id);
assert.equal(
  sql(
    `SELECT count(*) FROM audit_log WHERE tenant_id='${a}' AND action='campaign.duplicated' AND entity_id='${copy.id}'`,
  ),
  "1",
);
assert.match(fail(command(a, request, 3, "'Different'")), /identity conflict/);
sql(`UPDATE campaigns SET version=4 WHERE tenant_id='${a}' AND id='${source}'`);
assert.equal(
  JSON.parse(sql(command(a, request))).id,
  copy.id,
  "confirmed replay does not create from changed source",
);
assert.match(fail(command(a, randomUUID())), /version changed/);
const concurrentKey = randomUUID();
const run = (text) =>
  new Promise((resolve, reject) => {
    const p = spawn("psql", psqlArgs(["-qAt"]), {
      env: { ...process.env, PGPASSWORD: readDatabasePassword() },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      err = "";
    p.stdout.on("data", (v) => (out += v));
    p.stderr.on("data", (v) => (err += v));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve(JSON.parse(out.trim())) : reject(new Error(err)),
    );
    p.stdin.end(text);
  });
const results = await Promise.all([
  run(command(a, concurrentKey, 4)),
  run(command(a, concurrentKey, 4)),
]);
assert.equal(results[0].id, results[1].id);
const before = sql(`SELECT count(*) FROM campaigns WHERE tenant_id='${a}'`);
sql(
  `CREATE FUNCTION public.reject_campaign_clone_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='campaign.duplicated' THEN RAISE EXCEPTION 'fixture audit outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_campaign_clone_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION public.reject_campaign_clone_audit();`,
);
const rollbackKey = randomUUID();
assert.match(fail(command(a, rollbackKey, 4)), /fixture audit outage/);
assert.equal(sql(`SELECT count(*) FROM campaigns WHERE tenant_id='${a}'`), before);
assert.equal(
  sql(
    `SELECT count(*) FROM campaign_duplicate_receipts WHERE tenant_id='${a}' AND request_id='${rollbackKey}'`,
  ),
  "0",
);
sql(
  "DROP TRIGGER reject_campaign_clone_audit ON audit_log; DROP FUNCTION public.reject_campaign_clone_audit();",
);
const retried = JSON.parse(sql(command(a, rollbackKey, 4)));
assert.equal(retried.status, "draft");
assert.equal(
  Number(sql(`SELECT count(*) FROM campaigns WHERE tenant_id='${a}'`)),
  Number(before) + 1,
);
assert.match(
  fail(
    `SET request.jwt.claim.role='authenticated'; SET ROLE authenticated; SELECT duplicate_campaign_draft('${source}',4,'${randomUUID()}',NULL,'owner@example.test');`,
  ),
  /permission denied/,
);
sql(
  `UPDATE tenants SET config=jsonb_set(config,'{modules,campaigns}','false',true) WHERE id='${a}'`,
);
assert.match(fail(command(a, request)), /disabled/);
sql(
  `UPDATE tenants SET config=jsonb_set(config,'{modules,campaigns}','true',true) WHERE id='${a}'`,
);
console.log(
  "PASS: native campaign clone atomic copy/audit, stable concurrent replay, source version, provenance, no delivery state, tenant/role isolation, rollback/retry and disabled replay.",
);
