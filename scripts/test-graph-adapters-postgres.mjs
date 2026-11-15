/**
 * Workspace graph database isolation proof on a disposable local PostgreSQL
 * cluster (no network credentials). It applies the canonical tenant helper
 * functions, tenant-ownership loop (NOT NULL, foreign key, RLS) and "Tenant
 * member access" policy loop taken verbatim from
 * migrations/20260830-shared-database-tenancy.sql, plus the real
 * entity-registry link migration, then runs the graph adapters' query shapes
 * as the authenticated role. The role check (admin only) is enforced in the
 * application by authorizeGraphSource and proven in test-graph-adapters.ts;
 * this proof covers the database backstop beneath it.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

const root = mkdtempSync(join(tmpdir(), "graph-adapters-pg-"));
const data = join(root, "data");
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const allocated = server.address().port;
    server.close(() => resolve(allocated));
  });
});
function run(command, args, input) {
  const result = spawnSync(command, args, { encoding: "utf8", input });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}
const psql = [
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
const sql = (text) => run("psql", psql, text);

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const adminA = "33333333-3333-4333-8333-333333333333";
const adminB = "44444444-4444-4444-8444-444444444444";
const revokedA = "55555555-5555-4555-8555-555555555555";
const contactA = "a0000000-0000-4000-8000-000000000001";
const contactB = "b0000000-0000-4000-8000-000000000001";
const companyA = "a0000000-0000-4000-8000-000000000002";

/** Runs a statement as the authenticated role with PostgREST-style request settings. */
function as(tenant, user, text) {
  const headers = tenant ? JSON.stringify({ "x-tenant-id": tenant }) : "{}";
  return sql(`SET ROLE authenticated;
SELECT set_config('request.headers', '${headers}', false);
SELECT set_config('request.jwt.claim.sub', '${user ?? ""}', false);
${text}`)
    .split("\n")
    .filter((line) => line !== "")
    .slice(2)
    .join("\n");
}

const migration = readFileSync("migrations/20260830-shared-database-tenancy.sql", "utf8");
const between = (start, end) => {
  const from = migration.indexOf(start);
  const to = migration.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `canonical migration block not found: ${start}`);
  return migration.slice(from, to + end.length);
};
const tenantFunctions = between(
  "CREATE SCHEMA IF NOT EXISTS private;",
  "GRANT EXECUTE ON FUNCTION private.has_active_tenant_membership(UUID) TO authenticated, service_role;",
);
const tenantOwnership = between(
  "-- Every existing and ordered-future operational table belongs to one tenant.",
  "END $$;",
);
assert.match(tenantOwnership, /ENABLE ROW LEVEL SECURITY/);
const tenantPolicies = between(
  "-- Direct authenticated data access is narrowed to one explicit requested tenant.",
  "END $$;",
);
assert.match(tenantPolicies, /CREATE POLICY "Tenant member access"/);
const linkMigration = readFileSync("migrations/20260904-entity-registry-link-graph.sql", "utf8");

const graphReads = {
  contacts: `SELECT id FROM public.contacts WHERE tenant_id = '${A}' ORDER BY id LIMIT 51`,
  companies: `SELECT id FROM public.companies WHERE tenant_id = '${A}' ORDER BY id LIMIT 51`,
  opportunities: `SELECT id FROM public.opportunities WHERE tenant_id = '${A}' AND contact_id = '${contactA}' ORDER BY id LIMIT 51`,
  tasks: `SELECT id FROM public.tasks WHERE tenant_id = '${A}' AND (contact_id = '${contactA}' OR (related_type = 'contact' AND related_id = '${contactA}')) ORDER BY id LIMIT 51`,
  approvals: `SELECT id FROM public.action_queue WHERE tenant_id = '${A}' AND status = 'pending' AND (expires_at IS NULL OR expires_at > now()) ORDER BY id LIMIT 51`,
  invoice_drafts: `SELECT id FROM public.action_queue WHERE tenant_id = '${A}' AND status = 'executed' AND action_type = 'create_stripe_invoice_draft' AND payload->>'contactId' = '${contactA}' ORDER BY id LIMIT 51`,
  conversations: `SELECT id FROM public.conversations WHERE tenant_id = '${A}' ORDER BY id LIMIT 51`,
  // Two exact-sided reads (readEntityLinksForNodes), deduplicated by link id.
  links: `SELECT link_type FROM (SELECT id, link_type FROM public.entity_links WHERE tenant_id = '${A}' AND source_type IN ('contact','company') AND source_id IN ('${contactA}','${companyA}') UNION SELECT id, link_type FROM public.entity_links WHERE tenant_id = '${A}' AND target_type IN ('contact','company') AND target_id IN ('${contactA}','${companyA}')) AS sides ORDER BY 1`,
};

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
  sql(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
CREATE TABLE public.tenants (id uuid PRIMARY KEY, status text NOT NULL);
CREATE TABLE public.tenant_memberships (tenant_id uuid REFERENCES public.tenants(id), user_id uuid, invited_email text, role text, status text);
CREATE FUNCTION public.accelerate_default_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${A}'::uuid $$;
CREATE FUNCTION public.revenue_os_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TABLE public.contacts (id uuid PRIMARY KEY, tenant_id uuid, full_name text, company_id uuid);
CREATE TABLE public.companies (id uuid PRIMARY KEY, tenant_id uuid, name text);
CREATE TABLE public.opportunities (id uuid PRIMARY KEY, tenant_id uuid, name text, stage text, contact_id uuid, company_id uuid);
CREATE TABLE public.tasks (id uuid PRIMARY KEY, tenant_id uuid, title text, status text, related_type text, related_id uuid, opportunity_id uuid, contact_id uuid);
CREATE TABLE public.action_queue (id uuid PRIMARY KEY, tenant_id uuid, title text, status text, action_type text, entity_type text, entity_id text, expires_at timestamptz, payload jsonb NOT NULL DEFAULT '{}');
CREATE TABLE public.conversations (id uuid PRIMARY KEY, tenant_id uuid, subject text, contact_id uuid, company_id uuid, opportunity_id uuid);`);
  sql(tenantFunctions);
  sql(tenantOwnership);
  sql(tenantPolicies);
  sql(tenantOwnership);
  sql(tenantPolicies);
  sql(linkMigration);
  sql(linkMigration);
  sql(`INSERT INTO public.tenants VALUES ('${A}','active'),('${B}','active');
INSERT INTO public.tenant_memberships VALUES
  ('${A}','${adminA}','admin@a.example','admin','active'),
  ('${B}','${adminB}','admin@b.example','admin','active'),
  ('${A}','${revokedA}','revoked@a.example','admin','revoked');
INSERT INTO public.contacts VALUES ('${contactA}','${A}','Alpha Customer','${companyA}'),('${contactB}','${B}','Beta Customer',NULL);
INSERT INTO public.companies VALUES ('${companyA}','${A}','Alpha Co');
INSERT INTO public.opportunities VALUES (gen_random_uuid(),'${A}','Alpha Deal','proposal','${contactA}','${companyA}'),(gen_random_uuid(),'${B}','Beta Deal','proposal','${contactB}',NULL);
INSERT INTO public.tasks VALUES (gen_random_uuid(),'${A}','Alpha follow up','pending','contact','${contactA}',NULL,NULL),(gen_random_uuid(),'${B}','Beta follow up','pending','contact','${contactA}',NULL,NULL);
INSERT INTO public.action_queue VALUES
  (gen_random_uuid(),'${A}','Approve reply','pending','send_gmail_reply','contact','${contactA}',now() + interval '1 day','{}'),
  (gen_random_uuid(),'${A}','Expired','pending','update_task','contact','${contactA}',now() - interval '1 day','{}'),
  (gen_random_uuid(),'${A}','Invoice draft','executed','create_stripe_invoice_draft',NULL,NULL,NULL,'{"contactId":"${contactA}"}'),
  (gen_random_uuid(),'${B}','Foreign invoice','executed','create_stripe_invoice_draft',NULL,NULL,NULL,'{"contactId":"${contactA}"}');
INSERT INTO public.conversations VALUES (gen_random_uuid(),'${A}','Alpha question','${contactA}',NULL,NULL),(gen_random_uuid(),'${B}','Beta question','${contactB}',NULL,NULL);
INSERT INTO public.entity_links (tenant_id, source_type, source_id, target_type, target_id, link_type) VALUES
  ('${A}','contact','${contactA}','company','${companyA}','champion'),
  ('${B}','contact','${contactA}','company','${companyA}','foreign_link');`);

  const counts = (tenant, user) =>
    Object.fromEntries(
      Object.entries(graphReads).map(([name, query]) => [
        name,
        as(tenant, user, query).split("\n").filter(Boolean),
      ]),
    );

  const admin = counts(A, adminA);
  assert.equal(admin.contacts.length, 1);
  assert.equal(admin.companies.length, 1);
  assert.equal(admin.opportunities.length, 1);
  assert.equal(admin.tasks.length, 1, "a tenant-B task naming the tenant-A contact stays hidden");
  assert.equal(admin.approvals.length, 1, "expired proposals are filtered in the query");
  assert.equal(
    admin.invoice_drafts.length,
    1,
    "a tenant-B invoice naming the contact stays hidden",
  );
  assert.equal(admin.conversations.length, 1);
  assert.deepEqual(admin.links, ["champion"], "a tenant-B link naming tenant-A ids is invisible");

  // RLS is the backstop even if a query forgot its explicit tenant filter.
  assert.equal(as(A, adminA, "SELECT count(*) FROM public.contacts"), "1");
  assert.equal(as(A, adminA, "SELECT count(*) FROM public.entity_links"), "1");
  assert.equal(as(A, adminA, `SELECT count(*) FROM public.contacts WHERE tenant_id = '${B}'`), "0");

  for (const [label, tenant, user] of [
    ["foreign tenant header", B, adminA],
    ["revoked membership", A, revokedA],
    ["missing tenant header", null, adminA],
    ["anonymous user", A, null],
  ]) {
    const denied = counts(tenant, user);
    for (const [name, rows] of Object.entries(denied))
      assert.equal(rows.length, 0, `${label}: ${name} must return nothing`);
  }
  sql(`UPDATE public.tenants SET status = 'suspended' WHERE id = '${A}'`);
  for (const [name, rows] of Object.entries(counts(A, adminA)))
    assert.equal(rows.length, 0, `suspended tenant: ${name} must return nothing`);

  console.log(
    JSON.stringify({
      result: "passed",
      checks: [
        "canonical tenant policy and entity-link migration applied (idempotent)",
        "admin reads only bound-tenant rows for every graph source query",
        "foreign-tenant rows naming tenant-A ids stay invisible",
        "expired approvals excluded in the query",
        "rls backstop without an explicit tenant filter",
        "foreign header, revoked, missing header, anonymous and suspended get nothing",
      ],
    }),
  );
} finally {
  if (started) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  rmSync(root, { recursive: true, force: true });
}
