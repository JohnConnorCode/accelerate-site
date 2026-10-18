import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { createServer } from "node:net";

const root = mkdtempSync(join(tmpdir(), "accelerate-blueprint-version-"));
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const value = server.address().port;
    server.close(() => resolve(value));
  });
});
const bin = (name) => (process.env.POSTGRES_BIN ? join(process.env.POSTGRES_BIN, name) : name);
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
const run = (command, argv, input) => {
  const result = spawnSync(command, argv, { input, encoding: "utf8", timeout: 30000 });
  if (result.status !== 0)
    throw new Error(result.error?.message || result.stderr || result.stdout || `${command} failed`);
  return result.stdout.trim();
};
const sql = (input) => run(bin("psql"), args, input);
const asyncSql = (input) =>
  new Promise((resolve, reject) => {
    const child = spawn(bin("psql"), args, {
      env: { ...process.env, PGOPTIONS: "-c lock_timeout=10000 -c statement_timeout=20000" },
    });
    let out = "",
      error = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (error += chunk));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(error))));
    child.stdin.end(input);
  });
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const bp = "33333333-3333-4333-8333-333333333333",
  request = "44444444-4444-4444-8444-444444444444";
const document = JSON.stringify({
  schemaVersion: "workspace-blueprint.v1",
  businessSummary: "A fictional team reviews its draft.",
});
const prefix = (tenant = a, role = "service_role") =>
  `SET request.headers='{"x-tenant-id":"${tenant}"}'; SET request.jwt.claim.role='${role}'; SET ROLE ${role}; `;
const call = ({ id = bp, expected = 1, key = request, doc = document, tenant = a } = {}) =>
  `SELECT public.save_workspace_blueprint_version('${tenant}',${id ? `'${id}'` : "NULL"},'${doc}'::jsonb,'Reviewed draft','owner@example.test',${expected},${key ? `'${key}'` : "NULL"},'Test Blueprint',NULL);`;
const denied = (input, pattern) => assert.throws(() => sql(input), pattern);
let started = false;
try {
  run(bin("initdb"), ["-A", "trust", "-U", "postgres", "-D", join(root, "data")]);
  run(bin("pg_ctl"), [
    "-D",
    join(root, "data"),
    "-l",
    join(root, "postgres.log"),
    "-o",
    `-F -h 127.0.0.1 -k '' -p ${port}`,
    "-w",
    "start",
  ]);
  started = true;
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA private; CREATE SCHEMA auth;
    CREATE TABLE tenants(id uuid PRIMARY KEY,status text);
    INSERT INTO tenants VALUES('${a}','active'),('${b}','active');
    CREATE TABLE audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,
      actor_email text,action text,entity_type text,entity_id text,source text,after_state jsonb);
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
    CREATE FUNCTION private.request_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (current_setting('request.headers',true)::jsonb->>'x-tenant-id')::uuid $$;
    CREATE FUNCTION private.has_active_tenant_membership(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    GRANT USAGE ON SCHEMA auth,private TO service_role;`);
  const context = readFileSync("migrations/20260830-tenant-context-authorization.sql", "utf8");
  sql(
    context.slice(
      context.indexOf("CREATE OR REPLACE FUNCTION private.authorized_request_tenant_id()"),
      context.indexOf("DROP FUNCTION IF EXISTS public.claim_revenue_job_run"),
    ),
  );
  sql(readFileSync("migrations/20260923-workspace-blueprints.sql", "utf8"));
  const migration = readFileSync(
    "migrations/20261018151805_blueprint_draft_version_atomic.sql",
    "utf8",
  );
  sql(migration);
  sql(migration);
  sql(`GRANT SELECT ON tenants TO service_role; GRANT ALL ON audit_log TO service_role;
    INSERT INTO workspace_blueprints(tenant_id,id,status,latest_version) VALUES('${a}','${bp}','approved',1);
    INSERT INTO workspace_blueprint_versions(tenant_id,blueprint_id,version,document,change_summary) VALUES('${a}','${bp}',1,'${document}','Original');`);
  denied(prefix(a, "authenticated") + call(), /permission denied/);
  denied(prefix(b) + call(), /forbidden/);
  denied(prefix() + call({ tenant: b }), /forbidden/);
  const saved = JSON.parse(sql(prefix() + call()));
  assert.equal(saved.version.version, 2);
  assert.equal(saved.version.parent_version, 1);
  assert.equal(
    sql(`SELECT status||':'||latest_version FROM workspace_blueprints WHERE id='${bp}'`),
    "draft:2",
  );
  assert.equal(sql("SELECT count(*) FROM audit_log"), "1");
  assert.deepEqual(
    JSON.parse(sql(prefix() + call())),
    saved,
    "A lost response must reuse the same version",
  );
  assert.equal(sql("SELECT count(*) FROM audit_log"), "1");
  denied(prefix() + call({ key: "55555555-5555-4555-8555-555555555555" }), /version conflict/);
  denied(prefix() + call({ doc: document.replace("fictional", "different") }), /identity conflict/);
  const counts = sql(
    "SELECT (SELECT count(*) FROM workspace_blueprints)||':'||(SELECT count(*) FROM workspace_blueprint_versions)",
  );
  sql(
    "CREATE FUNCTION reject_blueprint_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled audit failure'; END $$; CREATE TRIGGER reject_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_blueprint_audit();",
  );
  denied(prefix() + call({ id: null, expected: 0, key: null }), /controlled audit failure/);
  assert.equal(
    sql(
      "SELECT (SELECT count(*) FROM workspace_blueprints)||':'||(SELECT count(*) FROM workspace_blueprint_versions)",
    ),
    counts,
    "Audit failure must roll back header and version",
  );
  sql("DROP TRIGGER reject_audit ON audit_log");
  const concurrent = await Promise.allSettled([
    asyncSql(prefix() + call({ expected: 2, key: "66666666-6666-4666-8666-666666666666" })),
    asyncSql(prefix() + call({ expected: 2, key: "77777777-7777-4777-8777-777777777777" })),
  ]);
  assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(sql(`SELECT latest_version FROM workspace_blueprints WHERE id='${bp}'`), "3");
  assert.deepEqual(
    JSON.parse(sql(prefix() + call())),
    saved,
    "Replay must still recover the original version after later edits",
  );
  sql(`UPDATE tenants SET status='suspended' WHERE id='${a}'`);
  denied(prefix() + call({ expected: 3, key: null }), /forbidden/);
  console.log(
    "PASS: Blueprint atomic append, approval reset, replay, concurrent conflict, tenant/role denial, suspension and audit rollback",
  );
} finally {
  if (started) run(bin("pg_ctl"), ["-D", join(root, "data"), "-m", "fast", "-w", "stop"]);
  rmSync(root, { recursive: true, force: true });
}
