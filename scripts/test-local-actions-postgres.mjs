import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { migrationCatalog, migrationProgram } from "./lib/migration-ledger.mjs";
const root = mkdtempSync(join(tmpdir(), "accelerate-local-actions-"));
const server = createServer();
const port = await new Promise((resolve) =>
  server.listen(0, "127.0.0.1", () => {
    const p = server.address().port;
    server.close(() => resolve(p));
  }),
);
function run(command, args, input) {
  const r = spawnSync(command, args, { input, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
const args = [
  "-X",
  "-qAt",
  "-h",
  "127.0.0.1",
  "-p",
  String(port),
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
];
const sql = (s) => run("psql", args, s);
const quote = (v) => "'" + String(v).replaceAll("'", "''") + "'";
const a = "acce1e8e-0000-4000-8000-000000000001",
  b = "22222222-2222-4222-8222-222222222222",
  u = "11111111-1111-4111-8111-111111111111";
const context = (tenant = a, user = u, actor = "owner@example.test") =>
  `SET ROLE authenticated; SET request.jwt.claim.sub='${user}'; SET request.jwt.claim.role='authenticated'; SET request.jwt.claim.email='${actor}'; SET request.headers='{"x-tenant-id":"${tenant}"}';`;
const call = (id, payload, undo = false, tenant = a) =>
  context(tenant) +
  `SELECT apply_local_action('${id}',${quote(JSON.stringify(payload))}::jsonb,'owner@example.test',${undo});`;
function denied(statement, reason) {
  const r = spawnSync("psql", args, { input: statement, encoding: "utf8" });
  assert.notEqual(r.status, 0, reason);
  return r.stderr;
}
let started = false;
try {
  run("initdb", ["-D", join(root, "data"), "-A", "trust", "-U", "postgres"]);
  run("pg_ctl", [
    "-D",
    join(root, "data"),
    "-l",
    join(root, "server.log"),
    "-o",
    `-h 127.0.0.1 -p ${port} -k ${root}`,
    "-w",
    "start",
  ]);
  started = true;
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE SCHEMA extensions;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('email',current_setting('request.jwt.claim.email',true)) $$;
 GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
 INSERT INTO auth.users VALUES('${u}','owner@example.test');`);
  process.env.BOOTSTRAP_FOUNDER_EMAIL = "owner@example.test";
  process.env.BOOTSTRAP_BRAND_NAME = "Local action proof";
  const catalog = migrationCatalog(process.cwd()).filter(
    (m) => m.file !== "migrations/20260823-command-center-scheduler.sql",
  );
  sql(migrationProgram(catalog));
  sql(migrationProgram(catalog));
  // Native PostgreSQL has no Supabase Data API default ACLs. Grant the existing
  // table privileges explicitly; SET ROLE authenticated still exercises actual
  // catalog RLS. No row policies are replaced and the RPC is SECURITY INVOKER.
  sql(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
 INSERT INTO tenants(id,slug,name,status,config) SELECT '${b}','other-actions','Other','active',config FROM tenants WHERE id='${a}';
 INSERT INTO tenant_memberships(tenant_id,user_id,invited_email,role,status) VALUES('${b}','${u}','owner@example.test','admin','active');`);
  function stage(type, payload, tenant = a) {
    return sql(
      `INSERT INTO action_queue(tenant_id,action_type,title,payload,status,approved_by,approved_at,expires_at,source_context) VALUES('${tenant}',${quote(type)},'Native proof',${quote(JSON.stringify(payload))}::jsonb,'executing','owner@example.test',now(),now()+interval '1 hour','operator_ui') RETURNING id;`,
    );
  }
  const createdPayload = {
    title: "Preserved task",
    description: "Before description",
    priority: "medium",
  };
  const createId = stage("create_task", createdPayload);
  const created = JSON.parse(sql(call(createId, createdPayload))).task;
  denied(call(createId, createdPayload), "replayed execution");
  const editedPayload = {
    taskId: created.id,
    changeType: "edit",
    description: "Changed description",
    title: "Changed",
    expectedState: created,
  };
  const editId = stage("update_task", editedPayload);
  const edited = JSON.parse(sql(call(editId, editedPayload)));
  assert.equal(edited.description, "Changed description");
  const undo = sql(call(editId, editedPayload, true));
  assert.equal(sql(call(editId, editedPayload, true)), undo);
  assert.equal(
    sql(`SELECT description FROM tasks WHERE id='${created.id}';`),
    "Before description",
  );
  assert.equal(
    sql(
      `SELECT count(*) FROM audit_log WHERE action='action.compensated' AND entity_id='${editId}';`,
    ),
    "1",
  );
  const state = JSON.parse(sql(`SELECT to_jsonb(tasks) FROM tasks WHERE id='${created.id}';`));
  const deletePayload = { taskId: created.id, expectedState: state };
  const deleteId = stage("delete_task", deletePayload);
  sql(call(deleteId, deletePayload));
  assert.equal(sql(`SELECT count(*) FROM tasks WHERE id='${created.id}';`), "0");
  sql(call(deleteId, deletePayload, true));
  assert.deepEqual(
    JSON.parse(sql(`SELECT to_jsonb(tasks) FROM tasks WHERE id='${created.id}';`)),
    state,
  );
  // Exact stale preview, changed approval payload, foreign tenant and spoofed actor.
  const stale = stage("update_task", editedPayload);
  sql(`UPDATE tasks SET description='Human correction' WHERE id='${created.id}';`);
  denied(call(stale, editedPayload), "stale target");
  denied(call(stale, { ...editedPayload, title: "Tampered" }), "changed payload");
  denied(call(stale, editedPayload, false, b), "foreign tenant");
  denied(
    call(stale, editedPayload).replace("'owner@example.test',false", "'spoof@example.test',false"),
    "spoofed actor",
  );
  denied(call(createId, createdPayload, true), "stale inverse must preserve human correction");
  assert.equal(sql(`SELECT description FROM tasks WHERE id='${created.id}';`), "Human correction");
  // Native audit failure rolls back the task effect and terminal receipt.
  sql(
    `CREATE FUNCTION public.refuse_action_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='action.executed' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER refuse_action_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION refuse_action_audit();`,
  );
  const failPayload = { title: "Must roll back" };
  const failId = stage("create_task", failPayload);
  denied(call(failId, failPayload), "audit failure");
  assert.equal(sql(`SELECT count(*) FROM tasks WHERE title='Must roll back';`), "0");
  assert.equal(sql(`SELECT status FROM action_queue WHERE id='${failId}';`), "executing");
  sql("DROP TRIGGER refuse_action_audit ON audit_log;");
  const retry = JSON.parse(sql(call(failId, failPayload))).task;
  sql(call(failId, failPayload, true));
  assert.equal(sql(`SELECT count(*) FROM tasks WHERE id='${retry.id}';`), "0");
  const policyPayload = { title: "Refused by revoked policy" };
  const policyId = stage("create_task", policyPayload);
  sql(
    `INSERT INTO autonomy_policies(tenant_id,action_key,label,level,source) VALUES('${a}','create_task','Native test','prohibited','system');`,
  );
  denied(call(policyId, policyPayload), "policy revoked before apply");
  assert.equal(sql("SELECT count(*) FROM tasks WHERE title='Refused by revoked policy';"), "0");
  sql(`DELETE FROM autonomy_policies WHERE tenant_id='${a}' AND action_key='create_task';`);
  // Two simultaneous executions contend on the same canonical queue lock.
  const concurrentPayload = { title: "Concurrent task" };
  const concurrentId = stage("create_task", concurrentPayload);
  const attempt = () =>
    new Promise((resolve) => {
      const child = spawn("psql", args, { stdio: ["pipe", "ignore", "ignore"] });
      child.on("close", resolve);
      child.stdin.end(call(concurrentId, concurrentPayload));
    });
  const outcomes = await Promise.all([attempt(), attempt()]);
  assert.equal(outcomes.filter((code) => code === 0).length, 1);
  assert.equal(sql("SELECT count(*) FROM tasks WHERE title='Concurrent task';"), "1");
  const dedupePayload = { title: "Existing logical task", dedupeKey: "native-dedupe" };
  const original = stage("create_task", dedupePayload);
  sql(call(original, dedupePayload));
  const duplicate = stage("create_task", dedupePayload);
  assert.equal(JSON.parse(sql(call(duplicate, dedupePayload))).deduplicated, true);
  sql(call(duplicate, dedupePayload, true));
  assert.equal(sql("SELECT count(*) FROM tasks WHERE dedupe_key='native-dedupe';"), "1");
  // Opportunity inverse uses an exact captured post-state too.
  const opp = sql(
    `INSERT INTO opportunities(tenant_id,name,stage,next_action) VALUES('${a}','Native opportunity','new','Original step') RETURNING to_jsonb(opportunities);`,
  );
  const old = JSON.parse(opp),
    nextPayload = { opportunityId: old.id, nextAction: "New step", expectedState: old };
  const nextId = stage("update_next_action", nextPayload);
  sql(call(nextId, nextPayload));
  sql(call(nextId, nextPayload, true));
  assert.equal(sql(`SELECT next_action FROM opportunities WHERE id='${old.id}';`), "Original step");
  // System source text never grants authority to an authenticated caller.
  const systemPayload = {
    title: "System follow-up",
    source: "delivery_handoff",
    dedupeKey: "system-task",
    assigneeUserId: u,
    description: "Preserved source summary",
  };
  const systemCall = `SELECT create_revenue_task(${quote(JSON.stringify(systemPayload))}::jsonb,'system',NULL,NULL,'native-system');`;
  denied(context() + systemCall, "caller text cannot grant system authority");
  const machineContext = `SET ROLE service_role; SET request.jwt.claim.role='service_role'; SET request.headers='{"x-tenant-id":"${a}"}';`;
  const machineTask = JSON.parse(sql(machineContext + systemCall)).task;
  assert.equal(machineTask.assigned_to, u);
  assert.equal(machineTask.source, "delivery_handoff");
  sql(`UPDATE tasks SET status='completed' WHERE id='${machineTask.id}';`);
  assert.equal(JSON.parse(sql(machineContext + systemCall)).task.id, machineTask.id);
  assert.equal(
    sql(
      `SELECT metadata->>'authority' FROM audit_log WHERE action='task.created' AND entity_id='${machineTask.id}';`,
    ),
    "deterministic_system",
  );
  assert.equal(
    sql(`SELECT summary FROM activities WHERE external_id='task:${machineTask.id}:created';`),
    "Preserved source summary",
  );
  const item = {
    title: "Exact approved batch task",
    description: "Approved detail",
    dueDate: "2026-10-01",
    assigneeUserId: u,
  };
  sql(`UPDATE opportunities SET stage='won' WHERE id='${old.id}';`);
  const batchPayload = {
    opportunityId: old.id,
    expectedState: "won",
    tasks: [item],
    pluginOrigin: { id: "client-onboarding" },
  };
  const parentId = stage("create_task_batch", batchPayload);
  const effectKey =
    "plugin:" +
    createHash("sha256")
      .update(JSON.stringify({ pluginId: "client-onboarding", source: old.id, ...item }))
      .digest("hex");
  const child = {
    ...item,
    source: "plugin",
    dedupeKey: effectKey,
    opportunityId: old.id,
    relatedType: "opportunity",
    relatedId: old.id,
    relatedName: "Native opportunity",
  };
  const childCall = (input = child, approved = batchPayload) =>
    context() +
    `SELECT create_revenue_task(${quote(JSON.stringify(input))}::jsonb,'owner@example.test','${parentId}',${quote(JSON.stringify(approved))}::jsonb,NULL);`;
  const childTask = JSON.parse(sql(childCall())).task;
  assert.equal(sql(`SELECT status FROM action_queue WHERE id='${parentId}';`), "executing");
  assert.equal(
    sql(
      `SELECT metadata->>'authority' FROM audit_log WHERE action='task.created' AND entity_id='${childTask.id}';`,
    ),
    "parent_approval",
  );
  denied(childCall({ ...child, title: "Unapproved task" }), "child outside approved membership");
  denied(childCall({ ...child, dedupeKey: "different-key" }), "changed effect key");
  denied(childCall(child, { ...batchPayload, tasks: [] }), "changed parent payload");
  sql(`UPDATE tasks SET status='completed' WHERE id='${childTask.id}';`);
  assert.equal(JSON.parse(sql(childCall())).task.id, childTask.id);
  const direct = (input, provenance, actor = "owner@example.test") =>
    context() +
    `SELECT private.create_task_effect(${quote(JSON.stringify(input))}::jsonb,${quote(actor)},${quote(JSON.stringify(provenance))}::jsonb);`;
  denied(
    direct(systemPayload, { authority: "human_approval" }),
    "direct writer cannot forge human authority",
  );
  denied(
    direct(systemPayload, { systemSource: "claimed-system" }),
    "direct writer cannot forge machine authority",
  );
  denied(
    direct(child, { actionId: parentId, payload: batchPayload }, "someone-else@example.test"),
    "direct writer cannot forge actor",
  );
  denied(
    direct(
      { ...child, title: "Forged direct child" },
      { actionId: parentId, payload: batchPayload },
    ),
    "direct writer enforces exact parent membership",
  );
  denied(
    direct(child, { actionId: "33333333-3333-4333-8333-333333333333", payload: batchPayload }),
    "missing parent",
  );
  sql(`UPDATE action_queue SET approved_at=NULL WHERE id='${parentId}';`);
  denied(childCall(), "missing approval timestamp");
  sql(`UPDATE action_queue SET approved_at=now(),expires_at=NULL WHERE id='${parentId}';`);
  denied(childCall(), "missing parent expiry");
  sql(`UPDATE action_queue SET expires_at=now()+interval '1 hour' WHERE id='${parentId}';`);
  sql(`UPDATE opportunities SET stage='discovery' WHERE id='${old.id}';`);
  denied(childCall(), "changed source before duplicate replay");
  sql(`UPDATE opportunities SET stage='won' WHERE id='${old.id}';`);
  for (const description of [null, 'Quotes " and backslash \\ and unicode 雪 ☃']) {
    const specialItem = {
      ...item,
      title: `Hash parity ${description === null ? "null" : "escaped"}`,
      description,
    };
    const payload = { ...batchPayload, tasks: [specialItem] };
    const id = stage("create_task_batch", payload);
    const key =
      "plugin:" +
      createHash("sha256")
        .update(JSON.stringify({ pluginId: "client-onboarding", source: old.id, ...specialItem }))
        .digest("hex");
    const input = { ...child, ...specialItem, dedupeKey: key };
    const result = JSON.parse(sql(direct(input, { actionId: id, payload })));
    assert.equal(result.task.dedupe_key, key, "SQL serialization matches JSON.stringify exactly");
  }
  const missingSource = { ...batchPayload, opportunityId: "33333333-3333-4333-8333-333333333333" };
  const missingParent = stage("create_task_batch", missingSource);
  denied(
    direct(
      {
        ...child,
        opportunityId: missingSource.opportunityId,
        relatedId: missingSource.opportunityId,
      },
      { actionId: missingParent, payload: missingSource },
    ),
    "missing source",
  );
  sql(`UPDATE tenant_memberships SET status='revoked' WHERE tenant_id='${a}' AND user_id='${u}';`);
  denied(call(failId, failPayload, true), "revoked member even on undo replay");
  assert.equal(sql(`SELECT prosecdef FROM pg_proc WHERE proname='apply_local_action';`), "f");
  console.log(
    JSON.stringify({
      result: "passed",
      proofs: [
        "full-business-catalog-twice",
        "four-seeded-inverses",
        "system-provenance-and-permanent-dedupe",
        "exact-parent-task-membership-and-key",
        "assignment-and-activity-preserved",
        "description-and-identity-restoration",
        "execution-replay",
        "revoked-policy-at-apply",
        "concurrent-queue-claim",
        "deduped-task-never-deleted-by-new-inverse",
        "undo-replay-one-audit",
        "stale-preview",
        "payload-binding",
        "cross-tenant",
        "actor-binding",
        "stale-undo",
        "audit-rollback-and-safe-retry",
        "revoked-member",
        "security-invoker",
      ],
    }),
  );
} finally {
  if (started) run("pg_ctl", ["-D", join(root, "data"), "-m", "immediate", "-w", "stop"]);
  rmSync(root, { recursive: true, force: true });
}
