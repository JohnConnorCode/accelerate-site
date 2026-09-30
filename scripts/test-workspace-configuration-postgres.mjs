import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";
const root = mkdtempSync(join(tmpdir(), "workspace-configuration-pg-"));
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
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  member = "33333333-3333-4333-8333-333333333333";
const prefix = (tenant = a, user = a) =>
  `SET ROLE authenticated; SET app.tenant='${tenant}'; SET app.actor_id='${user}'; `;
const as = (query, tenant = a, user = a) => sql(prefix(tenant, user) + query);
const expected = () =>
  JSON.parse(
    sql(
      `SELECT jsonb_build_object('id',id,'status',status,'accountEmail',account_email,'scopes',scopes,'credentialVersion',credential_version,'updatedAt',updated_at,'settings',settings) FROM integration_connections WHERE tenant_id='${a}' AND provider='google';`,
    ),
  );
const call = (change, snapshot, actor = "admin@example.test") =>
  `SELECT save_workspace_configuration('${JSON.stringify(change).replaceAll("'", "''")}'::jsonb,'${JSON.stringify(snapshot).replaceAll("'", "''")}'::jsonb,'${actor}');`;
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
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA private; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.actor_id',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{"email":"admin@example.test"}'::jsonb $$;
CREATE FUNCTION private.request_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.tenant',true),'')::uuid $$;
CREATE TABLE tenants(id uuid PRIMARY KEY,status text);
CREATE TABLE tenant_memberships(tenant_id uuid,user_id uuid,role text,status text);
CREATE FUNCTION private.has_active_tenant_membership(t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.tenant_memberships m JOIN public.tenants t2 ON t2.id=m.tenant_id WHERE m.tenant_id=t AND m.user_id=auth.uid() AND m.status='active' AND t2.status='active') $$;
CREATE TABLE integration_connections(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,provider text,status text,account_email text,scopes text[],credential_version int,updated_at timestamptz,settings jsonb,encrypted_credentials jsonb,encrypted_access_token text,encrypted_refresh_token text,token_expires_at timestamptz,environment_fallback_allowed boolean,last_error text,UNIQUE(tenant_id,provider));
CREATE TABLE admin_settings(tenant_id uuid,key text,value text,is_secret boolean DEFAULT false,updated_at timestamptz,PRIMARY KEY(tenant_id,key));
CREATE TABLE audit_log(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,actor_email text,action text,entity_type text,entity_id text,source text,before_state jsonb,after_state jsonb,metadata jsonb);
GRANT USAGE ON SCHEMA auth,private TO authenticated; GRANT SELECT ON tenants,tenant_memberships TO authenticated;
GRANT SELECT,INSERT,UPDATE ON integration_connections,admin_settings TO authenticated; GRANT SELECT,INSERT ON audit_log TO authenticated;
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY; ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY; ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY scoped_connections ON integration_connections TO authenticated USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id)) WITH CHECK(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
CREATE POLICY scoped_settings ON admin_settings TO authenticated USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id)) WITH CHECK(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
CREATE POLICY scoped_audit ON audit_log TO authenticated USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id)) WITH CHECK(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
INSERT INTO tenants VALUES('${a}','active'),('${b}','active'); INSERT INTO tenant_memberships VALUES('${a}','${a}','admin','active'),('${b}','${b}','admin','active'),('${a}','${member}','member','active');
INSERT INTO integration_connections(tenant_id,provider,status,account_email,scopes,credential_version,updated_at,settings,encrypted_credentials,encrypted_access_token,encrypted_refresh_token,token_expires_at,environment_fallback_allowed) SELECT t,'google','connected','admin@example.test',ARRAY['openid','email'],1,now(),'{"drive_folder_ids":["original_folder"],"retained":"keep"}','{"api_key":"encrypted"}','encrypted-access','encrypted-refresh',now()+interval '1 hour',true FROM unnest(ARRAY['${a}'::uuid,'${b}'::uuid]) t;`);
  const migration = readFileSync(
    "migrations/20260930004129_workspace_configuration_commands.sql",
    "utf8",
  );
  sql(migration);
  sql(migration);
  const change = { operation: "set_drive_folders", folderIds: ["reviewed_folder"] };
  const initial = expected();
  const result = JSON.parse(as(call(change, initial)));
  assert.equal(result.status, "success");
  assert.equal(sql("SELECT count(*) FROM audit_log"), "1");
  assert.equal(
    sql(`SELECT settings->>'retained' FROM integration_connections WHERE tenant_id='${a}'`),
    "keep",
  );
  assert.equal(
    sql(`SELECT settings->'drive_folder_ids' FROM integration_connections WHERE tenant_id='${b}'`),
    '["original_folder"]',
  );
  assert.throws(() => as(call(change, initial)), /changed/);
  assert.equal(
    JSON.parse(
      as(call({ operation: "set_drive_folders", folderIds: ["a".repeat(256)] }, expected())),
    ).status,
    "success",
  );
  assert.throws(
    () => as(call({ operation: "set_drive_folders", folderIds: ["a".repeat(257)] }, expected())),
    /Invalid/,
  );
  for (const invalid of [
    { operation: "disconnect_provider", provider: "unknown" },
    { operation: "set_drive_folders", folderIds: ["bad'"] },
    { operation: "set_drive_folders", folderIds: ["duplicate_folder", "duplicate_folder"] },
    { operation: "set_workspace_setting", key: "ADMIN_EMAIL", value: "attacker@example.test" },
    { operation: "set_workspace_setting", key: "OPENROUTER_API_KEY", value: "bad" },
    { operation: "set_workspace_setting", key: "NOTIFY_NEW_LEADS", value: "yes" },
  ])
    assert.throws(() => as(call(invalid, expected())), /Invalid/);
  assert.throws(
    () => as(call({ operation: "disconnect_provider", provider: "google" }, expected()), a, member),
    /administrator/,
  );
  assert.throws(
    () => as(call({ operation: "disconnect_provider", provider: "google" }, expected()), b, b),
    /changed/,
  );
  assert.throws(() => as(call(change, expected(), "imposter@example.test")), /administrator/);
  const preference = {
    operation: "set_workspace_setting",
    key: "NOTIFY_NEW_LEADS",
    value: "false",
  };
  assert.equal(JSON.parse(as(call(preference, null))).status, "success");
  assert.equal(sql(`SELECT value FROM admin_settings WHERE tenant_id='${a}'`), "false");
  assert.throws(() => as(call(preference, null)), /changed/);
  sql(
    `CREATE FUNCTION fail_configuration_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled audit failure'; END $$; CREATE TRIGGER fail_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_configuration_audit();`,
  );
  const beforeFailure = expected();
  assert.throws(
    () =>
      as(call({ operation: "set_drive_folders", folderIds: ["rollback_folder"] }, beforeFailure)),
    /audit failure/,
  );
  assert.deepEqual(expected(), beforeFailure);
  sql("DROP TRIGGER fail_audit ON audit_log;");
  const concurrent =
    prefix() +
    call({ operation: "set_drive_folders", folderIds: ["concurrent_folder"] }, expected());
  const exec = promisify(execFile);
  const races = await Promise.allSettled([
    exec("psql", [...args, "-c", concurrent]),
    exec("psql", [...args, "-c", concurrent]),
  ]);
  assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
  assert.match(races.find((r) => r.status === "rejected").reason.stderr, /changed|No Drive/);
  const disconnect = JSON.parse(
    as(call({ operation: "disconnect_provider", provider: "google" }, expected())),
  );
  assert.equal(disconnect.after.credentialVersion, 2);
  assert.equal(
    sql(
      `SELECT status||':'||coalesce(encrypted_refresh_token,'cleared')||':'||environment_fallback_allowed::text FROM integration_connections WHERE tenant_id='${a}'`,
    ),
    "revoked:cleared:false",
  );
  assert.equal(as("SELECT count(*) FROM audit_log", b, b), "0");
  assert.equal(
    sql(
      "SELECT has_function_privilege('anon','save_workspace_configuration(jsonb,jsonb,text)','execute')",
    ),
    "f",
  );
  assert.equal(
    sql(
      "SELECT has_function_privilege('service_role','save_workspace_configuration(jsonb,jsonb,text)','execute')",
    ),
    "f",
  );
  sql(`UPDATE tenant_memberships SET status='revoked' WHERE user_id='${a}'`);
  assert.throws(
    () =>
      as(
        call({ operation: "set_workspace_setting", key: "BUSINESS_NAME", value: "changed" }, null),
      ),
    /administrator/,
  );
  console.log(
    "PASS: real PostgreSQL configuration writes, RLS/admin boundary, exact stale/CAS refusal, simultaneous saves, audit rollback, secret removal, tenant isolation, invalid inputs and idempotent migration.",
  );
} finally {
  if (started) run("pg_ctl", ["-D", join(root, "data"), "-m", "immediate", "-w", "stop"]);
  rmSync(root, { recursive: true, force: true });
}
