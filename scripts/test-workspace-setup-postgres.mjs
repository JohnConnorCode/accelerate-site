/** Native database integration, with simulated Auth and Storage interfaces.
 * Does not prove hosted Auth, browser login, scheduler extensions or a human trial. */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { setupConfiguration, runWorkspaceSetup } from "./lib/workspace-setup.mjs";
import { migrationCatalog, migrationProgram } from "./lib/migration-ledger.mjs";
import { bootstrapOwnerMembershipSql } from "./lib/bootstrap-owner-membership.mjs";
const root = mkdtempSync(join(tmpdir(), "accelerate-cold-install-"));
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    server.close(() => resolve(port));
  });
});
function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout.trim();
}
const sql = (input) =>
  run(
    "psql",
    [
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
    ],
    input,
  );
const json = (query) => JSON.parse(sql(query));
const ownerId = "11111111-1111-4111-8111-111111111111";
const config = setupConfiguration({
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_nativefixture",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_nativefixture",
  SUPABASE_PROJECT_REF: "local",
  SUPABASE_DB_HOST: "127.0.0.1",
  ADMIN_EMAIL: "owner@cold-start.test",
  BOOTSTRAP_BRAND_NAME: "Cold Start",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
});
assert.equal(config.ready, true);
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
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE supabase_auth_admin;
CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;`);
  Object.assign(process.env, config.bootstrap);
  const omitted = "migrations/20260823-command-center-scheduler.sql";
  const catalog = migrationCatalog(process.cwd()).filter((m) => m.file !== omitted);
  const workspace = () =>
    json(
      "SELECT row_to_json(t) FROM (SELECT id,status,config FROM tenants WHERE id=accelerate_default_tenant_id()) t;",
    );
  const host = {
    inspectDatabase: async () => ({ pending: catalog.length, untrackedExisting: false }),
    findOwner: async () =>
      json(
        `SELECT coalesce((SELECT row_to_json(t) FROM (SELECT id,email,'2026-09-21T00:00:00Z' AS email_confirmed_at FROM auth.users WHERE id='${ownerId}') t),'null'::json);`,
      ),
    createOwner: async () => {
      sql(`INSERT INTO auth.users VALUES('${ownerId}','${config.ownerEmail}');`);
      return { id: ownerId, email: config.ownerEmail, email_confirmed_at: "2026-09-21T00:00:00Z" };
    },
    assertDatabaseOwner: async () =>
      assert.equal(
        sql(
          `SELECT count(*) FROM auth.users WHERE id='${ownerId}' AND email='${config.ownerEmail}';`,
        ),
        "1",
      ),
    migrate: async () => sql(migrationProgram(catalog)),
    readWorkspace: async () => workspace(),
    readMembership: async (tenant) =>
      json(
        `SELECT row_to_json(t) FROM (SELECT tenant_id,user_id,role,status,invited_email FROM tenant_memberships WHERE tenant_id='${tenant}' AND user_id='${ownerId}') t;`,
      ) || null,
    activateMembership: async (tenant) =>
      sql(bootstrapOwnerMembershipSql(tenant, ownerId, config.ownerEmail)),
  };
  const result = await runWorkspaceSetup(config, host, {
    apply: true,
    project: "local",
    password: "native-fixture-password",
  });
  assert.equal(result.status, "workspace_configured");
  const tenant = workspace().id;
  assert.equal(workspace().config.brand.name, "Cold Start");
  assert.equal(
    sql(
      `SELECT count(*) FROM tenant_memberships WHERE tenant_id='${tenant}' AND user_id='${ownerId}' AND role='admin' AND status='active';`,
    ),
    "1",
  );
  const contact = sql(
    `INSERT INTO contacts(tenant_id,full_name,primary_email) VALUES('${tenant}','Fictional first contact','fictional@cold-start.test') RETURNING id;`,
  );
  const task = sql(
    `INSERT INTO tasks(tenant_id,title,related_type,related_id) VALUES('${tenant}','First saved follow-up','contact','${contact}') RETURNING id;`,
  );
  assert.equal(
    sql(`SELECT title FROM tasks WHERE id='${task}' AND tenant_id='${tenant}';`),
    "First saved follow-up",
  );
  sql(
    `UPDATE tasks SET status='completed',completed_at=now() WHERE id='${task}' AND tenant_id='${tenant}';`,
  );
  assert.equal(
    sql(`SELECT status FROM tasks WHERE id='${task}' AND tenant_id='${tenant}';`),
    "completed",
  );
  assert.equal(
    (await runWorkspaceSetup(config, host, { apply: true, project: "local" })).status,
    "workspace_configured",
  );
  assert.equal(sql(`SELECT count(*) FROM tasks WHERE id='${task}' AND status='completed';`), "1");
  const receipt = {
    status: "passed",
    boundary: "native-postgresql-with-simulated-auth-and-storage",
    migrations: catalog.length,
    excluded: [omitted],
    verified: [
      "owner/database identity",
      "ordered business schema",
      "active admin membership",
      "neutral identity",
      "contact and completed task persisted across connections",
      "idempotent setup preserves saved result",
    ],
    notVerified: [
      "hosted Supabase Auth",
      "browser-to-database workflow",
      "Supabase scheduler extensions",
      "human installation trial",
    ],
  };
  writeFileSync(
    "/tmp/accelerate-cold-install-postgres.json",
    JSON.stringify(receipt, null, 2) + "\n",
  );
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  if (started) run("pg_ctl", ["-D", join(root, "data"), "-m", "immediate", "-w", "stop"]);
  rmSync(root, { recursive: true, force: true });
}
