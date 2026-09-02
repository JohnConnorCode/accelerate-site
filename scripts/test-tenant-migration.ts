import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TENANT_SCOPED_TABLES } from "../src/lib/revenue-os/schema-contract";

const migration = readFileSync("migrations/20260830-shared-database-tenancy.sql", "utf8");
const recoveryMigration = readFileSync("migrations/20260830-revenue-recovery.sql", "utf8");
const authorizationMigration = readFileSync(
  "migrations/20260830-tenant-context-authorization.sql",
  "utf8",
);
const uniquenessMigration = readFileSync(
  "migrations/20260830-tenant-uniqueness-cutover.sql",
  "utf8",
);
const suspensionMigration = readFileSync(
  "migrations/20260831-tenant-suspension-guards.sql",
  "utf8",
);
const setup = readFileSync("docs/self-hosting/REVENUE-OS-SETUP.md", "utf8");
const contract = readFileSync("docs/contracts/MULTI-TENANCY-CONTRACT.md", "utf8");

for (const table of TENANT_SCOPED_TABLES) {
  assert.match(
    migration,
    new RegExp(`'${table}'`),
    `tenant migration inventory is missing ${table}`,
  );
}

for (const table of [
  "feature_requests",
  "schema_verification_runs",
  "case_studies",
  "changelog_entries",
]) {
  assert.doesNotMatch(
    migration.match(/operational_tables CONSTANT TEXT\[\] := ARRAY\[([\s\S]*?)\];/)?.[1] ?? "",
    new RegExp(`'${table}'`),
    `${table} must remain platform-global`,
  );
}

for (const invariant of [
  "CREATE TABLE IF NOT EXISTS public.tenants",
  "CREATE TABLE IF NOT EXISTS public.tenant_memberships",
  "CREATE TABLE IF NOT EXISTS public.tenant_ingest_keys",
  "CREATE TABLE IF NOT EXISTS public.platform_audit_log",
  "idx_contacts_tenant_primary_email_unique",
  "idx_companies_tenant_domain_unique",
  "idx_job_runs_tenant_claim_key",
  "FOREIGN KEY (tenant_id, %I)",
  "private.request_tenant_id()",
  "private.has_active_tenant_membership",
  'CREATE POLICY "Tenant member access"',
  "ALTER COLUMN tenant_id SET NOT NULL",
  "ON DELETE RESTRICT",
]) {
  assert.ok(migration.includes(invariant), `tenant migration is missing ${invariant}`);
}

assert.doesNotMatch(
  migration,
  /DROP TABLE|TRUNCATE|DELETE\s+FROM/i,
  "migration must not delete tenant or customer data",
);
assert.match(
  migration,
  /WHERE tenant_id IS NULL/,
  "backfill must only claim rows without ownership",
);
assert.match(migration, /ON CONFLICT \(id\) DO UPDATE/, "Accelerate bootstrap must be idempotent");
assert.match(
  setup,
  /20260830-shared-database-tenancy\.sql/,
  "setup order must include the tenant migration",
);
assert.match(
  setup,
  /20260830-shared-database-tenancy\.sql[\s\S]*20260830-tenant-context-authorization\.sql[\s\S]*20260830-revenue-recovery\.sql/,
  "authorization and recovery migrations must follow tenant control-plane setup",
);
assert.match(
  setup,
  /20260830-tenant-public-boundaries\.sql[\s\S]*20260830-tenant-uniqueness-cutover\.sql[\s\S]*20260830-revenue-recovery\.sql/,
  "tenant uniqueness must follow public boundary setup and precede recovery",
);
assert.match(
  setup,
  /20260831-tenant-lifecycle-rpcs\.sql[\s\S]*20260831-tenant-suspension-guards\.sql/,
  "suspension guards must follow tenant lifecycle RPC setup",
);

for (const invariant of [
  "private.authorized_request_tenant_id()",
  "tenant_id = requested_tenant",
  "GRANT EXECUTE ON FUNCTION public.claim_revenue_job_run",
  "GRANT EXECUTE ON FUNCTION public.claim_campaign_member_send",
  "GRANT EXECUTE ON FUNCTION public.stop_campaign_memberships",
  "GRANT EXECUTE ON FUNCTION public.claim_contact_import_batch",
  "GRANT EXECUTE ON FUNCTION public.publish_email_template",
]) {
  assert.ok(
    authorizationMigration.includes(invariant),
    `tenant authorization migration is missing ${invariant}`,
  );
}

for (const invariant of [
  "idx_campaign_members_tenant_campaign_email",
  "idx_messages_tenant_external_unique",
  "DROP INDEX IF EXISTS public.idx_job_runs_claim_key",
  "PRIMARY KEY (tenant_id, template_key)",
  "PRIMARY KEY (tenant_id, key)",
])
  assert.ok(
    uniquenessMigration.includes(invariant),
    `tenant uniqueness cutover is missing ${invariant}`,
  );
assert.match(
  suspensionMigration,
  /tenant_status IS DISTINCT FROM 'active'/,
  "operational RPC authorization must reject stale contexts after suspension",
);
assert.doesNotMatch(
  suspensionMigration,
  /DELETE\s+FROM|TRUNCATE|DROP\s+TABLE/i,
  "suspension must preserve tenant data and receipts",
);
assert.match(
  contract,
  /Every operational row has a non-null `tenant_id`/,
  "architecture contract must declare non-null ownership",
);

for (const invariant of [
  "CREATE TABLE IF NOT EXISTS recovery_playbooks",
  "CREATE TABLE IF NOT EXISTS recovery_candidates",
  "CREATE TABLE IF NOT EXISTS recovery_outcomes",
  "FOREIGN KEY (tenant_id, campaign_id) REFERENCES campaigns(tenant_id, id)",
  "FOREIGN KEY (tenant_id, contact_id) REFERENCES contacts(tenant_id, id)",
  "FOREIGN KEY (tenant_id, candidate_id) REFERENCES recovery_candidates(tenant_id, id)",
  "FOREIGN KEY (tenant_id, opportunity_id) REFERENCES opportunities(tenant_id, id)",
  'CREATE POLICY "Tenant member access" ON recovery_playbooks',
  'CREATE POLICY "Tenant member access" ON recovery_candidates',
  'CREATE POLICY "Tenant member access" ON recovery_outcomes',
]) {
  assert.ok(
    recoveryMigration.includes(invariant),
    `recovery migration is missing tenant isolation invariant ${invariant}`,
  );
}

console.log(
  JSON.stringify(
    {
      result: "passed",
      tenantScopedTables: TENANT_SCOPED_TABLES.length,
      platformGlobalTables: 4,
      migration: "migrations/20260830-shared-database-tenancy.sql",
    },
    null,
    2,
  ),
);
