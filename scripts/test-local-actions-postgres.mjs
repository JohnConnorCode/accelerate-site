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
  sql(`UPDATE opportunities SET stage='qualified' WHERE id='${old.id}';`);
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
  const pipelineColumns = () =>
    JSON.parse(
      sql(
        `SELECT jsonb_agg(jsonb_build_object('column_key',column_key,'label',label,'metadata',metadata) ORDER BY column_key) FROM kanban_columns WHERE tenant_id='${a}' AND board_key='pipeline';`,
      ),
    );
  const pipelineState = () =>
    JSON.parse(sql(`SELECT to_jsonb(o) FROM opportunities o WHERE id='${old.id}';`));
  const stagePayload = (stageName, extra = {}) => ({
    opportunityId: old.id,
    stage: stageName,
    expectedState: pipelineState(),
    expectedPipeline: pipelineColumns(),
    ...extra,
  });
  const pipelineCall = (id, operation, payload, asSystem = false, actor = "owner@example.test") =>
    (asSystem ? machineContext : context()) +
    `SELECT apply_pipeline_action(${id ? quote(id) : "NULL"},${quote(operation)},${quote(JSON.stringify(payload))}::jsonb,${quote(actor)},${asSystem ? "'native-pipeline'" : "NULL"});`;
  sql(`UPDATE opportunities SET stage='qualified' WHERE id='${old.id}';`);
  const move = stagePayload("proposal", {
    source: "admin_bookings",
    reason: "Reviewed pipeline move",
    sortOrder: 2.5,
  });
  const moveId = stage("transition_opportunity", move);
  const moved = JSON.parse(sql(pipelineCall(moveId, "transition_opportunity", move)));
  assert.equal(moved.opportunity.stage, "proposal");
  assert.equal(Number(moved.opportunity.sort_order), 2.5);
  assert.equal(
    JSON.parse(sql(pipelineCall(moveId, "transition_opportunity", move))).changed,
    false,
    "exact queue replay returns saved effect",
  );
  assert.equal(
    sql(
      `SELECT count(*) FROM stage_events WHERE opportunity_id='${old.id}' AND metadata->>'actionId'='${moveId}';`,
    ),
    "1",
  );
  assert.equal(
    sql(`SELECT source FROM stage_events WHERE metadata->>'actionId'='${moveId}';`),
    "admin_bookings",
  );
  denied(
    pipelineCall(moveId, "transition_opportunity", move, false, "forged@example.test"),
    "pipeline replay actor binding",
  );
  const changedColumns = stagePayload("meeting");
  const changedColumnsId = stage("transition_opportunity", changedColumns);
  sql(
    `UPDATE kanban_columns SET label=label||' changed' WHERE tenant_id='${a}' AND board_key='pipeline' AND column_key='meeting';`,
  );
  denied(
    pipelineCall(changedColumnsId, "transition_opportunity", changedColumns),
    "pipeline stage configuration changed since approval",
  );
  const stalePipeline = stagePayload("meeting");
  const stalePipelineId = stage("transition_opportunity", stalePipeline);
  sql(`UPDATE opportunities SET next_action='Concurrent change' WHERE id='${old.id}';`);
  denied(
    pipelineCall(stalePipelineId, "transition_opportunity", stalePipeline),
    "full pipeline record state binding",
  );
  const detail = {
    opportunityId: old.id,
    expectedState: pipelineState(),
    patch: { next_action: null, next_action_at: null, estimated_value: 1234 },
  };
  const detailId = stage("update_opportunity_details", detail);
  const detailed = JSON.parse(sql(pipelineCall(detailId, "update_opportunity_details", detail)));
  assert.equal(detailed.opportunity.next_action, null);
  assert.equal(detailed.opportunity.next_action_at, null);
  assert.equal(Number(detailed.opportunity.estimated_value), 1234);
  assert.equal(
    sql(`SELECT reversibility FROM action_queue WHERE id='${detailId}';`),
    "compensable",
  );
  const revokedMove = stagePayload("meeting");
  const revokedMoveId = stage("transition_opportunity", revokedMove);
  sql(
    `INSERT INTO autonomy_policies(tenant_id,action_key,label,level,source) VALUES('${a}','transition_opportunity','Native pipeline','prohibited','system');`,
  );
  denied(
    pipelineCall(revokedMoveId, "transition_opportunity", revokedMove),
    "revoked pipeline policy before apply",
  );
  sql(
    `DELETE FROM autonomy_policies WHERE tenant_id='${a}' AND action_key='transition_opportunity';`,
  );
  const systemMove = stagePayload("meeting", {
    source: "calendly_webhook",
    effectKey: "calendly-native-event:created",
    reason: "Verified booking",
  });
  denied(
    context() +
      `SELECT apply_pipeline_action(NULL,'transition_opportunity',${quote(JSON.stringify(systemMove))}::jsonb,'owner@example.test','spoofed-system');`,
    "pipeline system provenance cannot be caller text",
  );
  assert.equal(
    JSON.parse(sql(pipelineCall(null, "transition_opportunity", systemMove, true, "calendly")))
      .changed,
    true,
  );
  const systemReplay = stagePayload("meeting", {
    source: "calendly_webhook",
    effectKey: "calendly-native-event:created",
    reason: "Verified booking",
  });
  assert.equal(
    JSON.parse(sql(pipelineCall(null, "transition_opportunity", systemReplay, true, "calendly")))
      .changed,
    false,
  );
  assert.equal(
    sql(
      `SELECT count(*) FROM stage_events WHERE opportunity_id='${old.id}' AND source='calendly_webhook';`,
    ),
    "1",
  );
  sql(`UPDATE opportunities SET stage='qualified' WHERE id='${old.id}';`);
  assert.equal(
    JSON.parse(sql(pipelineCall(null, "transition_opportunity", systemReplay, true, "calendly")))
      .opportunity.stage,
    "meeting",
    "Replay returns original receipt",
  );
  assert.equal(
    pipelineState().stage,
    "qualified",
    "Source replay never overwrites an intervening change",
  );
  denied(
    pipelineCall(
      null,
      "transition_opportunity",
      { ...systemReplay, reason: "Different source intent" },
      true,
      "calendly",
    ),
    "source effect key binds exact intent",
  );
  denied(
    pipelineCall(null, "transition_opportunity", systemReplay, true, "different-actor"),
    "source effect key binds original actor",
  );
  denied(
    pipelineCall(
      null,
      "transition_opportunity",
      { ...systemReplay, effectKey: null },
      true,
      "calendly",
    ),
    "source effect key required",
  );
  denied(
    context() +
      `INSERT INTO audit_log(tenant_id,actor_email,action,entity_type,entity_id,metadata) VALUES('${a}','owner@example.test','pipeline.system_receipt','opportunity','${old.id}','{}');`,
    "authenticated cannot forge system receipt",
  );
  denied(
    context() +
      `UPDATE audit_log SET action='pipeline.system_receipt' WHERE action='opportunity.stage_changed' AND entity_id='${old.id}';`,
    "authenticated cannot transform ordinary audit into system receipt",
  );
  assert.equal(
    sql(
      context() +
        `WITH changed AS (UPDATE audit_log SET actor_email='forged' WHERE action='pipeline.system_receipt' RETURNING id) SELECT count(*) FROM changed;`,
    ),
    "0",
    "system receipt cannot be edited by authenticated",
  );
  assert.equal(
    sql(
      context() +
        `WITH removed AS (DELETE FROM audit_log WHERE action='pipeline.system_receipt' RETURNING id) SELECT count(*) FROM removed;`,
    ),
    "0",
    "system receipt cannot be deleted by authenticated",
  );
  const closed = stagePayload("won");
  const closeId = stage("transition_opportunity", closed);
  sql(pipelineCall(closeId, "transition_opportunity", closed));
  const reopen = stagePayload("meeting", { reason: "Reviewed reopen" });
  const reopenId = stage("transition_opportunity", reopen);
  denied(
    pipelineCall(reopenId, "transition_opportunity", reopen),
    "terminal reopen requires explicit policy",
  );
  const allowedReopen = stagePayload("meeting", {
    reason: "Reviewed reopen",
    allowTerminalReopen: true,
  });
  const allowedReopenId = stage("transition_opportunity", allowedReopen);
  assert.equal(
    JSON.parse(sql(pipelineCall(allowedReopenId, "transition_opportunity", allowedReopen)))
      .opportunity.closed_at,
    null,
  );
  const rollbackMove = stagePayload("proposal", { reason: "Atomic pipeline rollback" });
  const rollbackMoveId = stage("transition_opportunity", rollbackMove);
  sql(
    `CREATE FUNCTION public.fail_pipeline_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='opportunity.stage_changed' AND NEW.entity_id='${old.id}' THEN RAISE EXCEPTION 'injected pipeline audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER native_pipeline_audit_failure BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION public.fail_pipeline_audit();`,
  );
  denied(
    pipelineCall(rollbackMoveId, "transition_opportunity", rollbackMove),
    "pipeline audit failure rolls back effect",
  );
  assert.equal(pipelineState().stage, "meeting");
  assert.equal(
    sql(`SELECT count(*) FROM stage_events WHERE metadata->>'actionId'='${rollbackMoveId}';`),
    "0",
  );
  sql(
    `DROP TRIGGER native_pipeline_audit_failure ON audit_log; DROP FUNCTION public.fail_pipeline_audit();`,
  );
  assert.equal(
    JSON.parse(sql(pipelineCall(rollbackMoveId, "transition_opportunity", rollbackMove)))
      .opportunity.stage,
    "proposal",
  );
  denied(
    context(b) +
      `SELECT apply_pipeline_action('${rollbackMoveId}','transition_opportunity',${quote(JSON.stringify(rollbackMove))}::jsonb,'owner@example.test',NULL);`,
    "pipeline cross tenant receipt unavailable",
  );
  // Opportunity creation and identity resolution share the exact same transaction.
  const creationInput = {
    identity: {
      name: "New Contact",
      email: "new-contact@atomic.example",
      domain: "atomic.example",
      source: "manual",
    },
    record: {
      name: "Atomic creation",
      email: "new-contact@atomic.example",
      source: "manual",
      estimated_value: 4200,
      next_action_at: null,
    },
  };
  const creationId = stage("create_opportunity", creationInput);
  sql(
    `CREATE FUNCTION public.fail_create_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='opportunity.created' THEN RAISE EXCEPTION 'injected creation receipt failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER native_create_failure BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION public.fail_create_audit();`,
  );
  denied(
    pipelineCall(creationId, "create_opportunity", creationInput),
    "creation receipt rollback",
  );
  assert.equal(
    sql("SELECT count(*) FROM contacts WHERE primary_email='new-contact@atomic.example';"),
    "0",
  );
  assert.equal(sql("SELECT count(*) FROM companies WHERE domain='atomic.example';"), "0");
  assert.equal(sql("SELECT count(*) FROM opportunities WHERE name='Atomic creation';"), "0");
  sql("DROP TRIGGER native_create_failure ON audit_log; DROP FUNCTION public.fail_create_audit();");
  const created = JSON.parse(
    sql(pipelineCall(creationId, "create_opportunity", creationInput)),
  ).opportunity;
  assert.equal(created.stage, "new");
  assert.equal(created.estimated_value, 4200);
  assert.equal(created.qualified, false);
  assert.equal(
    JSON.parse(sql(pipelineCall(creationId, "create_opportunity", creationInput))).opportunity.id,
    created.id,
  );
  assert.equal(sql(`SELECT count(*) FROM stage_events WHERE opportunity_id='${created.id}';`), "1");
  denied(
    context(b) + `SELECT resolve_revenue_identity('${JSON.stringify(creationInput.identity)}');`,
    "identity tenant membership required",
  );
  const sourceCreation = {
    ...creationInput,
    identity: undefined,
    record: {
      ...creationInput.record,
      source_record_type: "conversation",
      source_record_id: "66666666-6666-4666-8666-666666666666",
    },
  };
  const sourceCreated = JSON.parse(
    sql(
      pipelineCall(
        stage("create_opportunity", sourceCreation),
        "create_opportunity",
        sourceCreation,
      ),
    ),
  ).opportunity;
  sql(`UPDATE opportunities SET name='Human correction' WHERE id='${sourceCreated.id}';`);
  const sourceReused = JSON.parse(
    sql(
      pipelineCall(
        stage("create_opportunity", sourceCreation),
        "create_opportunity",
        sourceCreation,
      ),
    ),
  );
  assert.equal(sourceReused.opportunity.id, sourceCreated.id);
  assert.equal(sourceReused.opportunity.name, "Human correction");
  assert.equal(sourceReused.changed, false);
  const wildcardIdentity = {
    name: "Literal email",
    email: "wild_%@example.test",
    domain: "wildcard.example",
    source: "native",
  };
  const literal = JSON.parse(
    sql(
      context() +
        `SELECT resolve_revenue_identity(${quote(JSON.stringify(wildcardIdentity))}::jsonb);`,
    ),
  );
  sql(`UPDATE contacts SET full_name='Human-confirmed name' WHERE id='${literal.contact.id}';`);
  const preserved = JSON.parse(
    sql(
      context() +
        `SELECT resolve_revenue_identity(${quote(JSON.stringify({ ...wildcardIdentity, name: "Incoming name" }))}::jsonb);`,
    ),
  );
  assert.equal(preserved.contact.id, literal.contact.id);
  assert.equal(preserved.contact.full_name, "Human-confirmed name");
  const sameIdentity = JSON.parse(
    sql(
      context() + `SELECT resolve_revenue_identity('${JSON.stringify(creationInput.identity)}');`,
    ),
  );
  assert.equal(sameIdentity.contact.id, created.contact_id);
  assert.equal(sameIdentity.company.id, created.company_id);
  assert.equal(sql("SELECT prosecdef FROM pg_proc WHERE proname='resolve_revenue_identity';"), "f");
  // Distinct primary/alternate matches are ambiguous and cannot leave a company behind.
  sql(
    `INSERT INTO contacts(tenant_id,full_name,primary_email,alternate_emails) VALUES('${a}','Conflicting alias','other-atomic@example.test',ARRAY['new-contact@atomic.example']);`,
  );
  const ambiguityInput = { ...creationInput.identity, domain: "must-rollback.example" };
  denied(
    context() + `SELECT resolve_revenue_identity(${quote(JSON.stringify(ambiguityInput))}::jsonb);`,
    "ambiguous identity refuses whole transaction",
  );
  assert.equal(sql("SELECT count(*) FROM companies WHERE domain='must-rollback.example';"), "0");
  const reorderRows = () =>
    JSON.parse(
      sql(
        `SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM opportunities o WHERE id IN ('${old.id}','${created.id}');`,
      ),
    );
  const reorderPayload = {
    expectedPipeline: pipelineColumns(),
    updates: reorderRows().map((o) => ({ id: o.id, column_key: o.stage, sort_order: 15 })),
    expectedState: reorderRows(),
  };
  const staleReorder = { ...reorderPayload, expectedPipeline: [] };
  denied(
    pipelineCall(
      stage("reorder_opportunities", staleReorder),
      "reorder_opportunities",
      staleReorder,
    ),
    "stale column snapshot rejects reorder",
  );
  const reorderId = stage("reorder_opportunities", reorderPayload);
  const reordered = JSON.parse(
    sql(pipelineCall(reorderId, "reorder_opportunities", reorderPayload)),
  ).result;
  assert.equal(reordered.affected, 2);
  assert.deepEqual(
    reordered.opportunities.map((o) => o.stage),
    reorderPayload.expectedState.map((o) => o.stage),
  );
  assert.equal(
    JSON.parse(sql(pipelineCall(reorderId, "reorder_opportunities", reorderPayload))).changed,
    false,
  );
  const wrongStage = {
    expectedPipeline: pipelineColumns(),
    updates: [{ id: created.id, column_key: "won", sort_order: 99 }],
    expectedState: reorderRows().filter((o) => o.id === created.id),
  };
  denied(
    pipelineCall(stage("reorder_opportunities", wrongStage), "reorder_opportunities", wrongStage),
    "reorder cannot bypass stage policy",
  );
  const missingReorder = {
    expectedPipeline: pipelineColumns(),
    updates: [
      { id: created.id, column_key: "new", sort_order: 99 },
      { id: "77777777-7777-4777-8777-777777777777", column_key: "new", sort_order: 99 },
    ],
    expectedState: reorderRows().filter((o) => o.id === created.id),
  };
  denied(
    pipelineCall(
      stage("reorder_opportunities", missingReorder),
      "reorder_opportunities",
      missingReorder,
    ),
    "missing row rejects whole reorder",
  );
  assert.equal(sql(`SELECT sort_order FROM opportunities WHERE id='${created.id}';`), "15");
  const duplicateReorder = {
    expectedPipeline: pipelineColumns(),
    updates: [wrongStage.updates[0], wrongStage.updates[0]],
    expectedState: wrongStage.expectedState,
  };
  denied(
    pipelineCall(
      stage("reorder_opportunities", duplicateReorder),
      "reorder_opportunities",
      duplicateReorder,
    ),
    "duplicate IDs refused",
  );
  denied(
    context() +
      `SELECT reorder_kanban_items('pipeline',${quote(JSON.stringify(reorderPayload.updates))}::jsonb);`,
    "old direct pipeline reorder refused",
  );
  assert.equal(sql(context() + "SELECT reorder_kanban_items('content','[]');"), "0");
  assert.equal(sql(machineContext + "SELECT reorder_kanban_items('features','[]');"), "0");
  const invalidRecord = {
    opportunityId: created.id,
    expectedState: JSON.parse(
      sql(`SELECT to_jsonb(o) FROM opportunities o WHERE id='${created.id}';`),
    ),
    patch: { tenant_id: b, stage: "won" },
  };
  denied(
    pipelineCall(
      stage("update_opportunity_record", invalidRecord),
      "update_opportunity_record",
      invalidRecord,
    ),
    "record operation cannot mutate tenant/stage",
  );
  const wrongIdentity = { ...invalidRecord, patch: { contact_id: old.id } };
  denied(
    pipelineCall(
      stage("update_opportunity_record", wrongIdentity),
      "update_opportunity_record",
      wrongIdentity,
    ),
    "ordinary record operation cannot relink identity",
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
        "atomic-opportunity-and-identity-rollback-replay",
        "identity-ambiguity-and-tenant-authority",
        "same-stage-reorder-complete-batch-and-replay",
        "old-pipeline-reorder-bypass-refused",
        "fixed-opportunity-fields-and-identity-boundary",
        "pipeline-owner-atomic-authority-state-and-replay",
        "pipeline-live-column-and-terminal-policy",
        "pipeline-source-provenance-and-null-details",
        "pipeline-audit-rollback-and-retry",
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
