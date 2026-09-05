import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { runPsql, psqlArgs, readDatabasePassword } from "./lib/accelerate-database.mjs";
const tenant = "acce1e8e-0000-4000-8000-000000000001",
  foreign = "22222222-2222-4222-8222-222222222222";
const context = (id = tenant) =>
  `SET request.headers='{"x-tenant-id":"${id}"}'; SET request.jwt.claim.role='service_role'; SET ROLE service_role;`;
const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
function sql(input) {
  const result = runPsql(["-qAt"], { input });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function fails(input, pattern) {
  const result = runPsql(["-qAt"], { input });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, pattern);
}
const contact = sql(`SELECT id FROM contacts WHERE tenant_id='${tenant}' LIMIT 1;`);
const caseId = randomUUID();
sql(
  `INSERT INTO collection_cases(id,tenant_id,contact_id,currency) VALUES('${caseId}','${tenant}','${contact}','usd'); UPDATE contacts SET primary_email='billing@example.test',communication_status='active' WHERE id='${contact}';`,
);
const digest = "a".repeat(64);
function action() {
  const id = randomUUID();
  const payload = {
    caseId,
    revision: 1,
    digest,
    preview: { to: "billing@example.test", contactId: contact, digest, cooldownHours: 72 },
  };
  sql(
    `INSERT INTO action_queue(id,tenant_id,action_type,title,status,approved_by,approved_at,expires_at,payload) VALUES('${id}','${tenant}','send_collection_reminder','Fixture reminder','executing','owner@example.test',now(),now()+interval '1 day',${literal(JSON.stringify(payload))}::jsonb);`,
  );
  return id;
}
const id = action();
const reserve = (id, t = tenant) => context(t) + `SELECT reserve_collection_reminder('${id}');`;
fails(reserve(id, foreign), /approval required/);
sql(`UPDATE collection_cases SET disputed=true WHERE id='${caseId}';`);
fails(reserve(id), /policy changed/);
sql(
  `UPDATE collection_cases SET disputed=false WHERE id='${caseId}'; UPDATE contacts SET communication_status='unsubscribed' WHERE id='${contact}';`,
);
fails(reserve(id), /Recipient changed/);
sql(
  `UPDATE contacts SET communication_status='active',primary_email='changed@example.test' WHERE id='${contact}';`,
);
fails(reserve(id), /Recipient changed/);
sql(
  `UPDATE contacts SET primary_email='billing@example.test' WHERE id='${contact}'; UPDATE tenants SET config=jsonb_set(config,'{modules,receivables-collections}','false') WHERE id='${tenant}';`,
);
fails(reserve(id), /disabled/);
sql(
  `UPDATE tenants SET config=jsonb_set(config,'{modules,receivables-collections}','true') WHERE id='${tenant}';`,
);
assert.equal(JSON.parse(sql(reserve(id))).reserved, true);
assert.equal(JSON.parse(sql(reserve(id))).reserved, false);
const second = action();
fails(reserve(second), /unresolved/);
assert.equal(
  JSON.parse(sql(context() + `SELECT reconcile_collection_reminder('${id}');`)).state,
  "uncertain",
);
fails(reserve(second), /unresolved/);
fails(context() + `DELETE FROM collection_reminder_attempts;`, /permission denied/);
assert.equal(sql(context(foreign) + "SELECT count(*) FROM collection_reminder_attempts;"), "0");
const conversation = randomUUID(),
  message = randomUUID();
sql(
  `INSERT INTO conversations(id,tenant_id,channel,contact_id) VALUES('${conversation}','${tenant}','resend','${contact}'); INSERT INTO messages(id,tenant_id,conversation_id,direction,idempotency_key,status,provider_id,sent_at) VALUES('${message}','${tenant}','${conversation}','outbound','action:${id}','sent','email_verified',now()); UPDATE tenants SET config=jsonb_set(config,'{modules,receivables-collections}','false') WHERE id='${tenant}';`,
);
const reconcile = context() + `SELECT reconcile_collection_reminder('${id}');`;
const receipt = JSON.parse(sql(reconcile));
assert.equal(receipt.state, "sent");
assert.equal(receipt.message_id, message);
assert.deepEqual(JSON.parse(sql(reconcile)), receipt);
assert.equal(sql(`SELECT count(*) FROM collection_events WHERE request_id='${id}';`), "1");
sql(
  `UPDATE tenants SET config=jsonb_set(config,'{modules,receivables-collections}','true') WHERE id='${tenant}';`,
);
fails(reserve(second), /cooldown/);
sql(readFileSync("migrations/20260906-collections-reminders.sql", "utf8"));
assert.deepEqual(JSON.parse(sql(reconcile)), receipt);
console.log(
  "PASS: native SQL reminder approval/tenant/recipient/hold/disable gates, one dispatch per case, replay, persistent uncertainty, verified-message reconciliation after disable, cooldown and receipt-preserving upgrade.",
);

// Race two separately approved actions after a real, elapsed cooldown.
sql(
  `UPDATE collection_reminder_attempts SET sent_at=now()-interval '4 days' WHERE action_id='${id}';`,
);
const third = action();
function concurrent(input) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", psqlArgs(["-qAt"]), {
      env: { ...process.env, PGPASSWORD: readDatabasePassword() },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "",
      error = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (error += d));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output, error }));
    child.stdin.end(input);
  });
}
const races = await Promise.all([concurrent(reserve(second)), concurrent(reserve(third))]);
assert.equal(races.filter((r) => r.code === 0).length, 1);
assert.equal(races.filter((r) => r.code !== 0 && /unresolved/.test(r.error)).length, 1);
console.log("PASS: two concurrent approved actions acquire exactly one dispatch reservation.");
