import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  runPsql,
  psqlArgs,
  readDatabasePassword,
  POOLER_HOST,
} from "./lib/accelerate-database.mjs";
assert.ok(["localhost", "127.0.0.1"].includes(POOLER_HOST));
const tenant = "acce1e8e-0000-4000-8000-000000000001",
  config = { modules: { "opportunity-radar": true } };
const json = (v) => "'" + JSON.stringify(v).replaceAll("'", "''") + "'::jsonb";
const context = `SET request.headers='{"x-tenant-id":"${tenant}"}'; SET request.jwt.claim.role='service_role'; SET ROLE service_role;`;
function sql(input) {
  const r = runPsql(["-qAt"], { input });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function fail(input) {
  const r = runPsql(["-qAt"], { input });
  assert.notEqual(r.status, 0, "Expected refusal");
  return r.stderr;
}
const from = randomUUID(),
  to = randomUUID(),
  conversation = randomUUID(),
  message = randomUUID();
const body = "I can introduce you to the workshop coordinator.";
sql(`UPDATE tenants SET status='active',config=${json(config)} WHERE id='${tenant}';
INSERT INTO contacts(id,tenant_id,full_name,primary_email) VALUES('${from}','${tenant}','Same Name','${from}@example.test'),('${to}','${tenant}','Same Name','${to}@example.test');
INSERT INTO conversations(id,tenant_id,channel,contact_id,subject) VALUES('${conversation}','${tenant}','manual','${from}','Introduction proof');
INSERT INTO messages(id,tenant_id,conversation_id,direction,sender_email,body_text,status) VALUES('${message}','${tenant}','${conversation}','inbound','${from}@example.test','${body}','received');`);
const edge = {
  sourceType: "contact",
  sourceId: from,
  targetType: "contact",
  targetId: to,
  linkType: "radar_introduction_offer",
};
const evidence = {
  kind: "message",
  id: message,
  contentHash: createHash("sha256").update(body).digest("hex"),
  revision: null,
  verification: "received",
  conversationId: conversation,
  contactId: from,
  senderEmail: `${from}@example.test`,
};
const change = {
  operation: "review",
  operationId: randomUUID(),
  expectedReviewId: null,
  relationship: {
    kind: "introduction_offer",
    fromContactId: from,
    toContactId: to,
    offer: "Introduce workshop coordinator",
    evidence: { kind: "message", messageId: message, quotation: body },
  },
  validFrom: new Date(Date.now() - 1000).toISOString(),
  validUntil: new Date(Date.now() + 86400000).toISOString(),
  reason: "Exact human-reviewed offer",
};
const command = (c = change, e = evidence, ed = edge) =>
  context +
  `SELECT review_radar_relationship('${c.operationId}',${json(c)},${json(ed)},${json(e)},${json(config)},'owner@example.test');`;
function concurrent(input) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", [...psqlArgs(), "-qAt"], {
      env: { ...process.env, PGPASSWORD: readDatabasePassword() },
    });
    let out = "",
      err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(JSON.parse(out.trim())) : reject(new Error(err)),
    );
    child.stdin.end(input);
  });
}
const pair = await Promise.all([concurrent(command()), concurrent(command())]);
assert.deepEqual(pair.map((v) => v.replayed).sort(), [false, true]);
const saved = pair[0].review;
assert.equal(
  sql(`SELECT count(*) FROM radar_relationship_reviews WHERE link_id='${saved.link_id}'`),
  "1",
);
assert.equal(
  sql(
    `SELECT count(*) FROM audit_log WHERE entity_id='${saved.link_id}' AND action='radar.relationship.reviewed'`,
  ),
  "1",
);
assert.match(fail(command({ ...change, reason: "Changed input" })), /identity conflict/);
assert.match(fail(command({ ...change, operationId: randomUUID() })), /review changed/);
const next = { ...change, operationId: randomUUID(), expectedReviewId: saved.id };
sql(`UPDATE messages SET body_text='Offer withdrawn' WHERE id='${message}'`);
assert.match(fail(command(next)), /evidence changed|quotation/);
sql(`UPDATE messages SET body_text='${body}',direction='outbound' WHERE id='${message}'`);
assert.match(fail(command(next)), /Received introduction/);
sql(
  `UPDATE messages SET direction='inbound' WHERE id='${message}'; UPDATE conversations SET contact_id='${to}' WHERE id='${conversation}'`,
);
assert.match(fail(command(next)), /conversation identity/);
sql(
  `UPDATE conversations SET contact_id='${from}' WHERE id='${conversation}'; UPDATE contacts SET alternate_emails=ARRAY['${from}@example.test'] WHERE id='${to}'`,
);
assert.match(fail(command(next)), /ambiguous/);
sql(`UPDATE contacts SET alternate_emails='{}' WHERE id='${to}'`);
assert.match(
  fail(command({ ...next, validUntil: new Date(Date.now() - 86400000).toISOString() })),
  /validity/,
);
assert.match(
  fail(command({ ...next, relationship: { ...next.relationship, kind: "knows" } })),
  /Unsupported/,
);
assert.match(
  fail(`UPDATE radar_relationship_reviews SET reason='overwrite' WHERE id='${saved.id}'`),
  /immutable/,
);
assert.match(fail(`DELETE FROM radar_relationship_reviews WHERE id='${saved.id}'`), /immutable/);
// Generic CRM merge/coalescing can remove a link, but cannot erase review history.
sql(
  `DELETE FROM entity_links WHERE id='${saved.link_id}'; DELETE FROM messages WHERE id='${message}'`,
);
const revoked = JSON.parse(
  sql(
    command({
      operation: "revoke",
      operationId: randomUUID(),
      relationshipId: saved.link_id,
      expectedReviewId: saved.id,
      reason: "Withdraw the reviewed assertion",
    }),
  ),
);
assert.equal(revoked.review.state, "revoked");
assert.equal(revoked.review.revision, 2);
assert.equal(
  sql(`SELECT count(*) FROM radar_relationship_reviews WHERE link_id='${saved.link_id}'`),
  "2",
);
sql(`UPDATE tenants SET config='{}' WHERE id='${tenant}'`);
assert.equal(
  JSON.parse(sql(command())).replayed,
  true,
  "Exact historical replay remains valid while disabled",
);
assert.match(fail(command({ ...next, operationId: randomUUID() })), /disabled/);
sql(`UPDATE tenants SET config=${json(config)} WHERE id='${tenant}'`);
const unknown = randomUUID();
assert.match(fail(command().replaceAll(tenant, unknown)), /tenant|workspace/i);
console.log(
  "PASS: native relationship transaction/concurrent replay, audit, changed input, stale/ambiguous inbound evidence, expiry, immutable history, canonical coalescing, revocation and disabled replay.",
);
