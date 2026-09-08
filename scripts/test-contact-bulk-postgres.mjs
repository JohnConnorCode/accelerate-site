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
const ids = Array.from({ length: 6 }, () => randomUUID()),
  campaign = randomUUID();
const context = (t) =>
  `SET request.headers='{"x-tenant-id":"${t}"}'; SET request.jwt.claim.role='service_role'; SET ROLE service_role;`;
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
const tag = (t, contacts, add, remove = []) =>
  context(t) +
  `SELECT bulk_tag_contacts(ARRAY[${contacts.map((x) => `'${x}'::uuid`).join(",")}],ARRAY[${add.map((x) => `'${x}'`).join(",")}]::text[],ARRAY[${remove.map((x) => `'${x}'`).join(",")}]::text[],'owner@example.test');`;
const stage = (t, members, draft = true) =>
  context(t) +
  `SELECT stage_campaign_members('${campaign}','${JSON.stringify(members)}',${draft},'owner@example.test');`;
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
sql(`UPDATE tenants SET status='active',config=config||'{"modules":{"campaigns":true,"leads-capture":true}}' WHERE id IN ('${a}','${b}');
INSERT INTO contacts(id,tenant_id,full_name,primary_email,communication_status) VALUES
('${ids[0]}','${a}','A','${ids[0]}@example.test','active'),
('${ids[1]}','${a}','B','${ids[1]}@example.test','unsubscribed'),
('${ids[2]}','${a}','C',NULL,'active'),
('${ids[3]}','${a}','D','${ids[3]}@example.test','active'),
('${ids[4]}','${a}','E',NULL,'active'),
('${ids[5]}','${b}','Other','${ids[5]}@example.test','active');
UPDATE contacts SET alternate_emails=ARRAY['${ids[3]}@example.test'] WHERE id='${ids[4]}';
INSERT INTO campaigns(id,tenant_id,name,status) VALUES('${campaign}','${a}','Bulk staging','draft');`);
const concurrent = await Promise.all([
  run(tag(a, [ids[0]], ["alpha"])),
  run(tag(a, [ids[0]], ["beta"])),
]);
assert.ok(concurrent.every((r) => r[0].status === "applied"));
assert.deepEqual(JSON.parse(sql(`SELECT to_json(tags) FROM contacts WHERE id='${ids[0]}'`)), [
  "alpha",
  "beta",
]);
assert.equal(JSON.parse(sql(tag(a, [ids[5]], ["other"])))[0].status, "skipped");
assert.equal(
  JSON.parse(sql(tag(a, [ids[0]], ["alpha"])))[0].reason,
  "Already in the requested state",
);
assert.match(fail(tag(a, [ids[0]], ["invalid tag"])), /Invalid contact tag/);
sql(
  `UPDATE contacts SET tags=ARRAY(SELECT 'tag'||n FROM generate_series(1,25) n) WHERE id='${ids[0]}'`,
);
assert.equal(JSON.parse(sql(tag(a, [ids[0]], ["overflow"])))[0].status, "failed");
const outcomes = JSON.parse(
  sql(
    stage(
      a,
      ids.map((contactId) => ({ contactId })),
    ),
  ),
);
assert.equal(outcomes.filter((r) => r.status === "applied").length, 1);
assert.equal(outcomes.filter((r) => r.status === "skipped").length, 5);
assert.equal(
  sql(
    `SELECT count(*) FROM campaign_members WHERE campaign_id='${campaign}' AND next_send_at IS NOT NULL`,
  ),
  "0",
);
assert.equal(
  JSON.parse(sql(stage(a, [{ contactId: ids[0] }])))[0].reason,
  "Already enrolled in this campaign",
);
assert.equal(
  JSON.parse(sql(stage(a, [{ contactId: ids[2], email: `${ids[0]}@example.test` }])))[0].status,
  "skipped",
);
assert.match(fail(stage(b, [{ contactId: ids[5] }])), /Campaign unavailable/);
sql(`UPDATE campaigns SET status='review' WHERE id='${campaign}'`);
assert.match(fail(stage(a, [{ contactId: ids[0] }])), /requires a draft/);
sql(`UPDATE campaigns SET status='active' WHERE id='${campaign}'`);
assert.match(fail(stage(a, [{ contactId: ids[0] }])), /requires a draft/);
sql(
  `UPDATE campaigns SET status='draft' WHERE id='${campaign}'; DELETE FROM campaign_members WHERE campaign_id='${campaign}';`,
);
const replay = await Promise.all([
  run(stage(a, [{ contactId: ids[0] }])),
  run(stage(a, [{ contactId: ids[0] }])),
]);
assert.equal(replay.flat().filter((r) => r.status === "applied").length, 1);
assert.equal(sql(`SELECT count(*) FROM campaign_members WHERE campaign_id='${campaign}'`), "1");
// Audit outage rolls back tag changes and enrollment, with no silent partial rows.
sql(
  `CREATE OR REPLACE FUNCTION public.bulk_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('contact.bulk_tagged','campaign.members_staged') THEN RAISE EXCEPTION 'bulk audit unavailable'; END IF; RETURN NEW; END $$; CREATE TRIGGER bulk_test_fail_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION bulk_test_fail_audit(); UPDATE contacts SET tags='{}' WHERE id='${ids[0]}'; DELETE FROM campaign_members WHERE campaign_id='${campaign}';`,
);
assert.match(fail(tag(a, [ids[0]], ["rollback"])), /bulk audit unavailable/);
assert.match(fail(stage(a, [{ contactId: ids[0] }])), /bulk audit unavailable/);
assert.equal(sql(`SELECT cardinality(tags) FROM contacts WHERE id='${ids[0]}'`), "0");
assert.equal(sql(`SELECT count(*) FROM campaign_members WHERE campaign_id='${campaign}'`), "0");
sql("DROP TRIGGER bulk_test_fail_audit ON audit_log; DROP FUNCTION bulk_test_fail_audit();");
assert.equal(JSON.parse(sql(stage(a, [{ contactId: ids[0] }])))[0].status, "applied");
assert.match(
  fail(
    `SET ROLE authenticated; SELECT bulk_tag_contacts(ARRAY['${ids[0]}'::uuid],ARRAY['test'],'{}','x');`,
  ),
  /permission denied/,
);
sql(
  `UPDATE tenants SET config=jsonb_set(config,'{modules,leads-capture}','false') WHERE id='${a}'`,
);
assert.match(fail(tag(a, [ids[0]], ["disabled"])), /Leads disabled/);
assert.match(fail(stage(a, [{ contactId: ids[0] }])), /staging disabled/);
sql(`UPDATE tenants SET config=jsonb_set(config,'{modules,leads-capture}','true') WHERE id='${a}'`);
console.log(
  "PASS: native concurrent tag preservation, bounds, exact outcomes, draft-only staging, canonical identity, suppression, tenant/role isolation, replay, audit rollback and module disable.",
);
