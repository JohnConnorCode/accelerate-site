import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { runPsql, psqlArgs, readDatabasePassword } from "./lib/accelerate-database.mjs";
const a = "acce1e8e-0000-4000-8000-000000000001",
  b = "22222222-2222-4222-8222-222222222222";
const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const json = (value) => literal(JSON.stringify(value)) + "::jsonb";
function sql(input) {
  const r = runPsql(["-qAt"], { input });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
const context = (t) =>
  `SET request.headers='{"x-tenant-id":"${t}"}'; SET request.jwt.claim.role='service_role'; SET ROLE service_role;`;
function fail(input) {
  const r = runPsql(["-qAt"], { input });
  assert.notEqual(r.status, 0, "Expected fail-closed SQL");
  return r.stderr;
}
const contactA = sql(`SELECT id FROM contacts WHERE tenant_id='${a}' LIMIT 1;`),
  contactB = sql(`SELECT id FROM contacts WHERE tenant_id='${b}' LIMIT 1;`);
sql(
  `UPDATE tenants SET config=jsonb_set(config,'{modules}','{"receivables-collections":true,"stripe-invoicing":true}') WHERE id IN ('${a}','${b}'); INSERT INTO integration_connections(tenant_id,provider,status,account_email,credential_version) VALUES('${a}','stripe','connected','acct_A',1),('${b}','stripe','connected','acct_B',1);`,
);
const ids = [randomUUID(), randomUUID(), randomUUID()];
for (let i = 0; i < ids.length; i++) {
  const tenant = i === 2 ? b : a,
    contact = i === 2 ? contactB : contactA,
    account = i === 2 ? "acct_B" : "acct_A";
  sql(
    `INSERT INTO action_queue(id,tenant_id,action_type,title,status,payload,result) VALUES('${ids[i]}','${tenant}','create_stripe_invoice_draft','Test invoice','executed',${json({ contactId: contact, accountId: account, testMode: true, currency: "usd" })},${json({ invoiceId: "in_" + i })});`,
  );
}
const observation = (i, extra = {}) => ({
  creationActionId: ids[i],
  contactId: i === 2 ? contactB : contactA,
  providerAccount: i === 2 ? "acct_B" : "acct_A",
  credentialVersion: 1,
  invoiceId: "in_" + i,
  testMode: true,
  currency: "usd",
  status: "open",
  remaining: i === 1 ? 5000 : 10000,
  dueDate: "2025-01-01",
  observedAt: new Date().toISOString(),
  providerRequestId: "req_fixture",
  complete: true,
  ...extra,
});
const sync = (t, key, items) =>
  context(t) + `SELECT sync_collection_observations('${key}',${json(items)},'owner@example.test');`;
const request = randomUUID(),
  initial = [observation(0), observation(1)];
const first = JSON.parse(sql(sync(a, request, initial)));
assert.equal(first.caseIds.length, 1);
const caseId = first.caseIds[0];
assert.deepEqual(JSON.parse(sql(sync(a, request, initial))), first);
assert.equal(sql(`SELECT count(*) FROM collection_observations WHERE tenant_id='${a}';`), "2");
assert.equal(
  sql(`SELECT count(*) FROM work_items WHERE entity_id='${caseId}' AND status='pending';`),
  "1",
);
assert.match(fail(sync(a, request, [observation(0)])), /identity conflict/);
assert.match(
  fail(sync(b, randomUUID(), [observation(0)])),
  /connection changed|provenance mismatch/,
);
assert.match(fail(sync(a, randomUUID(), [observation(0, { complete: false })])), /Incomplete/);
assert.match(
  fail(sync(a, randomUUID(), [observation(0, { credentialVersion: 2 })])),
  /connection changed/,
);
assert.match(
  fail(sync(a, randomUUID(), [observation(0, { observedAt: "2020-01-01T00:00:00.000Z" })])),
  /stale/,
);
assert.equal(sql(`SELECT count(*) FROM collection_observations WHERE tenant_id='${a}';`), "2");
const revision = () => Number(sql(`SELECT revision FROM collection_cases WHERE id='${caseId}';`));
const edit = (rev, key, patch) =>
  context(a) +
  `SELECT update_collection_case('${caseId}',${rev},'${key}',${json(patch)},'owner@example.test');`;
const rev = revision(),
  editKey = randomUUID(),
  patch = {
    disputed: true,
    nextAction: "Resolve documented invoice dispute",
    ownerEmail: "owner@example.test",
  };
const edited = JSON.parse(sql(edit(rev, editKey, patch)));
assert.equal(edited.disputed, true);
assert.deepEqual(JSON.parse(sql(edit(rev, editKey, patch))), edited);
assert.match(fail(edit(rev, randomUUID(), { disputed: false })), /Case changed/);
assert.equal(sql(`SELECT status FROM work_items WHERE entity_id='${caseId}';`), "cancelled");
sql(edit(revision(), randomUUID(), { disputed: false, promiseDate: "2030-01-01" }));
assert.equal(
  sql(
    `SELECT (next_check_at AT TIME ZONE 'UTC')::date FROM work_items WHERE entity_id='${caseId}' AND status='pending';`,
  ),
  "2030-01-02",
);
sql(edit(revision(), randomUUID(), { paused: true }));
assert.equal(
  sql(
    `SELECT count(*) FROM work_items WHERE entity_id='${caseId}' AND status IN ('pending','claimed','in_progress','waiting');`,
  ),
  "0",
);
sql(edit(revision(), randomUUID(), { paused: false, promiseDate: null }));
const secondWorkspaceObservation = [observation(2)];
const racingCreation = await Promise.all([
  concurrent(sync(b, randomUUID(), secondWorkspaceObservation)),
  concurrent(sync(b, randomUUID(), secondWorkspaceObservation)),
]);
assert.deepEqual(JSON.parse(racingCreation[0]).caseIds, JSON.parse(racingCreation[1]).caseIds);
assert.equal(
  sql(`SELECT count(*) FROM collection_cases WHERE tenant_id='${b}' AND status='open';`),
  "1",
);
assert.equal(
  sql(context(a) + `SELECT count(*) FROM collection_cases WHERE tenant_id='${b}';`),
  "0",
);
fail(
  `SET request.headers='{"x-tenant-id":"${b}"}'; SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111'; SET request.jwt.claim.role='authenticated'; SET ROLE authenticated; SELECT * FROM collection_cases;`,
);
fail(context(a) + `UPDATE collection_cases SET disputed=false WHERE id='${caseId}';`);
fail(`UPDATE collection_observations SET remaining=0;`);
fail(`DELETE FROM collection_events;`);
const raceKey = randomUUID(),
  raceItems = [observation(0, { remaining: 4000 }), observation(1)];
function concurrent(input) {
  return new Promise((resolve, reject) => {
    const p = spawn("psql", psqlArgs(["-qAt"]), {
      env: { ...process.env, PGPASSWORD: readDatabasePassword() },
    });
    let out = "",
      err = "";
    p.stdout.on("data", (v) => (out += v));
    p.stderr.on("data", (v) => (err += v));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err))));
    p.stdin.end(input);
  });
}
const concurrentResults = await Promise.all([
  concurrent(sync(a, raceKey, raceItems)),
  concurrent(sync(a, raceKey, raceItems)),
]);
assert.equal(concurrentResults[0], concurrentResults[1]);
assert.equal(
  sql(`SELECT count(*) FROM collection_cases WHERE tenant_id='${a}' AND status='open';`),
  "1",
);
const beforeDisable = sql(`SELECT count(*) FROM collection_events;`);
sql(
  `UPDATE tenants SET config=jsonb_set(config,'{modules,receivables-collections}','false') WHERE id='${a}';`,
);
assert.match(fail(sync(a, randomUUID(), [observation(0)])), /disabled/);
assert.equal(sql(`SELECT count(*) FROM collection_events;`), beforeDisable);
sql(
  `UPDATE tenants SET config=jsonb_set(config,'{modules,receivables-collections}','true') WHERE id='${a}';`,
);
sql(sync(a, randomUUID(), [observation(0, { status: "paid", remaining: 0 })]));
assert.equal(sql(`SELECT status FROM collection_cases WHERE id='${caseId}';`), "open");
sql(sync(a, randomUUID(), [observation(1, { status: "paid", remaining: 0 })]));
assert.equal(sql(`SELECT status FROM collection_cases WHERE id='${caseId}';`), "settled");
assert.equal(
  sql(
    `SELECT count(*) FROM work_items WHERE entity_id='${caseId}' AND status IN ('pending','claimed','in_progress','waiting');`,
  ),
  "0",
);
assert.equal(
  sql(`SELECT count(*) FROM activities WHERE source='collections';`),
  sql(`SELECT count(*) FROM collection_events;`),
);
assert.equal(
  sql(`SELECT count(*) FROM audit_log WHERE action LIKE 'collections.%';`),
  sql(`SELECT count(*) FROM collection_events;`),
);
const history = sql(`SELECT count(*) FROM collection_events;`);
sql(readFileSync("migrations/20260906-collections-cases.sql", "utf8"));
assert.equal(sql(`SELECT count(*) FROM collection_events;`), history);
assert.equal(sql(`SELECT status FROM collection_cases WHERE id='${caseId}';`), "settled");
console.log(
  "PASS: collection cases persist, replay, reject invalid/stale/foreign inputs, revision-check edits, schedule promises, hold disputes, serialize ingestion, enforce RLS/immutability, disable/re-enable, settle only verified payments, and preserve history across upgrade.",
);
