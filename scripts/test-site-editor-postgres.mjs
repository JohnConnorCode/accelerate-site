import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
const root = mkdtempSync(join(tmpdir(), "site-editor-pg-"));
const data = join(root, "data");
const port = await new Promise((resolve, reject) => {
  const s = createServer();
  s.on("error", reject);
  s.listen(0, "127.0.0.1", () => {
    const p = s.address().port;
    s.close(() => resolve(p));
  });
});
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
function run(cmd, argv, input) {
  const r = spawnSync(cmd, argv, { encoding: "utf8", input });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout.trim();
}
const sql = (input) => run("psql", args, input);
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
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

  const owner = "acce1e8e-0000-4000-8000-000000000001";
  const user = a, session = b, client = "33333333-3333-4333-8333-333333333333";
  const resource = "https://example.test/api/mcp/site-studio";
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE supabase_auth_admin;
    CREATE SCHEMA private; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
    CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid);
    INSERT INTO auth.users VALUES('${user}','owner@example.test');
    INSERT INTO auth.sessions VALUES('${session}','${user}');
    CREATE FUNCTION private.authorized_request_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.tenant',true),'')::uuid $$;
    CREATE FUNCTION private.request_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT private.authorized_request_tenant_id() $$;
    CREATE FUNCTION private.has_active_tenant_membership(t uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT t=private.authorized_request_tenant_id() $$;
    CREATE FUNCTION private.radar_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable'; END $$;
    CREATE TABLE tenants(id uuid PRIMARY KEY,status text,config jsonb);
    CREATE TABLE tenant_memberships(tenant_id uuid,user_id uuid,role text,status text);
    CREATE TABLE audit_log(tenant_id uuid,actor_email text,action text,entity_type text,entity_id text,source text,metadata jsonb);
    CREATE TABLE action_queue(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,action_type text,payload jsonb,status text DEFAULT 'pending',expires_at timestamptz DEFAULT now()+interval '1 hour',result jsonb,executed_at timestamptz,updated_at timestamptz,approved_by text,approved_at timestamptz);
    CREATE FUNCTION check_autonomy(text,text) RETURNS TABLE(hard_floor boolean,level text) LANGUAGE sql AS $$ SELECT false,'supervised'::text $$;
    INSERT INTO tenants VALUES('${owner}','active','{}'),('${b}','active','{}');
    INSERT INTO tenant_memberships VALUES('${owner}','${user}','admin','active');
    GRANT USAGE ON SCHEMA private TO service_role;`);
  for (const file of [
    "20260909012125-installation-website-revisions.sql", "20260917-site-studio-drafts.sql",
    "20260919203846_site_studio_defaults.sql", "20260919210534_site_editor_delegation.sql",
  ]) sql(readFileSync(`migrations/${file}`, "utf8"));
  const json = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
  const context = `SET app.tenant='${owner}'; SET ROLE service_role;`;
  const grantCommand = `${context} SELECT manage_site_editor_delegation('grant','${user}','${client}','${resource}','owner@example.test',NULL);`;
  const grant = JSON.parse(sql(grantCommand));
  const command = {operation:"save",requestKey:a,expectedVersion:0,document:{schemaVersion:1,pages:[{title:"Private"}]}};
  const digest = "a".repeat(64), summary = "Save a private website draft.";
  sql(`INSERT INTO action_queue(id,tenant_id,action_type,payload) VALUES('${a}','${owner}','site_website_change',${json({tenantId:owner,command,digest,summary})})`);
  const execute = (changes = {}) => {
    const input = {grantId:grant.id,userId:user,clientId:client,sessionId:session,actionId:a,digest,summary,command,...changes};
    return `${context} SELECT execute_delegated_site_change('${input.grantId}','${input.userId}','${input.clientId}','${input.sessionId}','${input.actionId}','${input.digest}','${input.summary}','owner@example.test',${json(input.command)});`;
  };
  const runAsync = input => new Promise((resolve,reject) => {
    const child=spawn("psql",args); let out="",err="";
    child.stdout.on("data",chunk=>out+=chunk); child.stderr.on("data",chunk=>err+=chunk);
    child.on("error",reject); child.on("close",code=>code===0?resolve(out.trim()):reject(new Error(err)));
    child.stdin.end(input);
  });
  for (const changes of [{userId:b},{clientId:b},{sessionId:a},{digest:"b".repeat(64)},{summary:"Publish everything."}])
    assert.throws(()=>sql(execute(changes)),/revoked|required|proposal/i);
  const raced=(await Promise.all([runAsync(execute()),runAsync(execute())])).map(JSON.parse);
  assert.deepEqual(raced[0],raced[1]);
  assert.equal(raced[0].authorization.mode,"delegated");
  assert.equal(raced[0].receipt.version,1);
  assert.equal(sql("SELECT count(*) FROM site_website_revisions"),"1");
  assert.equal(sql("SELECT count(*) FROM site_website_receipts"),"1");
  assert.equal(sql("SELECT count(*) FROM action_queue WHERE approved_by IS NOT NULL OR approved_at IS NOT NULL"),"0");
  assert.equal(sql("SELECT count(*) FROM audit_log WHERE action='site_editor.delegated_execution'"),"1");
  for(const role of ["anon","authenticated","mcp_site_editor"]) {
    assert.throws(()=>sql(execute().replace("SET ROLE service_role",`SET ROLE ${role}`)),/permission denied/);
    assert.throws(()=>sql(`SET ROLE ${role}; SELECT * FROM site_editor_delegations`),/permission denied/);
    assert.throws(()=>sql(`SET ROLE ${role}; SELECT * FROM site_websites`),/permission denied/);
  }
  sql(`UPDATE tenants SET config='{"modules":{"site-studio":false}}' WHERE id='${owner}'`);
  assert.throws(()=>sql(execute()),/disabled/);
  sql(`UPDATE tenants SET config='{}',status='suspended' WHERE id='${owner}'`);
  assert.throws(()=>sql(execute()),/suspended/);
  sql(`UPDATE tenants SET status='active' WHERE id='${owner}'; UPDATE tenant_memberships SET status='revoked'`);
  assert.throws(()=>sql(execute()),/membership revoked/);
  sql("UPDATE tenant_memberships SET status='active'");
  sql("DELETE FROM auth.sessions");
  assert.throws(()=>sql(execute()),/session revoked/);
  sql(`INSERT INTO auth.sessions VALUES('${session}','${user}')`);
  sql(`UPDATE site_editor_delegations SET expires_at=now()-interval '1 minute'`);
  assert.throws(()=>sql(execute()),/expired or revoked/);
  sql(`UPDATE site_editor_delegations SET expires_at=now()+interval '1 day'`);
  sql(`${context} SELECT manage_site_editor_delegation('revoke','${user}',NULL,'${resource}','owner@example.test','${grant.id}')`);
  assert.throws(()=>sql(execute()),/expired or revoked/);
  const hook=JSON.parse(sql(`SET ROLE supabase_auth_admin; SELECT site_editor_access_token_hook(${json({client_id:client,claims:{sub:user,aud:"authenticated",role:"authenticated"}})})`));
  assert.equal(hook.claims.aud,resource);
  assert.equal(hook.claims.role,"mcp_site_editor","revoking never upgrades OAuth tokens to ordinary Data API access");
  console.log("PASS: native PostgreSQL delegated command serialization, exact proposal binding, truthful receipts, no fabricated human approval, token-role isolation, disabled/suspended tenant and revoked membership/session/grant refusal.");
} finally {
  if(started) run("pg_ctl",["-D",data,"-m","immediate","-w","stop"]);
  rmSync(root,{recursive:true,force:true});
}
