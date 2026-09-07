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
  other = "22222222-2222-4222-8222-222222222222";
const json = (v) => "'" + JSON.stringify(v).replaceAll("'", "''") + "'::jsonb";
const context = (t) =>
  `SET request.headers='{"x-tenant-id":"${t}"}'; SET request.jwt.claim.role='service_role'; SET ROLE service_role;`;
function sql(s) {
  const r = runPsql(["-qAt"], { input: s });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function fail(s) {
  const r = runPsql(["-qAt"], { input: s });
  assert.notEqual(r.status, 0, "Expected refusal");
  return r.stderr;
}
const command = (
  input,
  key = createHash("sha256").update(JSON.stringify(input)).digest("hex"),
  t = tenant,
) => context(t) + `SELECT apply_proposal_lifecycle('${key}',${json(input)},'owner@example.test');`;
function concurrent(s) {
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
      code === 0 ? resolve(JSON.parse(out.trim())) : reject(Error(err)),
    );
    child.stdin.end(s);
  });
}
function seed(status = "draft") {
  const id = randomUUID();
  sql(
    `INSERT INTO proposals(id,tenant_id,client_name,title,content,share_token,status,version) VALUES('${id}','${tenant}','Fictional customer','Reviewed scope','{"sections":[]}','${randomUUID()}','${status}',1);`,
  );
  return id;
}
sql(`UPDATE tenants SET status='active' WHERE id='${tenant}';`);
const id = seed();
let input = {
  id,
  operation: "send",
  patch: {},
  source: "admin",
  reason: null,
  expectedUpdatedAt: null,
};
const pair = await Promise.all([concurrent(command(input)), concurrent(command(input))]);
assert.deepEqual(pair.map((r) => r.replayed).sort(), [false, true]);
assert.equal(
  sql(`SELECT count(*) FROM proposal_events WHERE proposal_id='${id}' AND event_type='sent';`),
  "1",
);
assert.equal(
  sql(`SELECT count(*) FROM audit_log WHERE entity_id='${id}' AND action='proposal.sent';`),
  "1",
);
const sent = pair[0].proposal;
input = {
  id,
  operation: "revise",
  patch: { title: "Revised scope" },
  source: "admin",
  reason: null,
  expectedUpdatedAt: sent.updated_at,
};
const revisions = await Promise.all([concurrent(command(input)), concurrent(command(input))]);
assert.equal(revisions[0].successor.id, revisions[1].successor.id);
assert.equal(revisions[0].proposal.status, "superseded");
assert.equal(revisions[0].successor.version, 2);
assert.equal(sql(`SELECT count(*) FROM proposals WHERE supersedes_id='${id}';`), "1");
assert.match(
  fail(command({ ...input, patch: { title: "Conflicting revision" } })),
  /changed|no longer/,
);
assert.match(
  fail(command({ id, operation: "accept", patch: {}, source: "public_link" })),
  /no longer/,
);
assert.match(fail(command({ id, operation: "view", patch: {} }, undefined, other)), /not found/);
const draft = revisions[0].successor;
assert.match(
  fail(
    command({
      id: draft.id,
      operation: "edit",
      patch: { title: "Stale write" },
      expectedUpdatedAt: sent.updated_at,
    }),
  ),
  /changed/,
);
assert.match(fail(command({ id: draft.id, operation: "view", patch: {} })), /not shared/);
const atomic = seed("sent"),
  before = JSON.parse(sql(`SELECT row_to_json(p) FROM proposals p WHERE id='${atomic}';`));
const edit = {
  id: atomic,
  operation: "revise",
  patch: { title: "Atomic revision" },
  expectedUpdatedAt: before.updated_at,
};
sql(
  `CREATE FUNCTION public.fail_proposal_audit_proof() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='proposal.superseded' THEN RAISE EXCEPTION 'controlled proposal audit failure'; END IF;RETURN NEW;END $$;CREATE TRIGGER fail_proposal_audit_proof BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_proposal_audit_proof();`,
);
try {
  assert.match(fail(command(edit)), /controlled proposal audit failure/);
  assert.equal(sql(`SELECT status FROM proposals WHERE id='${atomic}';`), "sent");
  assert.equal(sql(`SELECT count(*) FROM proposals WHERE supersedes_id='${atomic}';`), "0");
  assert.equal(sql(`SELECT count(*) FROM proposal_events WHERE proposal_id='${atomic}';`), "0");
} finally {
  sql(
    "DROP TRIGGER fail_proposal_audit_proof ON audit_log; DROP FUNCTION fail_proposal_audit_proof();",
  );
}
const recovered = JSON.parse(sql(command(edit)));
assert.equal(recovered.successor.version, 2);
const accepted = seed("sent");
assert.equal(
  JSON.parse(sql(command({ id: accepted, operation: "accept", patch: {}, source: "public_link" })))
    .proposal.status,
  "accepted",
);
assert.match(
  fail(command({ id: accepted, operation: "decline", patch: {}, reason: "Changed mind" })),
  /no longer/,
);
const expired = seed("sent");
sql(`UPDATE proposals SET expires_at=now()-interval '1 hour' WHERE id='${expired}';`);
assert.match(fail(command({ id: expired, operation: "accept", patch: {} })), /expired/);
assert.equal(
  JSON.parse(sql(command({ id: expired, operation: "expire", patch: {} }))).proposal.status,
  "expired",
);
sql(
  `UPDATE tenants SET config=jsonb_set(config,'{modules,proposals}','false',true) WHERE id='${tenant}';`,
);
assert.match(fail(command({ id: draft.id, operation: "send", patch: {} })), /unavailable/);
sql(
  `UPDATE tenants SET config=jsonb_set(config,'{modules,proposals}','true',true) WHERE id='${tenant}';`,
);
assert.match(
  fail(
    `SET ROLE authenticated; SELECT apply_proposal_lifecycle('${"a".repeat(64)}','{}','owner@example.test');`,
  ),
  /permission denied/,
);
console.log(
  "PASS: native proposal concurrent replay, one successor, stale writes, terminal/expiry rules, tenant and role isolation, disable and audit-failure rollback/recovery.",
);
