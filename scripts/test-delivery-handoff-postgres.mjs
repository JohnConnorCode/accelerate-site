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
const contact = randomUUID(),
  opp = randomUUID(),
  key = `handoff-${randomUUID()}`;
const context = (t) =>
  `SET request.headers='{"x-tenant-id":"${t}"}'; SET request.jwt.claim.role='service_role'; SET ROLE service_role;`;
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
const asyncSql = (input) =>
  new Promise((resolve, reject) => {
    const p = spawn("psql", psqlArgs(["-qAt"]), {
      env: { ...process.env, PGPASSWORD: readDatabasePassword() },
    });
    let out = "",
      err = "";
    p.stdout.on("data", (x) => (out += x));
    p.stderr.on("data", (x) => (err += x));
    p.on("error", reject);
    p.on("close", (code) => resolve({ code, out: out.trim(), err }));
    p.stdin.end(input);
  });
sql(
  `UPDATE tenants SET status='active',config=jsonb_set(config,'{modules,clients}','true',true) WHERE id IN ('${a}','${b}'); INSERT INTO contacts(id,tenant_id,full_name,primary_email) VALUES('${contact}','${a}','Delivery customer','${contact}@example.test'); INSERT INTO opportunities(id,tenant_id,name,stage,contact_id,email) VALUES('${opp}','${a}','Confirmed project','handoff-won','${contact}','${contact}@example.test'); INSERT INTO kanban_columns(tenant_id,board_key,column_key,label,sort_order,metadata) VALUES('${a}','pipeline','handoff-won','Confirmed won',999,'{"role":"won"}');`,
);
const publish = (t = a, k = key, title = "Kickoff") =>
  context(t) +
  `SELECT publish_onboarding_template('${k}','[{"key":"kickoff","title":"${title}","due_offset_days":3}]','owner@example.test');`;
const versions = await Promise.all([asyncSql(publish()), asyncSql(publish())]);
assert.ok(
  versions.every((r) => r.code === 0),
  JSON.stringify(versions),
);
assert.deepEqual(versions.map((r) => JSON.parse(r.out).version).sort(), [1, 2]);
assert.equal(
  sql(
    `SELECT count(*) FROM onboarding_templates WHERE tenant_id='${a}' AND template_key='${key}' AND active`,
  ),
  "1",
);
const binding = () =>
  `jsonb_build_object('opportunity_updated_at',o.updated_at,'canonical_stage','handoff-won','contact_id',o.contact_id,'company_id',NULL,'proposal_id',NULL,'proposal_version',NULL,'template_snapshot',jsonb_build_object('key',t.template_key,'version',t.version,'milestones',t.milestones))`;
const create = () =>
  context(a) +
  `INSERT INTO clients(tenant_id,opportunity_id,business_name,contact_name,contact_email,handoff_receipt) SELECT '${a}',o.id,'Delivery customer','Customer','${contact}@example.test',${binding()} FROM opportunities o CROSS JOIN onboarding_templates t WHERE o.id='${opp}' AND o.tenant_id='${a}' AND t.tenant_id='${a}' AND t.template_key='${key}' AND t.version=2 RETURNING id;`;
const memberContext = context(a).replace(
  "SET ROLE service_role;",
  "SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111'; SET request.jwt.claim.role='authenticated'; SET ROLE authenticated;",
);
const memberOpportunity = randomUUID();
sql(
  `INSERT INTO opportunities(id,tenant_id,name,stage,contact_id,email) SELECT '${memberOpportunity}',tenant_id,'Member handoff',stage,contact_id,email FROM opportunities WHERE id='${opp}';`,
);
const memberCreate = create().replace(context(a), memberContext).replaceAll(opp, memberOpportunity);
const memberClient = sql(memberCreate);
assert.ok(
  memberClient,
  "an authenticated workspace admin can hand off with locked source validation",
);
assert.equal(
  sql(
    memberContext +
      `UPDATE clients SET onboarding_checklist='[]' WHERE id='${memberClient}' RETURNING handoff_revision;`,
  ),
  "1",
);
sql(
  `UPDATE tenant_memberships SET status='revoked' WHERE tenant_id='${a}' AND user_id='11111111-1111-4111-8111-111111111111';`,
);
assert.match(fail(memberCreate), /tenant access forbidden|row-level security/);
sql(
  `UPDATE tenant_memberships SET status='active' WHERE tenant_id='${a}' AND user_id='11111111-1111-4111-8111-111111111111';`,
);
const creates = await Promise.all([asyncSql(create()), asyncSql(create())]);
assert.equal(creates.filter((r) => r.code === 0).length, 1, JSON.stringify(creates));
assert.match(creates.find((r) => r.code !== 0).err, /idx_clients_handoff_opportunity_unique/);
const client = creates.find((r) => r.code === 0).out;
const dedupe = `handoff:${client}:kickoff`;
sql(
  context(a) +
    `INSERT INTO tasks(tenant_id,title,source,dedupe_key,status,related_type,related_id) VALUES('${a}','Kickoff','delivery_handoff','${dedupe}','completed','client','${client}');`,
);
assert.match(
  fail(
    context(a) +
      `INSERT INTO tasks(tenant_id,title,source,dedupe_key) VALUES('${a}','Again','delivery_handoff','${dedupe}');`,
  ),
  /idx_tasks_delivery_handoff_unique/,
);
assert.equal(
  sql(
    context(a) +
      `UPDATE clients SET onboarding_checklist='[{"key":"kickoff","status":"complete"}]' WHERE tenant_id='${a}' AND id='${client}' AND handoff_revision=0 RETURNING handoff_revision;`,
  ),
  "1",
);
assert.equal(
  sql(
    context(a) +
      `UPDATE clients SET onboarding_checklist='[]' WHERE tenant_id='${a}' AND id='${client}' AND handoff_revision=0 RETURNING id;`,
  ),
  "",
);
assert.equal(
  sql(`SELECT onboarding_checklist->0->>'status' FROM clients WHERE id='${client}'`),
  "complete",
);
assert.match(
  fail(
    context(a) +
      `UPDATE clients SET handoff_receipt=jsonb_set(handoff_receipt,'{template_snapshot,version}','1') WHERE id='${client}';`,
  ),
  /binding is immutable/,
);
for (const removed of ["handoff_receipt - 'template_snapshot'", "'{}'::jsonb", "'null'::jsonb"]) {
  assert.match(
    fail(context(a) + `UPDATE clients SET handoff_receipt=${removed} WHERE id='${client}';`),
    /binding is immutable/,
    "removing the source snapshot must not bypass immutability",
  );
}
assert.match(
  fail(publish().replace("SET ROLE service_role;", "SET ROLE authenticated;")),
  /permission denied/,
);
const other = JSON.parse(sql(publish(b)));
assert.equal(other.version, 1, "same template key has independent tenant versions");
// Publishing and its audit share the transaction: a failed receipt leaves v2 active.
sql(
  `CREATE FUNCTION public.fail_delivery_template_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='onboarding_template.published' AND NEW.entity_id='${key}:v3' THEN RAISE EXCEPTION 'forced template audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_delivery_template_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION public.fail_delivery_template_audit();`,
);
assert.match(fail(publish()), /forced template audit failure/);
assert.equal(
  sql(
    `SELECT version FROM onboarding_templates WHERE tenant_id='${a}' AND template_key='${key}' AND active`,
  ),
  "2",
);
sql(
  `DROP TRIGGER fail_delivery_template_audit ON audit_log; DROP FUNCTION public.fail_delivery_template_audit();`,
);
const invalid = randomUUID();
sql(
  `INSERT INTO opportunities(id,tenant_id,name,stage,contact_id,email) VALUES('${invalid}','${a}','Still open','new','${contact}','${contact}@example.test');`,
);
assert.match(fail(create().replaceAll(opp, invalid)), /won opportunity/);
console.log(
  "PASS: concurrent engagements/templates, completed-task identity, checklist OCC, immutable source binding, won gate, tenant versions, role refusal and atomic template audit rollback.",
);
