import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const migration = "migrations/20261007200138_learning_proposals_least_privilege.sql";
const tenancy = readFileSync("migrations/20260830-shared-database-tenancy.sql", "utf8");
const suspension = readFileSync("migrations/20260831-tenant-suspension-guards.sql", "utf8");
// Extract source definitions, not permissive replacements for membership/RLS.
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
const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const outsider = "33333333-3333-4333-8333-333333333333";
const proposalA = "10000000-0000-4000-8000-000000000001";
const proposalB = "10000000-0000-4000-8000-000000000002";
const literal = (value) => `'${value.replaceAll("'", "''")}'`;
const root = mkdtempSync(join(tmpdir(), "accelerate-learning-grants-"));
const data = join(root, "data");
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close(() => resolve(address.port));
  });
});
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed`);
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
const checks = [];
let database;
const sql = (source) => run("psql", [...base, "-d", database], { input: source });
function verify(source) {
  const output = sql(source);
  for (const line of output.split("\n"))
    if (line.startsWith("PASS:")) checks.push(`${database}:${line.slice(5)}`);
}
function context(role, tenant, user = owner) {
  return `SET ROLE ${role};
    SELECT set_config('request.headers', ${literal(JSON.stringify(tenant === null ? {} : { "x-tenant-id": tenant }))}, false);
    SELECT set_config('request.jwt.claim.sub', '${user}', false);
    SELECT set_config('request.jwt.claim.role', '${role}', false);`;
}
function denied(role, tenant, user, query, label) {
  const result = spawnSync("psql", [...base, "-d", database], {
    encoding: "utf8",
    input: `BEGIN; ${context(role, tenant, user)} ${query}; ROLLBACK;`,
  });
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
  assert.match(
    result.stderr,
    /42501:/,
    `${label} must fail for insufficient privilege, not a fixture error`,
  );
  checks.push(`${database}:${label}`);
}
let started = false;
try {
  run("initdb", ["-A", "trust", "-U", "postgres", "-D", data]);
  run("pg_ctl", [
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
  database = "postgres";
  sql("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;");
  const version = Number(sql("SHOW server_version_num;").trim());
  assert.ok(version >= 150000, "PostgreSQL 15+ required");
  const privileges = [
    "SELECT",
    "INSERT",
    "UPDATE",
    "DELETE",
    "TRUNCATE",
    "REFERENCES",
    "TRIGGER",
    ...(version >= 170000 ? ["MAINTAIN"] : []),
  ];
  for (const fixture of ["fresh", "populated"]) {
    database = "postgres";
    sql(`CREATE DATABASE learning_${fixture};`);
    database = `learning_${fixture}`;
    sql(`
      CREATE SCHEMA auth; CREATE SCHEMA private;
      REVOKE ALL ON SCHEMA private FROM PUBLIC;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      -- Supabase's JWT functions are the transport seam; membership is real SQL.
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
      GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
      ${definition(tenancy, "TABLE", "public.tenants")}
      ${definition(tenancy, "TABLE", "public.tenant_memberships")}
      ${definition(tenancy, "FUNCTION", "public.accelerate_default_tenant_id")}
      ${definition(tenancy, "FUNCTION", "private.request_tenant_id")}
      ${definition(tenancy, "FUNCTION", "private.has_active_tenant_membership")}
      ${definition(suspension, "FUNCTION", "private.authorized_request_tenant_id")}
      REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
      GRANT USAGE ON SCHEMA private TO authenticated, service_role;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated, service_role;
      REVOKE ALL ON FUNCTION public.accelerate_default_tenant_id() FROM PUBLIC, anon, authenticated;
      GRANT EXECUTE ON FUNCTION public.accelerate_default_tenant_id() TO service_role;
      INSERT INTO auth.users VALUES('${owner}'),('${other}'),('${outsider}');
      INSERT INTO tenants(id, slug, name, status) VALUES('${a}','northline','Northline','active'),('${b}','southline','Southline','active');
      INSERT INTO tenant_memberships(tenant_id,user_id,invited_email,status) VALUES
        ('${a}','${owner}','owner@example.test','active'),('${b}','${other}','other@example.test','active');
      CREATE TABLE coworkers(id text PRIMARY KEY,tenant_id uuid);
      CREATE TABLE action_queue(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,
        action_type text,payload jsonb,status text,approved_by text,approved_at timestamptz,result jsonb,updated_at timestamptz DEFAULT now());
      CREATE TABLE audit_log(id uuid DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,actor_email text,action text,
        entity_type text,entity_id text,source text,metadata jsonb);
      CREATE FUNCTION public.test_assert(condition boolean, label text) RETURNS text LANGUAGE plpgsql AS $$
        BEGIN IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', label; END IF; RETURN 'PASS:' || label; END $$;
    `);
    for (const path of [
      "migrations/20260903-agent-memory-and-budgets.sql",
      "migrations/20260911-learning-inbox.sql",
      "migrations/20260920-connected-learning.sql",
    ])
      run("psql", [...base, "-d", database, "-f", path]);
    sql(`
      GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON learned_policies, action_queue, audit_log TO authenticated;
      ALTER TABLE action_queue ENABLE ROW LEVEL SECURITY; ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_actions ON action_queue TO authenticated
        USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
        WITH CHECK(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
      CREATE POLICY tenant_audit ON audit_log TO authenticated
        USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
        WITH CHECK(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
      -- Reproduce hosted broad grants plus PUBLIC and independent column grants.
      GRANT ALL ON learning_proposals TO anon, authenticated;
      GRANT TRUNCATE ON learning_proposals TO PUBLIC;
      GRANT SELECT(rule), REFERENCES(id) ON learning_proposals TO anon, authenticated, PUBLIC;
    `);
    if (fixture === "populated")
      sql(`
      INSERT INTO learned_policies(id,tenant_id,action_key,rule,rationale,source)
        VALUES('90000000-0000-4000-8000-000000000001','${a}','existing','Existing policy','Retained','policy_review');
      INSERT INTO action_queue(id,tenant_id,action_type,status) VALUES('${proposalA}','${a}','approve_learning','executed');
      INSERT INTO learning_proposals(tenant_id,proposal_type,rule,dedupe_key,status,learned_policy_id,approval_action_id)
        SELECT '${a}','messaging','Existing '||state,state,state,
          CASE WHEN state='approved' THEN '90000000-0000-4000-8000-000000000001'::uuid END,
          CASE WHEN state='approved' THEN '${proposalA}'::uuid END
        FROM unnest(ARRAY['proposed','approved','rejected','ignored','conversation_only']) state;
      INSERT INTO audit_log(tenant_id,action,entity_type,entity_id,metadata)
        VALUES('${a}','existing.receipt','learning_proposal','retained','{"keep":true}');
    `);
    const snapshot = () =>
      sql(`SELECT jsonb_build_object(
      'rows',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY id),'[]') FROM learning_proposals p),
      'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY polname) FROM pg_policy p WHERE polrelid='learning_proposals'::regclass),
      'rls',(SELECT jsonb_build_array(relrowsecurity,relforcerowsecurity,relowner) FROM pg_class WHERE oid='learning_proposals'::regclass),
      'parents',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM learned_policies p),
      'actions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM action_queue p),
      'audit',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM audit_log p),
      'service',(SELECT jsonb_agg(to_jsonb(p) ORDER BY privilege_type) FROM aclexplode((SELECT relacl FROM pg_class WHERE oid='learning_proposals'::regclass)) p WHERE grantee='service_role'::regrole)
    );`).trim();
    verify(`SELECT test_assert(NOT rolsuper AND NOT rolbypassrls,'authenticated has no RLS bypass') FROM pg_roles WHERE rolname='authenticated';
      SELECT test_assert(NOT rolsuper AND NOT rolbypassrls,'anon has no RLS bypass') FROM pg_roles WHERE rolname='anon';`);
    const before = snapshot();
    for (let application = 1; application <= 2; application++) {
      run("psql", [...base, "-d", database, "-f", migration]);
      assert.equal(
        snapshot(),
        before,
        `${fixture}: application ${application} altered rows, policies, owner, RLS or service grants`,
      );
      checks.push(`${database}:application ${application} preserves populated state and RLS`);
      for (const role of ["anon", "authenticated", "service_role"])
        for (const privilege of privileges) {
          const allowed =
            role === "service_role" ||
            (role === "authenticated" &&
              ["SELECT", "INSERT", "UPDATE", "DELETE"].includes(privilege));
          verify(
            `SELECT test_assert(has_table_privilege('${role}','learning_proposals','${privilege}')=${allowed},'${role} ${privilege} application ${application}');`,
          );
        }
      for (const role of ["anon", "authenticated"])
        for (const privilege of ["SELECT", "INSERT", "UPDATE", "REFERENCES"]) {
          const allowed = role === "authenticated" && privilege !== "REFERENCES";
          verify(
            `SELECT test_assert(has_any_column_privilege('${role}','learning_proposals','${privilege}')=${allowed},'${role} column ${privilege} application ${application}');`,
          );
        }
    }
    sql(`INSERT INTO learning_proposals(id,tenant_id,proposal_type,rule,dedupe_key) VALUES
      ('${proposalA}','${a}','messaging','North rule','north-proof'),('${proposalB}','${b}','messaging','South rule','south-proof');`);
    for (const [tenant, user, own, foreign] of [
      [a, owner, proposalA, proposalB],
      [b, other, proposalB, proposalA],
    ]) {
      verify(`${context("authenticated", tenant, user)}
        SELECT test_assert(EXISTS(SELECT 1 FROM learning_proposals WHERE id='${own}'),'member reads own proposal');
        SELECT test_assert(NOT EXISTS(SELECT 1 FROM learning_proposals WHERE id='${foreign}'),'member cannot read foreign proposal');
        WITH changed AS(UPDATE learning_proposals SET rationale='foreign' WHERE id='${foreign}' RETURNING id)
          SELECT test_assert((SELECT count(*) FROM changed)=0,'foreign update touches zero rows');
        WITH removed AS(DELETE FROM learning_proposals WHERE id='${foreign}' RETURNING id)
          SELECT test_assert((SELECT count(*) FROM removed)=0,'foreign delete touches zero rows');
        INSERT INTO learning_proposals(tenant_id,proposal_type,rule,dedupe_key) VALUES('${tenant}','messaging','Temporary','crud-proof');
        WITH changed AS(UPDATE learning_proposals SET rationale='Changed' WHERE dedupe_key='crud-proof' RETURNING id)
          SELECT test_assert((SELECT count(*) FROM changed)=1,'member updates own proposal');
        WITH removed AS(DELETE FROM learning_proposals WHERE dedupe_key='crud-proof' RETURNING id)
          SELECT test_assert((SELECT count(*) FROM removed)=1,'member deletes own proposal');`);
      denied(
        "authenticated",
        tenant,
        user,
        `INSERT INTO learning_proposals(tenant_id,proposal_type,rule,dedupe_key) VALUES('${tenant === a ? b : a}','messaging','Forbidden','foreign-insert')`,
        "foreign insert denied",
      );
      denied(
        "authenticated",
        tenant,
        user,
        `UPDATE learning_proposals SET tenant_id='${tenant === a ? b : a}' WHERE id='${own}'`,
        "tenant reassignment denied",
      );
    }
    for (const [label, tenant, user] of [
      ["missing context", null, owner],
      ["invalid context", "invalid", owner],
      ["nonmember", a, outsider],
      ["foreign membership", b, owner],
    ]) {
      verify(
        `${context("authenticated", tenant, user)} SELECT test_assert((SELECT count(*) FROM learning_proposals)=0,'${label} reads zero rows');`,
      );
      denied(
        "authenticated",
        tenant,
        user,
        `INSERT INTO learning_proposals(tenant_id,proposal_type,rule,dedupe_key) VALUES('${a}','messaging','Forbidden','denied-insert')`,
        `${label} insert denied`,
      );
    }
    for (const [label, change, restore] of [
      [
        "revoked membership",
        `UPDATE tenant_memberships SET status='revoked' WHERE user_id='${owner}'`,
        `UPDATE tenant_memberships SET status='active' WHERE user_id='${owner}'`,
      ],
      [
        "suspended workspace",
        `UPDATE tenants SET status='suspended' WHERE id='${a}'`,
        `UPDATE tenants SET status='active' WHERE id='${a}'`,
      ],
    ]) {
      sql(change);
      verify(
        `${context("authenticated", a)} SELECT test_assert((SELECT count(*) FROM learning_proposals)=0,'${label} reads zero rows');`,
      );
      denied(
        "authenticated",
        a,
        owner,
        `INSERT INTO learning_proposals(tenant_id,proposal_type,rule,dedupe_key) VALUES('${a}','messaging','Forbidden','denied-insert')`,
        `${label} insert denied`,
      );
      sql(restore);
    }
    for (const [query, label] of [
      ["SELECT * FROM learning_proposals", "anonymous select denied"],
      [
        `INSERT INTO learning_proposals(tenant_id,proposal_type,rule,dedupe_key) VALUES('${a}','messaging','Forbidden','anon')`,
        "anonymous insert denied",
      ],
      ["UPDATE learning_proposals SET rationale='Forbidden'", "anonymous update denied"],
      ["DELETE FROM learning_proposals", "anonymous delete denied"],
    ])
      denied("anon", a, owner, query, label);
    sql(
      `CREATE FUNCTION public.test_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;`,
    );
    sql(`CREATE SCHEMA privilege_probe;
      GRANT USAGE ON SCHEMA privilege_probe TO anon, authenticated;
      CREATE TABLE privilege_probe.anon_reference(id uuid);
      ALTER TABLE privilege_probe.anon_reference OWNER TO anon;
      CREATE TABLE privilege_probe.authenticated_reference(id uuid);
      ALTER TABLE privilege_probe.authenticated_reference OWNER TO authenticated;`);
    for (const role of ["anon", "authenticated"]) {
      denied(role, a, owner, "TRUNCATE learning_proposals", `${role} TRUNCATE denied`);
      denied(
        role,
        a,
        owner,
        `ALTER TABLE privilege_probe.${role}_reference ADD CONSTRAINT forbidden_reference FOREIGN KEY(id) REFERENCES public.learning_proposals(id)`,
        `${role} REFERENCES denied`,
      );
      denied(
        role,
        a,
        owner,
        "CREATE TRIGGER forbidden_trigger BEFORE INSERT ON learning_proposals FOR EACH ROW EXECUTE FUNCTION public.test_trigger()",
        `${role} TRIGGER denied`,
      );
    }
    sql(`INSERT INTO action_queue(id,tenant_id,action_type,payload,status,approved_by,approved_at) VALUES
      ('20000000-0000-4000-8000-000000000001','${a}','approve_learning','{"proposalId":"${proposalA}"}','executing','owner@example.test',now());
      UPDATE learning_proposals SET approval_action_id='20000000-0000-4000-8000-000000000001' WHERE id='${proposalA}';`);
    verify(`${context("authenticated", a)}
      SELECT test_assert((approve_learning_proposal('${proposalA}','owner@example.test')->'proposal'->>'status')='approved','authenticated approval RPC succeeds');
      SELECT test_assert((approve_learning_proposal('${proposalA}','owner@example.test')->'proposal'->>'status')='approved','approval replay succeeds');
      SELECT test_assert((SELECT count(*) FROM audit_log WHERE action='learning.approved')=1,'approval replay retains one audit receipt');`);
    sql(`INSERT INTO action_queue(id,tenant_id,action_type,payload,status,approved_by,approved_at) VALUES
      ('20000000-0000-4000-8000-000000000002','${b}','approve_learning','{"proposalId":"${proposalB}"}','executing','other@example.test',now());
      UPDATE learning_proposals SET approval_action_id='20000000-0000-4000-8000-000000000002' WHERE id='${proposalB}';`);
    verify(`${context("service_role", b, other)}
      SELECT test_assert((approve_learning_proposal('${proposalB}','other@example.test')->'proposal'->>'status')='approved','service approval RPC succeeds');
      SELECT test_assert(EXISTS(SELECT 1 FROM learning_proposals WHERE id='${proposalB}'),'service reads existing proposal');
      INSERT INTO learning_proposals(tenant_id,proposal_type,rule,dedupe_key) VALUES('${b}','messaging','Service proof','service-proof');
      WITH changed AS(UPDATE learning_proposals SET rationale='Changed' WHERE dedupe_key='service-proof' RETURNING id)
        SELECT test_assert((SELECT count(*) FROM changed)=1,'service update succeeds');
      WITH removed AS(DELETE FROM learning_proposals WHERE dedupe_key='service-proof' RETURNING id)
        SELECT test_assert((SELECT count(*) FROM removed)=1,'service delete succeeds');`);
  }
  const receipt = {
    result: "passed",
    serverVersionNum: version,
    migration,
    fixtures: ["fresh", "populated"],
    applicationsPerFixture: 2,
    checks,
  };
  writeFileSync(
    join(tmpdir(), "accelerate-learning-proposals-grants-postgres.json"),
    JSON.stringify(receipt, null, 2) + "\n",
    { mode: 0o600 },
  );
  console.log(JSON.stringify({ ...receipt, checks: checks.length }, null, 2));
} finally {
  if (started) spawnSync("pg_ctl", ["-D", data, "-m", "immediate", "stop"], { stdio: "ignore" });
  rmSync(root, { recursive: true, force: true });
}
