import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
const root = mkdtempSync(join(tmpdir(), "conversational-agent-pg-"));
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    server.close(() => resolve(port));
  });
});
const run = (cmd, args, input) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", input, maxBuffer: 8 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout.trim();
};
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
const sql = (text) => run("psql", args, text);
const t = randomUUID(),
  other = randomUUID(),
  user = randomUUID(),
  target = randomUUID(),
  foreign = randomUUID();
const prefix = (role = "authenticated", actor = user) =>
  `SET ROLE ${role}; SET app.tenant='${t}'; SET app.actor='${actor}'; `;
const as = (q) => sql(prefix() + q);
const result = (q) => JSON.parse(as(q));
let started = false;
try {
  run("initdb", ["-D", join(root, "data"), "-A", "trust", "-U", "postgres"]);
  run("pg_ctl", [
    "-D",
    join(root, "data"),
    "-l",
    join(root, "postgres.log"),
    "-o",
    `-h 127.0.0.1 -p ${port} -k ${root}`,
    "-w",
    "start",
  ]);
  started = true;
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE SCHEMA private;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.actor',true),'')::uuid $$;
 CREATE FUNCTION private.request_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.tenant',true),'')::uuid $$;
 CREATE FUNCTION private.authorized_request_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT private.request_tenant_id() $$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
 CREATE TABLE public.tenants(id uuid PRIMARY KEY,status text);
 CREATE TABLE public.tenant_memberships(tenant_id uuid,user_id uuid,status text,role text);
 CREATE FUNCTION private.has_active_tenant_membership(t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.tenant_memberships m JOIN public.tenants ten ON ten.id=m.tenant_id WHERE m.tenant_id=t AND m.user_id=auth.uid() AND m.status='active' AND ten.status='active') $$;
 CREATE TABLE public.work_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,kind text,dedupe_key text,status text);
 ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
 GRANT USAGE ON SCHEMA private,auth TO authenticated; GRANT SELECT,INSERT,UPDATE ON public.work_items TO authenticated;
 CREATE TABLE public.action_queue(id uuid PRIMARY KEY,tenant_id uuid,action_type text,status text,expires_at timestamptz,payload jsonb,proposed_by text,approved_by text,work_item_id uuid);
 CREATE TYPE public.autonomy_level AS ENUM ('prohibited','always_ask','ask_until_trusted','standing_permission','autonomous'); CREATE TABLE public.autonomy_policies(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,action_key text,label text,description text,level public.autonomy_level,constraints jsonb,coworker_id text,source text,approved_by text,approved_at timestamptz,is_hard_floor boolean DEFAULT false,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
 CREATE TABLE public.autonomy_hard_floors(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,action_key text,reason text);
 CREATE TABLE public.audit_log(tenant_id uuid,actor_email text,action text,entity_type text,entity_id text,source text,after_state jsonb,metadata jsonb);
 CREATE TABLE public.kanban_columns(tenant_id uuid,board_key text,column_key text,metadata jsonb);
 CREATE TABLE public.tasks(tenant_id uuid,id uuid); CREATE TABLE public.contacts(tenant_id uuid,id uuid); CREATE TABLE public.companies(tenant_id uuid,id uuid); CREATE TABLE public.opportunities(tenant_id uuid,id uuid);
 INSERT INTO public.tenants VALUES('${t}','active'),('${other}','active'); INSERT INTO auth.users VALUES('${user}','admin@example.test'); INSERT INTO public.tenant_memberships VALUES('${t}','${user}','active','admin'); INSERT INTO public.opportunities VALUES('${t}','${target}'),('${other}','${foreign}');`);
  const old = readFileSync("migrations/20260902-autonomy-policies.sql", "utf8");
  sql(old.match(/CREATE OR REPLACE FUNCTION public\.check_autonomy\([\s\S]*?\$\$;/)[0]);
  const migration = readFileSync(
    "migrations/20260930190623_conversational_agent_runtime.sql",
    "utf8",
  );
  sql(migration);
  sql(migration);
  sql(
    `CREATE TABLE public.workspace_mcp_delegations(id uuid, tenant_id uuid, user_id uuid, client_id text, resource text, revoked_at timestamptz, expires_at timestamptz); CREATE TABLE auth.sessions(id uuid, user_id uuid);`,
  );
  const oauth = readFileSync("migrations/20261001-workspace-mcp-oauth.sql", "utf8");
  sql(
    oauth.match(/CREATE FUNCTION public\.authorize_workspace_mcp_delegation\([\s\S]*?END \$\$;/)[0],
  );
  const constraints = {
    actionKey: "create_task",
    actorId: user,
    recordIds: [target],
    allowedFields: ["title", "priority"],
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    maxDailyActions: 1,
  };
  const grant = randomUUID();
  sql(
    `INSERT INTO public.action_queue VALUES('${grant}','${t}','internal_permission_change','executing',now()+interval '1 hour','${JSON.stringify({ constraints })}'::jsonb,'admin@example.test','admin@example.test',NULL);`,
  );
  assert.equal(
    result(
      `SELECT public.execute_internal_permission('${grant}','${user}','${JSON.stringify(constraints)}'::jsonb)`,
    ).status,
    "granted",
  );
  const action = (payload, type = "create_task") => {
    const id = randomUUID();
    sql(
      `INSERT INTO public.action_queue VALUES('${id}','${t}','${type}','executing',now()+interval '1 hour','${JSON.stringify(payload)}'::jsonb,'admin@example.test',NULL,NULL);`,
    );
    return id;
  };
  const permitted = action({ opportunityId: target, title: "Follow up", priority: "high" });
  assert.equal(
    result(`SELECT public.reserve_internal_action('${permitted}','${user}',false)`).allowed,
    true,
  );
  const outside = action({ opportunityId: foreign, title: "Follow up", priority: "high" });
  assert.equal(
    result(`SELECT public.reserve_internal_action('${outside}','${user}',false)`).allowed,
    false,
  );
  const field = action({
    opportunityId: target,
    title: "Follow up",
    priority: "high",
    dueDate: "2026-10-01",
  });
  assert.match(
    result(`SELECT public.reserve_internal_action('${field}','${user}',false)`).reason,
    /Field/,
  );
  const outbound = action({ to: "someone@example.test", body: "Send" }, "send_email");
  assert.equal(
    result(`SELECT public.reserve_internal_action('${outbound}','${user}',false)`).allowed,
    false,
  );
  const attempts = Array.from({ length: 12 }, () =>
    action({ opportunityId: target, title: "Concurrent task", priority: "medium" }),
  );
  const exec = promisify(execFile);
  const admissions = await Promise.all(
    attempts.map((id) =>
      exec("psql", [
        ...args,
        "-c",
        prefix() + `SELECT public.reserve_internal_action('${id}','${user}',true)`,
      ]).then(({ stdout }) => JSON.parse(stdout.trim())),
    ),
  );
  assert.equal(admissions.filter((r) => r.allowed).length, 1);
  const winner = attempts[admissions.findIndex((r) => r.allowed)];
  assert.equal(
    result(`SELECT public.reserve_internal_action('${winner}','${user}',true)`).allowed,
    true,
  );
  assert.equal(sql("SELECT count(*) FROM public.internal_action_reservations"), "1");
  sql(
    `UPDATE public.autonomy_policies SET constraints=jsonb_set(constraints,'{expiresAt}','"2000-01-01T00:00:00Z"')`,
  );
  assert.equal(
    result(`SELECT public.reserve_internal_action('${permitted}','${user}',false)`).allowed,
    false,
  );
  sql(
    `UPDATE public.autonomy_policies SET constraints='${JSON.stringify(constraints)}'::jsonb; UPDATE public.tenant_memberships SET status='revoked'`,
  );
  assert.equal(
    result(`SELECT public.reserve_internal_action('${permitted}','${user}',false)`).allowed,
    false,
  );
  sql(
    `UPDATE public.tenant_memberships SET status='active'; UPDATE public.autonomy_policies SET level='prohibited'`,
  );
  assert.equal(
    result(`SELECT public.reserve_internal_action('${permitted}','${user}',false)`).allowed,
    false,
  );
  sql(
    `UPDATE public.autonomy_policies SET level='standing_permission',constraints='${JSON.stringify({ ...constraints, maxDailyActions: 2 })}'::jsonb`,
  );
  const grantId = randomUUID(),
    clientId = randomUUID(),
    sessionId = randomUUID();
  const proof = { grantId, clientId, sessionId, resource: "https://workspace.example/mcp" };
  sql(
    `INSERT INTO public.workspace_mcp_delegations VALUES('${grantId}','${t}','${user}','${clientId}','${proof.resource}',NULL,now()+interval '1 day'); INSERT INTO auth.sessions VALUES('${sessionId}','${user}');`,
  );
  const serviceProof = () =>
    JSON.parse(
      sql(
        prefix("service_role", "") +
          `SELECT public.reserve_internal_action('${permitted}','${user}',false,'${JSON.stringify(proof)}'::jsonb)`,
      ),
    );
  assert.equal(
    serviceProof().allowed,
    true,
    "A verified active member OAuth grant may use bounded internal permission",
  );
  sql(`DELETE FROM auth.sessions WHERE id='${sessionId}'`);
  assert.equal(serviceProof().allowed, false, "Revoking the OAuth session blocks execution");
  assert.throws(
    () =>
      sql(`SET ROLE anon; SELECT public.admit_demo_agent('${"a".repeat(64)}','${randomUUID()}')`),
    /permission denied/,
  );
  const session = "b".repeat(64),
    request = randomUUID();
  const service = (q) => JSON.parse(sql(prefix("service_role", "") + q));
  assert.equal(service(`SELECT public.admit_demo_agent('${session}','${request}')`).allowed, true);
  assert.equal(
    service(`SELECT public.admit_demo_agent('${session}','${randomUUID()}')`).allowed,
    false,
  );
  const cost = [];
  for (let i = 0; i < 52; i++)
    cost.push(
      service(
        `SELECT public.reserve_demo_inference('${session}','${request}','${randomUUID()}',0.1)`,
      ),
    );
  assert.equal(cost.filter((r) => r.allowed).length, 50);
  assert.equal(sql("SELECT sum(reserved_usd) FROM private.demo_inference_receipts"), "5.0");
  sql(prefix("service_role", "") + `SELECT public.finish_demo_agent('${session}','${request}')`);
  for (let i = 0; i < 9; i++) {
    const r = randomUUID();
    assert.equal(service(`SELECT public.admit_demo_agent('${session}','${r}')`).allowed, true);
    sql(prefix("service_role", "") + `SELECT public.finish_demo_agent('${session}','${r}')`);
  }
  assert.equal(
    service(`SELECT public.admit_demo_agent('${session}','${randomUUID()}')`).allowed,
    false,
  );
  const scoped = JSON.stringify({ requesterId: user });
  as(
    `INSERT INTO public.work_items(tenant_id,kind,status,agent_plan) VALUES('${t}','agent_work','pending','${scoped}')`,
  );
  assert.throws(
    () =>
      as(
        `INSERT INTO public.work_items(tenant_id,kind,status,agent_plan) VALUES('${t}','agent_work','pending','{"requesterId":"${randomUUID()}"}')`,
      ),
    /row-level security/,
  );
  console.log(
    "Native Postgres: additive migration twice, exact human grant, scopes, fields, concurrent caps, replay, expiry, revocation, outbound refusal, requester RLS, public budget $5, session concurrency and 10-turn limit passed",
  );
} finally {
  if (started) run("pg_ctl", ["-D", join(root, "data"), "-m", "immediate", "-w", "stop"]);
  rmSync(root, { recursive: true, force: true });
}
