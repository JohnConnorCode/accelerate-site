// Native PostgreSQL regression for the public.audit_log append-only boundary.
//
// Owner-scoped, disposable fixture: a private loopback cluster under a fresh
// temp directory, created and destroyed by this file. It never reads hosted
// credentials, never connects to the configured project database and makes no
// provider calls.
//
// Pin the owned cluster binaries when the default PATH is not PostgreSQL 17:
//   POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin \
//     npm run resources:run -- node scripts/test-audit-log-append-only-postgres.mjs
// The run prints the actual server version it used.
//
// Part 1 reproduces the live gap on the pre-existing schema (an authenticated
// tenant member can UPDATE/DELETE audit content). Part 2 applies the additive
// migration twice and proves the ledger is append-only for client API roles
// (anon/authenticated and any role inheriting them, at any depth) while
// service_role, the table owner and the existing ownership guard keep their
// intended paths.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const migration = "migrations/20261017050301_audit_log_append_only.sql";
const revenue = readFileSync("migrations/20260816-revenue-os.sql", "utf8");
const tenancy = readFileSync("migrations/20260830-shared-database-tenancy.sql", "utf8");
const suspension = readFileSync("migrations/20260831-tenant-suspension-guards.sql", "utf8");
const commandContext = readFileSync(
  "migrations/20261007181105_platform_private_command_context.sql",
  "utf8",
);
// Extract the real source definitions instead of permissive replacements.
function definition(source, kind, name) {
  const escaped = name.replaceAll(".", "\\.");
  const expression =
    kind === "TABLE"
      ? new RegExp(`CREATE TABLE IF NOT EXISTS ${escaped} \\([\\s\\S]*?\\n\\);`)
      : new RegExp(`CREATE OR REPLACE FUNCTION ${escaped}\\([\\s\\S]*?\\$\\$;`);
  const result = source.match(expression)?.[0];
  assert.ok(result, `Missing source ${kind}: ${name}`);
  return result;
}

// Owned-cluster binaries: POSTGRES_BIN pins a specific install; otherwise PATH.
const binDir = process.env.POSTGRES_BIN || process.env.PG_BIN || "";
const bin = (name) => (binDir ? join(binDir, name) : name);

const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const owner = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const outsider = "44444444-4444-4444-8444-444444444444";
// audit_log.id is a real uuid column; fixture rows use fixed valid ids.
const rowPre = "0e000000-0000-4000-8000-000000000001";
const rowShared = "0e000000-0000-4000-8000-000000000002";
const rowPrivate = "0e000000-0000-4000-8000-000000000003";
const literal = (value) => `'${value.replaceAll("'", "''")}'`;

const root = mkdtempSync(join(tmpdir(), "accelerate-audit-append-only-"));
const data = join(root, "data");
const TIMEOUT_MS = 30_000;
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close(() => resolve(address.port));
  });
});

function spawn(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: TIMEOUT_MS,
    ...options,
  });
}
// Startup and DDL must succeed; a psql fixture error must fail the test.
function checked(command, args, options = {}) {
  const result = spawn(command, args, options);
  assert.equal(result.status, 0, result.stderr || result.stdout || `${command} failed`);
  return result.stdout;
}
const base = [
  "-X",
  "-h",
  "127.0.0.1",
  "-p",
  String(port),
  "-U",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-v",
  "VERBOSITY=verbose",
  "-qAt",
];
// Finite SQL/lock waits so a broken lock cannot hang the fixture.
const psqlEnv = {
  ...process.env,
  PGOPTIONS: "-c lock_timeout=10000 -c statement_timeout=60000",
};
const PSQL = bin("psql");
let database = "postgres";
const sql = (source) => checked(PSQL, [...base, "-d", database], { input: source, env: psqlEnv });
const adminSql = (source) =>
  checked(PSQL, [...base, "-d", "postgres"], { input: source, env: psqlEnv });
const checks = [];
function verify(source) {
  const output = sql(source);
  for (const line of output.split("\n"))
    if (line.startsWith("PASS:")) checks.push(`${database}:${line.slice(5)}`);
}
// Supabase's JWT functions are the transport seam; membership is real SQL.
function context(role, tenant, user = owner) {
  return `SET ROLE ${role};
    SELECT set_config('request.headers', ${literal(JSON.stringify(tenant === null ? {} : { "x-tenant-id": tenant }))}, false);
    SELECT set_config('request.jwt.claim.sub', '${user}', false);
    SELECT set_config('request.jwt.claim.role', '${role}', false);`;
}
function denied(role, tenant, user, query, label, messagePattern = /42501:/) {
  const result = spawn(PSQL, [...base, "-d", database], {
    input: `BEGIN; ${context(role, tenant, user)} ${query}; ROLLBACK;`,
    env: psqlEnv,
  });
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
  assert.match(result.stderr, messagePattern, `${label} must be refused with the expected error`);
  checks.push(`${database}:${label}`);
}

let started = false;
let startAttempted = false;
let receipt;
let bodyError;
try {
  checked(bin("initdb"), ["-A", "trust", "-U", "postgres", "-D", data]);
  startAttempted = true;
  checked(bin("pg_ctl"), [
    "-D",
    data,
    "-l",
    join(root, "postgres.log"),
    "-o",
    `-F -h 127.0.0.1 -k '' -p ${port}`,
    "-w",
    "start",
  ]);
  started = true;

  const serverVersion = adminSql("SHOW server_version;").trim();
  const serverVersionNum = Number(adminSql("SHOW server_version_num;").trim());
  assert.ok(serverVersionNum >= 150000, `PostgreSQL 15+ required (got ${serverVersion})`);
  console.log(`audit-log append-only fixture server: PostgreSQL ${serverVersion}`);

  // Real roles. app_member inherits authenticated one hop; leaf_writer inherits
  // authenticated through mid_writer (two hops); unrelated_writer is independent.
  adminSql(
    "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; " +
      "CREATE ROLE app_member; GRANT authenticated TO app_member; " +
      "CREATE ROLE mid_writer; GRANT authenticated TO mid_writer; " +
      "CREATE ROLE leaf_writer; GRANT mid_writer TO leaf_writer; " +
      "CREATE ROLE unrelated_writer BYPASSRLS;",
  );
  assert.equal(
    adminSql(
      "SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','app_member','mid_writer','leaf_writer','unrelated_writer');",
    ).trim(),
    "7",
    "fixture roles must exist",
  );
  assert.equal(
    adminSql("SELECT pg_has_role('leaf_writer', 'authenticated', 'MEMBER');").trim(),
    "t",
    "leaf_writer must be a transitive member of authenticated",
  );

  database = "audit_log_proof";
  checked(bin("createdb"), ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", database]);
  sql(`
    CREATE SCHEMA auth; CREATE SCHEMA private;
    REVOKE ALL ON SCHEMA private FROM PUBLIC;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role, app_member, mid_writer, leaf_writer, unrelated_writer;
    ${definition(tenancy, "TABLE", "public.tenants")}
    ${definition(tenancy, "TABLE", "public.tenant_memberships")}
    ${definition(tenancy, "FUNCTION", "public.accelerate_default_tenant_id")}
    ${definition(tenancy, "FUNCTION", "private.request_tenant_id")}
    ${definition(tenancy, "FUNCTION", "private.has_active_tenant_membership")}
    ${definition(suspension, "FUNCTION", "private.authorized_request_tenant_id")}
    ${definition(revenue, "TABLE", "audit_log")}
    ${definition(commandContext, "FUNCTION", "private.guard_command_ownership")}
    REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
    GRANT USAGE ON SCHEMA private TO authenticated, service_role;
    GRANT EXECUTE ON FUNCTION private.request_tenant_id() TO authenticated, service_role;
    GRANT EXECUTE ON FUNCTION private.has_active_tenant_membership(uuid) TO authenticated, service_role;
    GRANT EXECUTE ON FUNCTION private.authorized_request_tenant_id() TO authenticated, service_role;
    REVOKE ALL ON FUNCTION public.accelerate_default_tenant_id() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.accelerate_default_tenant_id() TO service_role;
    ALTER TABLE public.audit_log ADD COLUMN tenant_id uuid NOT NULL;
    ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
    ALTER TABLE public.audit_log ADD COLUMN platform_owner_user_id uuid REFERENCES auth.users(id);
    ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON FUNCTION private.guard_command_ownership() FROM PUBLIC;
    CREATE TRIGGER command_ownership_guard BEFORE INSERT OR UPDATE ON public.audit_log
      FOR EACH ROW EXECUTE FUNCTION private.guard_command_ownership();
    ${tenancy
      .match(/'CREATE POLICY "Tenant member access"[^\n]+/)[0]
      .slice(1, -2)
      .replace("%I", "audit_log")};
    CREATE POLICY "Private command owner" ON public.audit_log AS RESTRICTIVE FOR ALL TO authenticated
      USING (platform_owner_user_id IS NULL OR platform_owner_user_id = (SELECT auth.uid()))
      WITH CHECK (platform_owner_user_id IS NULL OR platform_owner_user_id = (SELECT auth.uid()));
    CREATE POLICY "Service role full access" ON public.audit_log FOR ALL TO service_role
      USING (true) WITH CHECK (true);
    GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log TO authenticated, anon, service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log TO unrelated_writer;
    INSERT INTO auth.users VALUES ('${owner}'), ('${member}'), ('${other}'), ('${outsider}');
    INSERT INTO tenants(id, slug, name, status) VALUES
      ('${a}', 'northline', 'Northline', 'active'),
      ('${b}', 'southline', 'Southline', 'active');
    INSERT INTO tenant_memberships(tenant_id, user_id, invited_email, status) VALUES
      ('${a}', '${owner}', 'owner@example.test', 'active'),
      ('${a}', '${member}', 'member@example.test', 'active'),
      ('${b}', '${other}', 'other@example.test', 'active');
    CREATE FUNCTION public.test_assert(condition boolean, label text) RETURNS text LANGUAGE plpgsql AS $$
      BEGIN IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', label; END IF; RETURN 'PASS:' || label; END $$;
    -- Representative canonical writer: the domain-RPC append pattern built on
    -- the real private.authorized_request_tenant_id() authorizer. Clearly a
    -- fixture writer, not a reimplementation of a specific production RPC.
    CREATE FUNCTION public.controlled_audit_append(p_action text, p_entity_id text)
      RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
      DECLARE workspace uuid; created uuid;
      BEGIN
        workspace := private.authorized_request_tenant_id();
        INSERT INTO public.audit_log(tenant_id, action, entity_type, entity_id, source)
          VALUES (workspace, p_action, 'controlled', p_entity_id, 'automation')
          RETURNING id INTO created;
        RETURN created;
      END $$;
    GRANT EXECUTE ON FUNCTION public.controlled_audit_append(text, text) TO authenticated, service_role;
  `);

  // ----------------------------------------------------------- pre-fix gap
  verify(`${context("authenticated", a, owner)}
    INSERT INTO audit_log(id, tenant_id, action, entity_type, entity_id) VALUES ('${rowPre}', '${a}', 'created', 'controlled', 'pre-1');
    SELECT test_assert((SELECT action FROM audit_log WHERE id='${rowPre}')='created','pre-fix canonical append works');`);
  verify(`${context("authenticated", a, owner)}
    UPDATE audit_log SET action='tampered', after_state='{"forged":true}' WHERE id='${rowPre}';
    SELECT test_assert((SELECT action FROM audit_log WHERE id='${rowPre}')='tampered','pre-fix authenticated UPDATE of audit content succeeds');`);
  verify(`${context("authenticated", a, owner)}
    DELETE FROM audit_log WHERE id='${rowPre}';
    SELECT test_assert((SELECT count(*) FROM audit_log)=0,'pre-fix authenticated DELETE succeeds');`);

  // ------------------------------------------------------------- the fix
  // Applied twice: additive and idempotent.
  checked(PSQL, [...base, "-d", database, "-f", migration], { env: psqlEnv });
  checked(PSQL, [...base, "-d", database, "-f", migration], { env: psqlEnv });

  verify(`SELECT test_assert(
    (SELECT count(*) FROM pg_policies WHERE tablename='audit_log' AND policyname IN ('Tenant member access','Private command owner','Service role full access'))=3,
    'existing policies retained');
    SELECT test_assert(
    (SELECT count(*) FROM pg_policies WHERE tablename='audit_log' AND policyname='Private command owner' AND permissive='RESTRICTIVE')=1,
    'private owner policy stays restrictive');
    SELECT test_assert(
    (SELECT bool_and(has_table_privilege('authenticated','public.audit_log', priv)) FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) AS priv),
    'authenticated grants retained, not removed');
    SELECT test_assert(
    (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.audit_log'::regclass AND NOT tgisinternal AND tgname IN ('command_ownership_guard','audit_log_append_only_guard','audit_log_append_only_truncate_guard'))=3,
    'ownership + append-only row and truncate guards installed');
    SELECT test_assert(
    (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.proname='guard_audit_log_append_only')=1,
    'append-only guard function exists exactly once after two applications');`);

  // Canonical append/read paths still work: direct client insert (a shared row
  // and a private row owned at insert time), and the representative RPC writer.
  verify(`${context("authenticated", a, owner)}
    INSERT INTO audit_log(id, tenant_id, action, entity_type, entity_id, platform_owner_user_id) VALUES
      ('${rowShared}', '${a}', 'created', 'controlled', 'shared-1', NULL),
      ('${rowPrivate}', '${a}', 'created', 'controlled', 'private-1', '${owner}');
    SELECT test_assert((SELECT count(*) FROM audit_log WHERE tenant_id='${a}')=2,'canonical authenticated append + read intact');
    SELECT test_assert(controlled_audit_append('rpc.append','rpc-1') IS NOT NULL,'canonical SECURITY DEFINER RPC append succeeds');
    SELECT test_assert(EXISTS(SELECT 1 FROM audit_log WHERE entity_id='rpc-1'),'RPC audit row is readable in the tenant');`);

  // Client API roles can no longer mutate audit content.
  denied(
    "authenticated",
    a,
    owner,
    `UPDATE audit_log SET action='tampered' WHERE id='${rowShared}'`,
    "authenticated content UPDATE denied",
  );
  denied(
    "authenticated",
    a,
    owner,
    `UPDATE audit_log SET metadata='{}' WHERE id='${rowPrivate}'`,
    "authenticated private-row UPDATE denied",
  );
  denied(
    "authenticated",
    a,
    owner,
    `DELETE FROM audit_log WHERE id='${rowShared}'`,
    "authenticated DELETE denied",
  );
  denied("authenticated", a, owner, "TRUNCATE public.audit_log", "authenticated TRUNCATE denied");
  denied("anon", a, owner, "TRUNCATE public.audit_log", "anonymous TRUNCATE denied");
  denied(
    "app_member",
    a,
    owner,
    `UPDATE audit_log SET action='x' WHERE id='${rowShared}'`,
    "one-hop inherited client-role UPDATE denied",
  );
  denied(
    "leaf_writer",
    a,
    owner,
    `UPDATE audit_log SET action='x' WHERE id='${rowShared}'`,
    "two-hop inherited client-role UPDATE denied",
  );
  denied(
    "unrelated_writer",
    a,
    owner,
    `UPDATE audit_log SET action='x' WHERE id='${rowShared}'`,
    "independent RLS-bypassing role UPDATE denied (fail closed)",
  );
  // Ownership/tenant immutability keeps its canonical refusal (compatibility).
  denied(
    "authenticated",
    a,
    owner,
    `UPDATE audit_log SET platform_owner_user_id=NULL WHERE id='${rowPrivate}'`,
    "ownership change still refused by command_ownership_guard",
    /ownership|workspace/i,
  );
  denied(
    "authenticated",
    a,
    owner,
    `UPDATE audit_log SET tenant_id='${b}' WHERE id='${rowShared}'`,
    "tenant change still refused",
    /ownership|workspace|row-level security/i,
  );

  // Tenant/private-owner denials preserved on the INSERT path.
  denied(
    "authenticated",
    a,
    owner,
    `INSERT INTO audit_log(tenant_id, action, entity_type, entity_id) VALUES ('${b}', 'forged', 'controlled', 'foreign')`,
    "foreign-tenant insert denied",
  );
  denied(
    "authenticated",
    a,
    member,
    `INSERT INTO audit_log(tenant_id, action, entity_type, entity_id, platform_owner_user_id) VALUES ('${a}', 'forged', 'controlled', 'spoof', '${owner}')`,
    "spoofed private-owner insert denied",
  );

  // A peer member cannot touch another owner's private row: zero rows, no error.
  verify(`${context("authenticated", a, member)}
    WITH changed AS (UPDATE audit_log SET metadata='{"tampered":true}' WHERE id='${rowPrivate}' RETURNING id)
      SELECT test_assert((SELECT count(*) FROM changed)=0,'peer member UPDATE of another owner row touches zero rows');
    WITH removed AS (DELETE FROM audit_log WHERE id='${rowPrivate}' RETURNING id)
      SELECT test_assert((SELECT count(*) FROM removed)=0,'peer member DELETE of another owner row touches zero rows');`);
  verify(`SELECT test_assert((SELECT action FROM audit_log WHERE id='${rowPrivate}')='created','private row unchanged after peer attempts');
    SELECT test_assert((SELECT platform_owner_user_id FROM audit_log WHERE id='${rowPrivate}')='${owner}','private owner unchanged after peer attempts');`);

  // Trusted retention paths remain available to service_role and the owner.
  verify(`${context("service_role", a, owner)}
    UPDATE audit_log SET action='retained' WHERE id='${rowShared}';
    SELECT test_assert((SELECT action FROM audit_log WHERE id='${rowShared}')='retained','service_role retention UPDATE succeeds');
    DELETE FROM audit_log WHERE id='${rowShared}';
    SELECT test_assert((SELECT count(*) FROM audit_log WHERE id='${rowShared}')=0,'service_role retention DELETE succeeds');`);
  verify(`UPDATE audit_log SET action='owner' WHERE id='${rowPrivate}';
    SELECT test_assert((SELECT action FROM audit_log WHERE id='${rowPrivate}')='owner','table owner UPDATE succeeds');
    DELETE FROM audit_log WHERE id='${rowPrivate}';
    SELECT test_assert((SELECT count(*) FROM audit_log WHERE id='${rowPrivate}')=0,'table owner DELETE succeeds');`);

  receipt = {
    result: "passed",
    boundary: "native PostgreSQL, owned disposable loopback fixture",
    serverVersion,
    migration,
    migrationApplications: 2,
    guarantee:
      "anon/authenticated and any role inheriting them (any depth) cannot UPDATE/DELETE/TRUNCATE public.audit_log",
    outsideGuarantee:
      "service_role, a superuser, the table owner and roles inheriting service_role retain governed retention",
    checks,
  };
} catch (error) {
  bodyError = error;
}

// Cleanup is part of pass/fail: a live owned server must stop, or the command
// fails and the fixture is preserved. A start that was attempted but never
// confirmed must not delete a possibly-running data directory.
if (started) {
  const stop = spawn(bin("pg_ctl"), ["-D", data, "-m", "immediate", "-w", "stop"], {
    timeout: TIMEOUT_MS,
  });
  if (stop.status === 0) rmSync(root, { recursive: true, force: true });
  else throw new Error(`owned PostgreSQL did not stop cleanly; fixture preserved at ${root}`);
} else if (!startAttempted) {
  rmSync(root, { recursive: true, force: true });
} else {
  throw new Error(`owned PostgreSQL start was not confirmed; fixture preserved at ${root}`);
}

if (bodyError) throw bodyError;
writeFileSync(
  join(tmpdir(), "accelerate-audit-log-append-only-postgres.json"),
  JSON.stringify(receipt, null, 2) + "\n",
  { mode: 0o600 },
);
console.log(JSON.stringify({ ...receipt, checks: receipt.checks.length }, null, 2));
