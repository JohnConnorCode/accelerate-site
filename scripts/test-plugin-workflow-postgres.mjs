import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
const root = mkdtempSync(join(tmpdir(), "plugin-pg-"));
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
  sql(`CREATE EXTENSION pgcrypto;
  CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA private;
  CREATE FUNCTION private.request_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT current_setting('app.tenant',true)::uuid $$;
  CREATE FUNCTION private.has_active_tenant_membership(id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT id=private.request_tenant_id() $$;
  GRANT USAGE ON SCHEMA private TO authenticated,service_role;
  CREATE TABLE tenants(id uuid PRIMARY KEY);
  CREATE TABLE tenant_memberships(tenant_id uuid REFERENCES tenants(id),user_id uuid,PRIMARY KEY(tenant_id,user_id));
  CREATE TABLE tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid REFERENCES tenants(id),dedupe_key text,source text,status text,due_date date);
  CREATE TABLE action_queue(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid REFERENCES tenants(id),dedupe_key text,source_context text,status text);
  INSERT INTO tenants VALUES('${a}'),('${b}');
  INSERT INTO tenant_memberships VALUES('${a}','${a}'),('${b}','${b}');
  INSERT INTO action_queue(id,tenant_id,dedupe_key,source_context,status) VALUES('${a}','${a}','draft','plugin','executed'),('${b}','${b}','draft','plugin','executed');`);
  const migration = readFileSync("migrations/20260904-plugin-workflow-foundations.sql", "utf8");
  sql(migration);
  sql(migration);
  assert.throws(
    () => sql(`INSERT INTO tasks(tenant_id,assigned_to) VALUES('${a}','${b}')`),
    /foreign key/,
  );
  sql(
    `INSERT INTO tasks(tenant_id,assigned_to,dedupe_key,source,status) VALUES('${a}','${a}','same-task','plugin','completed'),('${b}','${b}','same-task','plugin','pending')`,
  );
  assert.throws(
    () =>
      sql(
        `INSERT INTO tasks(tenant_id,assigned_to,dedupe_key,source,status) VALUES('${a}','${a}','same-task','plugin','pending')`,
      ),
    /duplicate key/,
  );
  assert.throws(
    () =>
      sql(
        `INSERT INTO action_queue(tenant_id,dedupe_key,source_context,status) VALUES('${a}','draft','plugin','pending')`,
      ),
    /duplicate key/,
  );
  const insertPage = (tenant, creation, publication) =>
    `INSERT INTO invoice_pages(tenant_id,creation_action_id,publication_action_id,brand,design,billing_digest,token_hash,encrypted_token,expires_at) VALUES('${tenant}','${creation}','${publication}','{}','{}','${"1".repeat(64)}','${"2".repeat(64)}','encrypted-fixture',now()+interval '1 day')`;
  assert.throws(() => sql(insertPage(a, b, a)), /foreign key/);
  sql(insertPage(a, a, a));
  sql(insertPage(b, b, b));
  assert.throws(() => sql(insertPage(a, a, a)), /duplicate key/);
  assert.equal(
    sql(`SET app.tenant='${a}'; SET ROLE authenticated; SELECT count(*) FROM invoice_pages;`),
    "1",
  );
  assert.equal(
    sql(
      `SET app.tenant='${b}'; SET ROLE authenticated; SELECT count(*) FROM invoice_pages WHERE tenant_id='${a}';`,
    ),
    "0",
  );
  assert.throws(
    () => sql(`SET app.tenant='${a}'; SET ROLE authenticated; ${insertPage(b, b, b)}`),
    /row-level security/,
  );
  assert.throws(
    () => sql(`UPDATE invoice_pages SET design='{"heading":"Changed"}' WHERE tenant_id='${a}'`),
    /immutable/,
  );
  sql(`UPDATE invoice_pages SET revoked_at=now() WHERE tenant_id='${a}'`);
  assert.throws(
    () => sql(`UPDATE invoice_pages SET revoked_at=NULL WHERE tenant_id='${a}'`),
    /immutable/,
  );
  console.log(
    "Plugin workflow PostgreSQL proof: migration applied twice; cross-tenant assignment and invoice references refused; task/action/publication replays refused across terminal states; tenant-scoped RLS proven. Disposable database only.",
  );
} finally {
  if (started) spawnSync("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"], { encoding: "utf8" });
  rmSync(root, { recursive: true, force: true });
}
