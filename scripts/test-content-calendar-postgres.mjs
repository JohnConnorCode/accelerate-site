import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";

const root = mkdtempSync(join(tmpdir(), "content-calendar-pg-"));
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const selected = server.address().port;
    server.close(() => resolve(selected));
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
const a = randomUUID(),
  b = randomUUID(),
  user = randomUUID(),
  otherUser = randomUUID();
const quote = (value) => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const columns = (tenant = a) =>
  JSON.parse(
    sql(
      `SELECT jsonb_agg(jsonb_build_object('key',column_key,'label',label,'revision',updated_at) ORDER BY column_key) FROM kanban_columns WHERE tenant_id='${tenant}'`,
    ),
  );
const items = (ids, tenant = a) =>
  JSON.parse(
    sql(
      `SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'status',status,'sortOrder',sort_order,'revision',updated_at) ORDER BY id),'[]') FROM content_calendar WHERE tenant_id='${tenant}' AND id IN(${ids.map((id) => "'" + id + "'").join(",")})`,
    ),
  );
const call = (
  command,
  {
    key = randomUUID(),
    expected = [],
    cols = columns(),
    tenant = a,
    actor = user,
    email = "admin@example.test",
    header = tenant,
  } = {},
) =>
  `SET ROLE service_role; SET app.tenant='${header}'; SELECT write_content_calendar_command('${tenant}','${actor}','${email}','${key}','${"a".repeat(64)}','${"b".repeat(64)}',${quote(command)},${quote(expected)},${quote(cols)});`;
const create = (id = randomUUID()) => ({
  operation: "create",
  id,
  values: {
    title: "A real calendar draft",
    status: "draft",
    notes: null,
    target_keywords: ["operations"],
  },
});
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
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA private;
    CREATE FUNCTION private.request_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.tenant',true),'')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
    CREATE TABLE tenants(id uuid PRIMARY KEY,status text,config jsonb DEFAULT '{}');
    CREATE TABLE tenant_memberships(tenant_id uuid,user_id uuid,role text,status text);
    CREATE TABLE audit_log(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,actor_email text,action text,entity_type text,entity_id text,source text,metadata jsonb);
    CREATE TABLE kanban_columns(tenant_id uuid,column_key text,label text,board_key text,updated_at timestamptz DEFAULT now());
    INSERT INTO tenants(id,status) VALUES('${a}','active'),('${b}','active');
    INSERT INTO auth.users VALUES('${user}','admin@example.test'),('${otherUser}','other@example.test');
    INSERT INTO tenant_memberships VALUES('${a}','${user}','admin','active'),('${b}','${otherUser}','admin','active');
    INSERT INTO kanban_columns(tenant_id,column_key,label,board_key) SELECT t,k,k,'content' FROM unnest(ARRAY['${a}'::uuid,'${b}'::uuid]) t CROSS JOIN unnest(ARRAY['idea','draft','review','published']) k;
    GRANT USAGE ON SCHEMA auth,private TO service_role,authenticated;
    GRANT SELECT ON auth.users TO service_role; GRANT SELECT,UPDATE ON tenants,tenant_memberships TO service_role;
    GRANT ALL ON kanban_columns,audit_log TO service_role;`);
  const base = readFileSync("supabase/migration-prompt2.sql", "utf8");
  sql(
    base.slice(
      base.indexOf("CREATE TABLE IF NOT EXISTS content_calendar"),
      base.indexOf("-- Create chat_leads table"),
    ),
  );
  sql(`ALTER TABLE content_calendar ADD tenant_id uuid NOT NULL, ADD sort_order numeric DEFAULT 1000;
    ALTER TABLE content_calendar ENABLE ROW LEVEL SECURITY;
    GRANT ALL ON content_calendar TO service_role;
    GRANT SELECT ON content_calendar TO authenticated;
    CREATE POLICY content_read ON content_calendar FOR SELECT TO authenticated USING(tenant_id=private.request_tenant_id());
    ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON audit_log TO authenticated;
    CREATE POLICY audit_read ON audit_log FOR SELECT TO authenticated USING(tenant_id=private.request_tenant_id());`);
  const migration = readFileSync("migrations/20261006200652_content_calendar_commands.sql", "utf8");
  sql(migration);
  sql(migration);
  const command = create(),
    key = randomUUID(),
    initialColumns = columns();
  const query = call(command, { key, cols: initialColumns });
  const exec = promisify(execFile);
  const concurrent = await Promise.all([
    exec("psql", [...args, "-c", query]),
    exec("psql", [...args, "-c", query]),
  ]);
  const results = concurrent.map((r) => JSON.parse(r.stdout.trim()));
  assert.equal(results.filter((r) => r.replayed).length, 1);
  assert.equal(sql("SELECT count(*) FROM content_calendar"), "1");
  assert.equal(sql("SELECT count(*) FROM audit_log"), "1");
  assert.equal(results[0].published, false);
  assert.throws(
    () =>
      sql(
        call(
          { ...command, values: { ...command.values, title: "Changed payload" } },
          { key, cols: initialColumns },
        ),
      ),
    /reused/,
  );
  const reorder = {
    operation: "reorder",
    updates: [{ id: command.id, column_key: "review", sort_order: 2200 }],
  };
  const before = items([command.id]),
    reorderKey = randomUUID();
  const reorderQuery = call(reorder, { key: reorderKey, expected: before });
  assert.equal(JSON.parse(sql(reorderQuery)).count, 1);
  assert.equal(
    sql(`SELECT status||':'||sort_order FROM content_calendar WHERE id='${command.id}'`),
    "review:2200",
  );
  assert.equal(JSON.parse(sql(reorderQuery)).replayed, true);
  assert.throws(() => sql(call(reorder, { expected: before })), /changed/);
  const foreign = create();
  sql(call(foreign, { tenant: b, actor: otherUser, email: "other@example.test" }));
  assert.throws(
    () => sql(call({ operation: "delete", id: foreign.id }, { expected: items([foreign.id], b) })),
    /changed/,
  );
  assert.equal(
    sql(
      `SET ROLE authenticated; SET app.tenant='${a}'; SELECT count(*) FROM content_calendar WHERE tenant_id='${b}'`,
    ),
    "0",
  );
  const fresh = items([command.id]);
  for (const invalid of [
    { operation: "delete", id: command.id, injected: true },
    { operation: "reorder", updates: [{ id: command.id, column_key: "missing", sort_order: 1 }] },
    { operation: "reorder", updates: [reorder.updates[0], reorder.updates[0]] },
  ])
    assert.throws(() => sql(call(invalid, { expected: fresh })), /Invalid/);
  assert.throws(() => sql(call(create(), { header: b })), /host required/);
  assert.throws(() => sql(call(create(), { email: "imposter@example.test" })), /administrator/);
  const staleColumns = columns();
  sql(
    `UPDATE kanban_columns SET label='Renamed',updated_at=clock_timestamp() WHERE tenant_id='${a}' AND column_key='review'`,
  );
  assert.throws(() => sql(call(create(), { cols: staleColumns })), /columns changed/);
  sql(`UPDATE tenants SET config='{"modules":{"content":false}}' WHERE id='${a}'`);
  assert.throws(() => sql(call(create())), /unavailable/);
  sql(`UPDATE tenants SET config='{}' WHERE id='${a}'`);
  sql(`UPDATE tenant_memberships SET status='revoked' WHERE user_id='${user}'`);
  assert.throws(() => sql(call(create())), /administrator/);
  sql(`UPDATE tenant_memberships SET status='active',role='member' WHERE user_id='${user}'`);
  assert.throws(() => sql(call(create())), /administrator/);
  sql(`UPDATE tenant_memberships SET role='admin' WHERE user_id='${user}'`);
  const blocked = create();
  sql(`CREATE FUNCTION fail_calendar_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled audit failure'; END $$;
    CREATE TRIGGER fail_calendar_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_calendar_audit();`);
  assert.throws(() => sql(call(blocked)), /audit failure/);
  assert.equal(sql(`SELECT count(*) FROM content_calendar WHERE id='${blocked.id}'`), "0");
  const partial = {
    operation: "reorder",
    updates: [
      { id: command.id, column_key: "draft", sort_order: 1 },
      { id: foreign.id, column_key: "draft", sort_order: 2 },
    ],
  };
  assert.throws(
    () => sql(call(partial, { expected: [...fresh, ...items([foreign.id], b)] })),
    /changed/,
  );
  assert.equal(sql(`SELECT status FROM content_calendar WHERE id='${command.id}'`), "review");
  sql("DROP TRIGGER fail_calendar_audit ON audit_log");
  const deletion = call({ operation: "delete", id: command.id }, { expected: items([command.id]) });
  assert.equal(JSON.parse(sql(deletion)).operation, "delete");
  assert.equal(JSON.parse(sql(deletion)).replayed, true);
  assert.equal(sql(`SELECT count(*) FROM content_calendar WHERE id='${command.id}'`), "0");
  assert.equal(sql(`SELECT count(*) FROM audit_log WHERE tenant_id='${a}'`), "3");
  const signature =
    "write_content_calendar_command(uuid,uuid,text,uuid,text,text,jsonb,jsonb,jsonb)";
  for (const role of ["anon", "authenticated"])
    assert.equal(sql(`SELECT has_function_privilege('${role}','${signature}','execute')`), "f");
  console.log(
    JSON.stringify({
      status: "passed",
      checks: [
        "real PostgreSQL create/delete/reorder",
        "atomic audit and rollback",
        "one concurrent receipt",
        "same-key replay",
        "changed-payload refusal",
        "stale item/columns",
        "two-tenant RLS",
        "revoked/non-admin actor",
        "disabled module",
        "foreign/invalid target and partial reorder refusal",
        "retained deletion receipts",
        "idempotent migration and restricted invoker function",
      ],
    }),
  );
} finally {
  if (started) run("pg_ctl", ["-D", join(root, "data"), "-m", "immediate", "-w", "stop"]);
  rmSync(root, { recursive: true, force: true });
}
