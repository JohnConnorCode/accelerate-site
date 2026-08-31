#!/usr/bin/env tsx

import { REVENUE_SCHEMA_CONSTRAINTS, REVENUE_SCHEMA_CONTRACT_VERSION, REVENUE_SCHEMA_FUNCTIONS, REVENUE_SCHEMA_INDEXES, REVENUE_SCHEMA_POLICIES, REVENUE_SCHEMA_TABLES, TENANT_SCOPED_TABLES, type RevenueSchemaStatus } from "../src/lib/revenue-os/schema-contract";
import { PROJECT_REF, runPsql } from "./lib/accelerate-database.mjs";

type Requirement = { kind: "table" | "column" | "constraint" | "index" | "function" | "policy"; label: string; sql: string; migration?: string };
type Failure = Pick<Requirement, "kind" | "label" | "migration"> & { detail: string };

const shouldRecord = process.argv.includes("--record");
const checkedAt = new Date().toISOString();
const tenantScopedTableSet = new Set<string>(TENANT_SCOPED_TABLES);
const migrationFor = (table: string, column?: string) => ["recovery_playbooks", "recovery_candidates", "recovery_outcomes"].includes(table)
  ? "migrations/20260830-revenue-recovery.sql"
  : column === "tenant_id" && tenantScopedTableSet.has(table)
    ? "migrations/20260830-shared-database-tenancy.sql"
  : table === "schema_verification_runs"
  ? "migrations/20260817-schema-verification.sql"
  : table === "ai_conversations" || table === "ai_messages" || table === "agent_runs"
    ? "migrations/20260824-ai-command-runtime.sql"
    : table === "agent_run_events"
      ? "migrations/20260816-revenue-os.sql"
  : table === "job_runs"
    ? "migrations/20260817-atomic-job-claims.sql"
    : table === "campaign_members"
      ? "migrations/20260817-atomic-campaign-member-claims.sql"
    : ["tenants", "tenant_memberships", "tenant_ingest_keys", "platform_audit_log"].includes(table)
      ? "migrations/20260830-shared-database-tenancy.sql"
      : "migrations/20260816-revenue-os.sql";
const migrationForIndex = (name: string) => name.includes("tenant")
  ? "migrations/20260830-shared-database-tenancy.sql"
  : name.includes("ai_") || name === "idx_agent_runs_conversation"
    ? "migrations/20260824-ai-command-runtime.sql"
    : "migrations/20260816-revenue-os.sql";
const migrationForPolicy = (table: string, name: string) => name === "Tenant member access" || ["tenants", "tenant_memberships"].includes(table)
  ? "migrations/20260830-shared-database-tenancy.sql"
  : migrationFor(table);
const requirements: Requirement[] = [
  ...REVENUE_SCHEMA_TABLES.flatMap(({ table, columns }) => [
    { kind: "table" as const, label: `public.${table}`, migration: migrationFor(table), sql: `SELECT to_regclass('public.${table}') IS NOT NULL` },
    ...columns.map((column) => ({ kind: "column" as const, label: `public.${table}.${column}`, migration: migrationFor(table, column), sql: `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}')` })),
  ]),
  ...REVENUE_SCHEMA_CONSTRAINTS.map(({ table, name }) => ({ kind: "constraint" as const, label: `public.${table}.${name}`, migration: migrationFor(table), sql: `SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}' AND conrelid = 'public.${table}'::regclass)` })),
  ...REVENUE_SCHEMA_INDEXES.map((name) => ({ kind: "index" as const, label: `public.${name}`, migration: migrationForIndex(name), sql: `SELECT to_regclass('public.${name}') IS NOT NULL` })),
  ...REVENUE_SCHEMA_FUNCTIONS.map((name) => ({ kind: "function" as const, label: name, migration: name.includes("authorized_request_tenant") ? "migrations/20260830-tenant-context-authorization.sql" : name.includes("tenant") ? "migrations/20260830-shared-database-tenancy.sql" : name.includes("stop_campaign") ? "migrations/20260830-tenant-context-authorization.sql" : name.includes("claim_campaign_member") ? "migrations/20260830-tenant-context-authorization.sql" : name.includes("claim_revenue_job") ? "migrations/20260830-tenant-context-authorization.sql" : "migrations/20260816-revenue-os.sql", sql: `SELECT to_regprocedure('${name}') IS NOT NULL` })),
  ...REVENUE_SCHEMA_POLICIES.map(({ table, name }) => ({ kind: "policy" as const, label: `public.${table}.${name}`, migration: migrationForPolicy(table, name), sql: `SELECT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = '${table}' AND policyname = '${name}')` })),
];

function execute(sql: string) {
  const result = runPsql(["-t", "-A", "--command", sql]);
  if ((result.error as { code?: string } | undefined)?.code === "ENOENT") throw new Error("psql is not installed or is not on PATH");
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || "database query failed").trim());
  return result.stdout.trim();
}

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function executeRequirements() {
  const rows = requirements.map((requirement) => `(${sqlLiteral(requirement.label)}, (${requirement.sql}))`);
  return JSON.parse(execute(`SELECT jsonb_object_agg(label, present) FROM (VALUES ${rows.join(",")}) AS contract_checks(label, present)`)) as Record<string, boolean>;
}

function record(status: RevenueSchemaStatus, failures: Failure[]) {
  if (!shouldRecord) return null;
  const summary = JSON.stringify({ checkedAt, requirements: requirements.length, passed: requirements.length - failures.length, failures });
  const contractVersion = sqlLiteral(REVENUE_SCHEMA_CONTRACT_VERSION);
  const verificationStatus = sqlLiteral(status);
  const verificationSummary = sqlLiteral(summary);
  const checkedBy = sqlLiteral(process.env.USER || "agent");
  const result = runPsql(["-t", "-A", "--command", `INSERT INTO public.schema_verification_runs (contract_version, status, summary, failure_code, failure_detail, checked_by) VALUES (${contractVersion}, ${verificationStatus}, ${verificationSummary}::jsonb, CASE WHEN ${verificationStatus} = 'success' THEN NULL ELSE ${verificationStatus} END, CASE WHEN ${verificationStatus} = 'success' THEN NULL ELSE 'Read-only schema contract verification found incompatible metadata.' END, ${checkedBy}) RETURNING id, checked_at;`]);
  if (result.status !== 0) throw new Error((result.stderr || "could not record schema verification").trim());
  return result.stdout.trim().split("\n")[0] || null;
}

let failures: Failure[] = [];
let status: RevenueSchemaStatus = "success";
let receipt: string | null = null;
try {
  execute("SELECT current_database() IS NOT NULL");
  const results = executeRequirements();
  for (const requirement of requirements) {
    if (results[requirement.label] !== true) {
      failures.push({ kind: requirement.kind, label: requirement.label, migration: requirement.migration, detail: "Expected metadata is absent." });
    }
  }
  status = failures.length === 0 ? "success" : failures.some((failure) => failure.kind === "table") ? "unapplied_migration" : "drift";
  receipt = record(status, failures);
} catch (error) {
  status = "connectivity_failure";
  failures = [{ kind: "table", label: "database connection", detail: error instanceof Error ? error.message : "Database connection failed." }];
}

console.log(JSON.stringify({ contractVersion: REVENUE_SCHEMA_CONTRACT_VERSION, project: PROJECT_REF, status, checkedAt, requirements: requirements.length, passed: requirements.length - failures.length, failures, receipt }, null, 2));
process.exit(status === "success" ? 0 : 1);
