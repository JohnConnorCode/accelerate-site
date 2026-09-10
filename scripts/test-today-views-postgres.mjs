import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
const root = mkdtempSync(join(tmpdir(), "today-views-pg-"));
const data = join(root, "data");
const port = await new Promise((resolve, reject) => {
  const s = createServer();
  s.on("error", reject);
  s.listen(0, "127.0.0.1", () => {
    const p = s.address().port;
    s.close(() => resolve(p));
  });
});
function run(cmd, args, input) {
  const r = spawnSync(cmd, args, { encoding: "utf8", input });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout.trim();
}
const args = [
  "-X",
  "-q",
  "-t",
  "-A",
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
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  member = "33333333-3333-4333-8333-333333333333";
const doc = JSON.stringify({
  version: 1,
  enabled: true,
  views: [],
  defaultViewId: null,
  pins: [],
  muted: [],
});
const call = (owner, revision, key = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", document = doc) =>
  `SELECT public.save_today_views('${owner}',${revision},'${document}'::jsonb,'${key}');`;
const as = (tenant, user, text) =>
  sql(`SET ROLE authenticated; SET app.tenant='${tenant}'; SET app.actor_id='${user}'; ${text}`);
let started = false;
try {
  run("initdb", ["-D", data, "-A", "trust", "-U", "postgres"]);
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    join(root, "postgres.log"),
    "-o",
    `-h 127.0.0.1 -p ${port} -k ${root}`,
    "-w",
    "start",
  ]);
  started = true;
  sql(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
 CREATE SCHEMA private; CREATE SCHEMA auth;
 CREATE TABLE tenants(id uuid PRIMARY KEY,status text);
 CREATE TABLE tenant_memberships(tenant_id uuid,user_id uuid,role text,status text);
 CREATE TABLE audit_log(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,actor_email text,action text,entity_type text,entity_id text,source text,before_state jsonb,after_state jsonb,metadata jsonb);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.actor_id',true),'')::uuid $$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{"email":"fictional@example.test"}'::jsonb $$;
 CREATE FUNCTION private.request_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.tenant',true),'')::uuid $$;
 CREATE FUNCTION private.has_active_tenant_membership(tid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.tenant_memberships m JOIN public.tenants t ON t.id=m.tenant_id WHERE m.tenant_id=tid AND m.user_id=auth.uid() AND m.status='active' AND t.status='active') $$;
 GRANT USAGE ON SCHEMA private,auth TO authenticated,service_role;
 GRANT SELECT ON tenants,tenant_memberships TO authenticated;
 INSERT INTO tenants VALUES('${a}','active'),('${b}','active');
 INSERT INTO tenant_memberships VALUES('${a}','${a}','admin','active'),('${b}','${b}','admin','active'),('${a}','${member}','member','active');`);
  const migration = readFileSync("migrations/20260910-today-workspace.sql", "utf8");
  sql(migration);
  sql(migration);
  const first = JSON.parse(as(a, a, call(a, 0)));
  assert.equal(first.revision, 1);
  assert.deepEqual(JSON.parse(as(a, a, call(a, 0))), first);
  assert.equal(sql("SELECT count(*) FROM today_view_receipts"), "1");
  assert.equal(sql("SELECT count(*) FROM audit_log"), "1");
  assert.throws(
    () => as(a, a, call(a, 0, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")),
    /another session/,
  );
  assert.throws(
    () => as(a, a, call(a, 0, undefined, doc.replace('"enabled":true', '"enabled":false'))),
    /different content/,
  );
  assert.equal(as(b, b, "SELECT count(*) FROM today_workspace_views"), "0");
  assert.equal(as(a, member, "SELECT count(*) FROM today_workspace_views"), "0");
  assert.throws(() => as(a, member, call(a, 0)), /Cannot change/);
  assert.throws(() => as(a, member, call("workspace", 0)), /Cannot change/);
  assert.equal(
    JSON.parse(as(a, a, call("workspace", 0, "cccccccc-cccc-4ccc-8ccc-cccccccccccc"))).revision,
    1,
  );
  assert.equal(as(a, member, "SELECT count(*) FROM today_workspace_views"), "1");
  assert.throws(
    () => as(a, a, "UPDATE today_workspace_views SET revision=99"),
    /permission denied/,
  );
  assert.throws(() => as(a, a, "DELETE FROM today_view_receipts"), /permission denied/);
  assert.throws(
    () => as(a, a, call(a, 1, "dddddddd-dddd-4ddd-8ddd-dddddddddddd", '{"version":1,"views":[]}')),
    /Invalid Today document/,
  );
  const digest = "a".repeat(64);
  as(
    a,
    a,
    `INSERT INTO today_view_proposals(tenant_id,actor_id,digest,preview) VALUES('${a}','${a}','${digest}','{}')`,
  );
  assert.equal(as(a, member, "SELECT count(*) FROM today_view_proposals"), "0");
  assert.equal(as(b, b, "SELECT count(*) FROM today_view_proposals"), "0");
  assert.throws(
    () => as(a, a, "UPDATE today_view_proposals SET preview='{}'"),
    /permission denied/,
  );
  sql(`UPDATE tenant_memberships SET status='revoked' WHERE user_id='${a}'`);
  assert.throws(
    () => as(a, a, call(a, 1, "dddddddd-dddd-4ddd-8ddd-dddddddddddd")),
    /membership required/,
  );
  assert.equal(as(a, a, "SELECT count(*) FROM today_workspace_views"), "0");
  assert.throws(
    () =>
      sql("SET ROLE anon; SELECT public.save_today_views('workspace',0,'{}',gen_random_uuid())"),
    /permission denied/,
  );
  console.log(
    JSON.stringify({
      result: "passed",
      checks: [
        "idempotent migration",
        "private/shared visibility",
        "atomic revision conflict",
        "exact request replay",
        "audit receipt",
        "direct write refusal",
        "foreign member/tenant refusal",
        "revocation",
        "anonymous refusal",
      ],
    }),
  );
} finally {
  if (started) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  rmSync(root, { recursive: true, force: true });
}
