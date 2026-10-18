import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";

const root = mkdtempSync(join(tmpdir(), "opportunity-create-pg-"));
const port = await new Promise((resolve, reject) => {
  const server = createServer(); server.on("error", reject);
  server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolve(port)); });
});
const run = (cmd, args, input) => {
  const result = spawnSync(cmd, args, { input, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
};
const args = ["-X", "-qAt", "-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
const sql = text => run("psql", args, text);
const quote = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const a = randomUUID(), b = randomUUID(), actor = randomUUID(), other = randomUUID();
const contact = randomUUID(), company = randomUUID(), foreignContact = randomUUID(), foreignCompany = randomUUID();
const input = { name: "Fictional Customer", email: "customer@example.test", phone: null, companyName: "Fictional Company", website: null, industry: null, opportunityName: "Reviewed implementation", estimatedValue: 500, nextAction: "Confirm scope", nextActionAt: null, source: "manual" };
const call = (key, values = input, { tenant = a, header = tenant, user = actor, email = "admin@example.test", person = contact, business = company } = {}) =>
  `SET ROLE service_role; SET app.tenant='${header}'; SELECT create_opportunity_with_receipt('${tenant}','${user}','${email}','${key}',${quote(values)},'${person}','${business}');`;
const count = table => Number(sql(`SELECT count(*) FROM ${table}`));
let started = false;
try {
  run("initdb", ["-D", join(root,"data"), "-A", "trust", "-U", "postgres"]);
  run("pg_ctl", ["-D", join(root,"data"), "-l", join(root,"postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${root}`, "-w", "start"]); started = true;
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA private; CREATE SCHEMA auth;
    CREATE FUNCTION private.request_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.tenant',true),'')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
    CREATE TABLE tenants(id uuid PRIMARY KEY,status text);
    CREATE TABLE tenant_memberships(tenant_id uuid,user_id uuid,role text,status text);
    CREATE TABLE campaigns(id uuid PRIMARY KEY); CREATE TABLE conversations(id uuid PRIMARY KEY);
    INSERT INTO tenants VALUES('${a}','active'),('${b}','active');
    INSERT INTO auth.users VALUES('${actor}','admin@example.test'),('${other}','other@example.test');
    INSERT INTO tenant_memberships VALUES('${a}','${actor}','admin','active'),('${b}','${other}','admin','active');`);
  const base = readFileSync("migrations/20260816-revenue-os.sql", "utf8");
  sql(base.slice(base.indexOf("CREATE TABLE IF NOT EXISTS contacts"), base.indexOf("CREATE TABLE IF NOT EXISTS conversations")));
  sql(base.slice(base.indexOf("CREATE TABLE IF NOT EXISTS activities"), base.indexOf("CREATE TABLE IF NOT EXISTS action_queue")));
  sql(base.slice(base.indexOf("CREATE TABLE IF NOT EXISTS audit_log"), base.indexOf("ALTER TABLE tasks ADD COLUMN")));
  for (const table of ["companies", "contacts", "opportunities", "stage_events", "activities", "audit_log"]) {
    sql(`ALTER TABLE ${table} ADD tenant_id uuid NOT NULL REFERENCES tenants(id); ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
      GRANT SELECT ON ${table} TO authenticated;
      CREATE POLICY fixture_tenant_read ON ${table} FOR SELECT TO authenticated USING(tenant_id=private.request_tenant_id());`);
  }
  sql(`GRANT USAGE ON SCHEMA auth,private TO service_role,authenticated;
    GRANT SELECT ON auth.users TO service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    INSERT INTO companies(id,tenant_id,name,domain) VALUES('${company}','${a}','Fictional Company','example.test'),('${foreignCompany}','${b}','Other Company','other.test');
    INSERT INTO contacts(id,tenant_id,full_name,primary_email,company_id) VALUES('${contact}','${a}','Fictional Customer','customer@example.test','${company}'),('${foreignContact}','${b}','Other Customer','other@example.test','${foreignCompany}');`);
  const migration = readFileSync("migrations/20261018203409_manual_opportunity_create_receipt.sql", "utf8");
  sql(migration); sql(migration);
  const key = randomUUID(), query = call(key);
  const exec = promisify(execFile);
  const concurrent = await Promise.all([exec("psql", [...args, "-c", query]), exec("psql", [...args, "-c", query])]);
  const results = concurrent.map(r => JSON.parse(r.stdout));
  assert.deepEqual(results[0], results[1]);
  for (const table of ["opportunities", "stage_events", "activities", "audit_log"]) assert.equal(count(table), 1, table);
  // The first committed response is deliberately discarded; the same request
  // recovers that immutable result, including after a later business edit.
  sql(`UPDATE opportunities SET name='Subsequent edit',stage='qualified' WHERE id='${results[0].id}'`);
  assert.deepEqual(JSON.parse(sql(query)), results[0]);
  assert.equal(sql(`SELECT name FROM opportunities WHERE id='${results[0].id}'`), "Subsequent edit");
  assert.throws(() => sql(call(key, {...input, estimatedValue: 999})), /reused for changed input/);
  const second = JSON.parse(sql(call(randomUUID())));
  assert.notEqual(second.id, results[0].id); assert.equal(count("opportunities"), 2);
  const before = Object.fromEntries(["opportunities", "stage_events", "activities", "audit_log"].map(t => [t,count(t)]));
  const retryKey = randomUUID();
  for (const table of ["audit_log", "stage_events", "activities"]) {
    sql(`CREATE OR REPLACE FUNCTION fail_creation_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled evidence failure'; END $$;
      CREATE TRIGGER fail_creation BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION fail_creation_evidence();`);
    assert.throws(() => sql(call(retryKey)), /controlled evidence failure/);
    for (const [t,total] of Object.entries(before)) assert.equal(count(t),total,`${table} failure rolls back ${t}`);
    sql(`DROP TRIGGER fail_creation ON ${table}`);
  }
  const recovered = JSON.parse(sql(call(retryKey)));
  assert.deepEqual(JSON.parse(sql(call(retryKey))), recovered);
  for (const [t,total] of Object.entries(before)) assert.equal(count(t),total+1,t);
  assert.throws(() => sql(call(randomUUID(),input,{header:b})), /host required/);
  assert.throws(() => sql(call(randomUUID(),input,{person:foreignContact,business:foreignCompany})), /customer unavailable/);
  assert.throws(() => sql(call(randomUUID(),input,{email:"imposter@example.test"})), /administrator required/);
  for (const values of [{...input, estimatedValue:-1}, {...input, extra:"injection"}, {...input, email:"bad"}, {...input,nextActionAt:"invalid-date"}]) assert.throws(() => sql(call(randomUUID(),values)));
  const foreign = JSON.parse(sql(call(key,{...input,email:"other@example.test"},{tenant:b,user:other,email:"other@example.test",person:foreignContact,business:foreignCompany})));
  assert.notEqual(foreign.id,results[0].id,"same request key is independently scoped per tenant");
  assert.equal(sql(`SET ROLE authenticated; SET app.tenant='${a}'; SELECT count(*) FROM opportunities WHERE tenant_id='${b}'`),"0");
  sql(`UPDATE tenant_memberships SET status='revoked' WHERE user_id='${actor}'`);
  assert.throws(() => sql(query), /administrator required/, "replay rechecks membership");
  sql(`UPDATE tenant_memberships SET status='active',role='member' WHERE user_id='${actor}'`);
  assert.throws(() => sql(query), /administrator required/);
  sql(`UPDATE tenant_memberships SET role='admin' WHERE user_id='${actor}'; UPDATE tenants SET status='suspended' WHERE id='${a}'`);
  assert.throws(() => sql(query), /Workspace unavailable/);
  for (const role of ["anon","authenticated"]) assert.equal(sql(`SELECT has_function_privilege('${role}','create_opportunity_with_receipt(uuid,uuid,text,text,jsonb,uuid,uuid)','execute')`),"f");
  console.log("PASS: native PostgreSQL atomic create/history/activity/audit; failure rollback and retry; concurrent and lost-response replay; changed payload; separate intent; tenant isolation; current actor/lifecycle and restricted invoker privileges; migration replay. Auth delivery/PostgREST/browser are outside this fixture.");
} finally {
  if (started) run("pg_ctl", ["-D", join(root,"data"), "-m", "fast", "-w", "stop"]);
  rmSync(root, {recursive:true,force:true});
}
