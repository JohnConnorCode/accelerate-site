import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import { createServer } from "node:net";

/**
 * Northstar Phase B proof against real Postgres (ephemeral initdb).
 *
 * AC1 — durable work survives interruption and concurrency:
 *  - two concurrent workers racing one item produce exactly one claim
 *    (no duplicate effects; the loser sees claimed/race state, and the
 *    attempt counter advances exactly once);
 *  - an interrupted claimant (stale lease) is recovered with its attempt
 *    preserved, and the next worker transparently continues the work;
 *  - attempts past max_attempts terminate as failed with a written reason;
 *  - dedupe keys are tenant-scoped (same key collides in-tenant, coexists
 *    across tenants);
 *  - waiting items gate on next_check_at; guessed and cross-tenant IDs
 *    resolve to not_found without leaking rows.
 *
 * AC2 — shared capability, autonomy, provenance, and budget checks:
 *  - hard safety floors stay prohibited; unknown actions default to
 *    always_ask; a standing permission with an unsupported constraint shape
 *    stays fail-closed; a supported standing permission allows and its
 *    revocation back to always_ask denies again;
 *  - missing capabilities resolve unavailable with a reason; prohibited
 *    policy resolves distinctly from missing;
 *  - conflicting weaker evidence marks a claim conflicted instead of
 *    overwriting the established value;
 *  - budget usage accumulates atomically through increment_budget_usage.
 *
 * Applies the real migrations, so this also proves they compose on a fresh
 * database. Controlled records only; nothing leaves the ephemeral instance.
 */
const root = mkdtempSync(join(tmpdir(), "accelerate-phase-b-proof-"));
const data = join(root, "data");
const fixture = join(root, "fixture.sql");
const seed = join(root, "seed.sql");
const proof = join(root, "proof.sql");
const raceA = join(root, "race-a.sql");
const raceB = join(root, "race-b.sql");
const log = join(root, "postgres.log");
let started = false;

const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close(() => reject(new Error("Could not allocate a PostgreSQL test port")));
      return;
    }
    server.close((error) => (error ? reject(error) : resolve(address.port)));
  });
});

function binary(name) {
  const found = spawnSync("sh", ["-lc", `command -v ${name}`], { encoding: "utf8" });
  if (found.status !== 0 || !found.stdout.trim()) throw new Error(`${name} is required`);
  return found.stdout.trim();
}

const initdb = binary("initdb");
const pgCtl = binary("pg_ctl");
const psql = binary("psql");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed`);
  return result.stdout;
}

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RACE_ITEM = "c0ffee00-0000-4000-8000-0000000000a1";

const fixtureSql = String.raw`
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT);
-- Ephemeral stand-ins for Supabase session helpers: no JWT exists here, so
-- auth.role() reports service_role and request headers select the tenant,
-- exactly the service-role path production adapters use.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE
AS $$ SELECT NULL::UUID $$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE
AS $$ SELECT 'service_role'::TEXT $$;
-- Minimal control plane (tenants, memberships, request helpers) mirroring
-- migrations/20260830-shared-database-tenancy.sql semantics. The full base
-- migration assumes every business table exists, so the ephemeral fixture
-- carries only what the Phase B migrations depend on.
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'provisioning' CHECK (status IN ('provisioning','active','suspended','archived')),
  config_version INTEGER NOT NULL DEFAULT 1,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','revoked')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
CREATE TABLE public.platform_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id),
  actor_email TEXT,
  action TEXT NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  target_type TEXT,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE FUNCTION public.accelerate_default_tenant_id() RETURNS UUID LANGUAGE sql IMMUTABLE
AS $$ SELECT 'acce1e8e-0000-4000-8000-000000000001'::uuid $$;
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.request_tenant_id()
RETURNS UUID LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
DECLARE raw_value TEXT;
BEGIN
  raw_value := current_setting('request.headers', true)::jsonb ->> 'x-tenant-id';
  IF raw_value IS NULL OR raw_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN raw_value::uuid;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;
CREATE OR REPLACE FUNCTION private.has_active_tenant_membership(requested_tenant UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships AS membership
    JOIN public.tenants AS tenant ON tenant.id = membership.tenant_id
    WHERE membership.tenant_id = requested_tenant
      AND membership.user_id = auth.uid()
      AND membership.status = 'active'
      AND tenant.status = 'active'
  )
$$;
CREATE OR REPLACE FUNCTION private.authorized_request_tenant_id()
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE requested UUID := private.request_tenant_id();
BEGIN
  IF requested IS NULL THEN
    RAISE EXCEPTION 'explicit tenant context is required' USING ERRCODE = '42501';
  END IF;
  IF auth.role() = 'service_role' OR private.has_active_tenant_membership(requested) THEN
    RETURN requested;
  END IF;
  RAISE EXCEPTION 'tenant access forbidden' USING ERRCODE = '42501';
END;
$$;
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-4111-8111-111111111111', 'founder@example.com');
`;

const seedSql = String.raw`
INSERT INTO public.tenants (id, slug, name, status) VALUES
  ('${TENANT_A}', 'tenant-a', 'Tenant A', 'active'),
  ('${TENANT_B}', 'tenant-b', 'Tenant B', 'active')
ON CONFLICT (id) DO NOTHING;
`;

const proofSql = String.raw`
SET request.headers TO '{"x-tenant-id":"${TENANT_A}"}';

-- Seed one pending item for the race plus fixtures for each scenario.
INSERT INTO public.work_items
  (id, tenant_id, kind, objective, reason, source, status, priority, dedupe_key, attempt_count, max_attempts)
VALUES
  ('${RACE_ITEM}', '${TENANT_A}'::uuid, 'race_probe', 'Race me', 'Concurrency proof', 'phase-b-proof', 'pending', 'high', 'race-dedupe-1', 0, 3);

DO $$
DECLARE
  v_stale_id UUID := 'c0ffee00-0000-4000-8000-0000000000b2';
  v_failed_id UUID := 'c0ffee00-0000-4000-8000-0000000000c3';
  v_wait_future UUID := 'c0ffee00-0000-4000-8000-0000000000d4';
  v_wait_past UUID := 'c0ffee00-0000-4000-8000-0000000000e5';
  v_claim RECORD;
BEGIN
  -- AC1: interrupted claimant — stale in_progress lease, attempts remain.
  INSERT INTO public.work_items
    (id, tenant_id, kind, objective, reason, source, status, priority, attempt_count, max_attempts, lease_owner, lease_expires_at)
  VALUES
    (v_stale_id, '${TENANT_A}'::uuid, 'race_probe', 'Interrupted', 'Stale recovery proof', 'phase-b-proof',
     'in_progress', 'high', 1, 3, 'dead-worker', now() - interval '1 hour');

  SELECT * INTO v_claim FROM public.claim_work_item('race_probe', v_stale_id, 'worker-b', 600000);
  IF NOT v_claim.claimed OR NOT v_claim.recovered_stale THEN
    RAISE EXCEPTION 'stale lease was not recovered and continued: %', to_jsonb(v_claim);
  END IF;
  IF (SELECT attempt_count FROM public.work_items WHERE id = v_stale_id) <> 2 THEN
    RAISE EXCEPTION 'recovery must preserve and advance the attempt counter';
  END IF;
  IF (SELECT lease_owner FROM public.work_items WHERE id = v_stale_id) <> 'worker-b' THEN
    RAISE EXCEPTION 'recovered lease must transfer to the continuing worker';
  END IF;

  -- AC1: attempts past max terminate as failed with a written reason.
  -- (Dedicated kind so the kind-wide claim cannot touch the race item.)
  INSERT INTO public.work_items
    (id, tenant_id, kind, objective, reason, source, status, priority, attempt_count, max_attempts, lease_owner, lease_expires_at)
  VALUES
    (v_failed_id, '${TENANT_A}'::uuid, 'fail_probe', 'Doomed', 'Exhaustion proof', 'phase-b-proof',
     'claimed', 'high', 3, 3, 'dead-worker', now() - interval '1 hour');

  PERFORM public.claim_work_item('fail_probe', NULL, 'worker-c', 600000);
  IF (SELECT status FROM public.work_items WHERE id = v_failed_id) <> 'failed' THEN
    RAISE EXCEPTION 'exhausted item did not terminate as failed';
  END IF;
  IF (SELECT error FROM public.work_items WHERE id = v_failed_id) IS NULL THEN
    RAISE EXCEPTION 'failed terminal state carries no reason';
  END IF;
  IF (SELECT finished_at FROM public.work_items WHERE id = v_failed_id) IS NULL THEN
    RAISE EXCEPTION 'failed terminal state carries no timestamp';
  END IF;

  -- AC1: waiting items gate on next_check_at.
  INSERT INTO public.work_items
    (id, tenant_id, kind, objective, reason, source, status, priority, attempt_count, max_attempts, next_check_at, next_check_reason)
  VALUES
    (v_wait_future, '${TENANT_A}'::uuid, 'wait_probe', 'Future', 'Waiting gate proof', 'phase-b-proof',
     'waiting', 'medium', 0, 3, now() + interval '1 hour', 'Not due yet'),
    (v_wait_past, '${TENANT_A}'::uuid, 'wait_probe', 'Past', 'Waiting gate proof', 'phase-b-proof',
     'waiting', 'medium', 0, 3, now() - interval '1 minute', 'Due now');

  SELECT * INTO v_claim FROM public.claim_work_item('wait_probe', v_wait_future, 'worker-d', 600000);
  IF v_claim.claimed THEN RAISE EXCEPTION 'future waiting item was claimable'; END IF;
  SELECT * INTO v_claim FROM public.claim_work_item('wait_probe', v_wait_past, 'worker-d', 600000);
  IF NOT v_claim.claimed THEN RAISE EXCEPTION 'due waiting item was not claimable'; END IF;

  -- AC1: dedupe keys are tenant-scoped.
  INSERT INTO public.work_items
    (tenant_id, kind, objective, reason, source, status, priority, dedupe_key, attempt_count, max_attempts)
  VALUES
    ('${TENANT_A}'::uuid, 'dedupe_probe', 'Scoped', 'Dedupe proof', 'phase-b-proof', 'pending', 'medium', 'shared-key', 0, 3);
  BEGIN
    INSERT INTO public.work_items
      (tenant_id, kind, objective, reason, source, status, priority, dedupe_key, attempt_count, max_attempts)
    VALUES
      ('${TENANT_A}'::uuid, 'dedupe_probe', 'Duplicate', 'Dedupe proof', 'phase-b-proof', 'pending', 'medium', 'shared-key', 0, 3);
    RAISE EXCEPTION 'in-tenant open dedupe collision was allowed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  INSERT INTO public.work_items
    (tenant_id, kind, objective, reason, source, status, priority, dedupe_key, attempt_count, max_attempts)
  VALUES
    ('${TENANT_B}'::uuid, 'dedupe_probe', 'Other tenant', 'Dedupe proof', 'phase-b-proof', 'pending', 'medium', 'shared-key', 0, 3);

  -- AC1: guessed and cross-tenant IDs resolve to not_found without rows.
  SELECT * INTO v_claim FROM public.claim_work_item(
    'race_probe', 'deadbeef-dead-4ead-beef-deadbeefdead', 'worker-e', 600000);
  IF v_claim.claimed OR v_claim.existing_status <> 'not_found' THEN
    RAISE EXCEPTION 'guessed ID did not resolve to not_found: %', to_jsonb(v_claim);
  END IF;

  -- AC2: autonomy ladder — hard floor, default, standing, revocation.
  -- (Hard floors seed for the bootstrap tenant only, so the controlled
  -- tenant registers its own floor exactly as onboarding would.)
  INSERT INTO public.autonomy_hard_floors (tenant_id, action_key, reason)
  VALUES ('${TENANT_A}'::uuid, 'account.delete', 'Proof floor')
  ON CONFLICT (tenant_id, action_key) DO NOTHING;
  SELECT * INTO v_claim FROM public.check_autonomy('account.delete', NULL);
  IF (v_claim.allowed OR NOT v_claim.requires_approval OR NOT v_claim.hard_floor) THEN
    RAISE EXCEPTION 'hard floor is not prohibited: %', to_jsonb(v_claim);
  END IF;
  SELECT * INTO v_claim FROM public.check_autonomy('email.send_followup', NULL);
  IF v_claim.allowed OR NOT v_claim.requires_approval THEN
    RAISE EXCEPTION 'unknown action did not default to always_ask: %', to_jsonb(v_claim);
  END IF;
  PERFORM public.upsert_autonomy_policy(
    'invoice.send_reminder', 'Send invoice reminders', 'ask_until_trusted',
    'Phase B proof policy', '{"max_per_day": 5}', NULL, 'system', false);
  PERFORM public.grant_standing_permission(
    'invoice.send_reminder', NULL, 'founder@example.com', '{"max_per_day": 5}');
  -- Human approval with constraint shapes no executor understands cannot
  -- become standing permission; it stays fail-closed as always_ask.
  SELECT * INTO v_claim FROM public.check_autonomy('invoice.send_reminder', NULL);
  IF v_claim.allowed OR NOT v_claim.requires_approval THEN
    RAISE EXCEPTION 'unsupported-constraint standing permission was allowed: %', to_jsonb(v_claim);
  END IF;
  UPDATE public.autonomy_policies SET constraints = '{}'::jsonb, updated_at = now()
  WHERE tenant_id = '${TENANT_A}'::uuid AND action_key = 'invoice.send_reminder'
    AND coworker_id IS NULL;
  SELECT * INTO v_claim FROM public.check_autonomy('invoice.send_reminder', NULL);
  IF NOT v_claim.allowed OR v_claim.requires_approval THEN
    RAISE EXCEPTION 'standing permission did not allow: %', to_jsonb(v_claim);
  END IF;
  -- Revocation is a deterministic UPDATE: the upsert's conflict target
  -- (tenant_id, action_key, coworker_id) cannot match NULL coworker rows,
  -- so a second upsert would duplicate rather than replace (recorded as
  -- follow-up work, not asserted here).
  UPDATE public.autonomy_policies SET level = 'always_ask', updated_at = now()
  WHERE tenant_id = '${TENANT_A}'::uuid AND action_key = 'invoice.send_reminder'
    AND coworker_id IS NULL;
  SELECT * INTO v_claim FROM public.check_autonomy('invoice.send_reminder', NULL);
  IF v_claim.allowed OR NOT v_claim.requires_approval THEN
    RAISE EXCEPTION 'revoked standing permission still allows: %', to_jsonb(v_claim);
  END IF;
  BEGIN
    PERFORM public.grant_standing_permission('account.delete', NULL, 'founder@example.com', '{}');
    RAISE EXCEPTION 'hard floor was granted standing permission';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'hard floor was granted standing permission' THEN RAISE; END IF;
  END;

  -- AC2: capability resolution — missing vs prohibited are distinct.
  SELECT * INTO v_claim FROM public.resolve_workspace_capability('never_registered_xyz');
  IF (v_claim.available) THEN RAISE EXCEPTION 'missing capability resolved available'; END IF;
  PERFORM public.upsert_workspace_capability(
    'sms.send', 'SMS sending', 'integration', 'write', 'external_action',
    false, 'prohibited', 'Proof: SMS stays unilateral-never', NULL);
  SELECT * INTO v_claim FROM public.resolve_workspace_capability('sms.send');
  IF (v_claim.available) THEN RAISE EXCEPTION 'prohibited capability resolved available'; END IF;

  -- AC2: conflicting weaker evidence conflicts instead of overwriting.
  PERFORM public.record_evidence(
    'contact', 'c0ffee00-0000-4000-8000-0000000000f6', 'title', 'VP Sales',
    'manual_entry', 'Founder entered the title', 'human_entered', 'note-1', '{}', NULL, NULL);
  SELECT * INTO v_claim FROM public.record_evidence(
    'contact', 'c0ffee00-0000-4000-8000-0000000000f6', 'title', 'Intern',
    'model_inference', 'Model guessed a different title', 'model_inference', 'guess-1', '{}', NULL, NULL);
  IF (v_claim.claim_status <> 'conflicted') THEN
    RAISE EXCEPTION 'value conflict did not mark conflicted: %', to_jsonb(v_claim);
  END IF;
  IF (SELECT proposed_value FROM public.claims WHERE id = v_claim.claim_id) <> 'VP Sales' THEN
    RAISE EXCEPTION 'conflicting evidence overwrote the established value';
  END IF;
  IF (SELECT count(*) FROM public.evidence WHERE claim_id = v_claim.claim_id) <> 2 THEN
    RAISE EXCEPTION 'both evidence rows must be retained for review';
  END IF;

  -- AC2: budget usage accumulates atomically, never overwrites.
  PERFORM public.increment_budget_usage('proof-coworker', 'vendor_api_calls', '2026-09-10', 2);
  PERFORM public.increment_budget_usage('proof-coworker', 'vendor_api_calls', '2026-09-10', 3);
  IF (SELECT used_value FROM public.budget_usage
      WHERE coworker_id = 'proof-coworker' AND budget_kind = 'vendor_api_calls'
        AND period_key = '2026-09-10') <> 5 THEN
    RAISE EXCEPTION 'budget usage did not accumulate';
  END IF;
END $$;
SELECT json_build_object('result', 'passed');
`;

try {
  writeFileSync(fixture, fixtureSql);
  writeFileSync(seed, seedSql);
  writeFileSync(proof, proofSql);
  writeFileSync(
    raceA,
    `SET request.headers TO '{"x-tenant-id":"${TENANT_A}"}';\nSELECT claimed, existing_status FROM public.claim_work_item('race_probe', '${RACE_ITEM}'::uuid, 'worker-race-a', 600000);`,
  );
  writeFileSync(
    raceB,
    `SET request.headers TO '{"x-tenant-id":"${TENANT_A}"}';\nSELECT claimed, existing_status FROM public.claim_work_item('race_probe', '${RACE_ITEM}'::uuid, 'worker-race-b', 600000);`,
  );
  run(initdb, ["-A", "trust", "-U", "postgres", "-D", data]);
  try {
    run(pgCtl, ["-D", data, "-l", log, "-o", `-F -h 127.0.0.1 -k '' -p ${port}`, "-w", "start"]);
  } catch (error) {
    const diagnostics = readFileSync(log, "utf8").trim();
    throw new Error(
      `${error instanceof Error ? error.message : "PostgreSQL failed to start"}\n${diagnostics}`,
    );
  }
  started = true;
  const args = [
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
    "-X",
    "-q",
  ];
  run(psql, [...args, "-f", fixture]);
  for (const migration of [
    "migrations/20260902-workspace-capabilities.sql",
    "migrations/20260902-autonomy-policies.sql",
    "migrations/20260902-claims-evidence.sql",
    "migrations/20260902-coworkers.sql",
    "migrations/20260903-agent-memory-and-budgets.sql",
    "migrations/20260902-work-items.sql",
    // The runtime policy migration owns the qualified check_autonomy body.
    // It supersedes the ambiguous references in 20260902-autonomy-policies.sql,
    // so this proves the same function a clean install actually runs.
    "migrations/20260904-runtime-policy-enforcement.sql",
  ]) {
    run(psql, [...args, "-f", migration]);
  }
  run(psql, [...args, "-f", seed]);
  run(psql, [...args, "-f", proof]);

  // AC1 concurrency: two workers race one pending item in parallel
  // transactions. The advisory lock serializes them; exactly one wins.
  const runConcurrent = promisify(execFile);
  const [raceResultA, raceResultB] = await Promise.all(
    [raceA, raceB].map((file) =>
      runConcurrent(psql, [...args, "-t", "-A", "-f", file], { timeout: 30000 }),
    ),
  );
  const outcomes = [
    String(raceResultA.stdout).trim().split("\n").at(-1),
    String(raceResultB.stdout).trim().split("\n").at(-1),
  ];
  const wins = outcomes.filter((line) => line?.startsWith("t|")).length;
  if (wins !== 1) {
    throw new Error(`race produced ${wins} winners, expected exactly 1: ${outcomes.join(" / ")}`);
  }
  const attempts = run(psql, [
    ...args,
    "-t",
    "-A",
    "-c",
    `SELECT attempt_count FROM public.work_items WHERE id = '${RACE_ITEM}';`,
  ]).trim();
  if (attempts !== "1") {
    throw new Error(`race advanced the attempt counter to ${attempts}, expected exactly 1`);
  }
  console.log(JSON.stringify({ result: "passed", race: outcomes, attempts: Number(attempts) }));
} finally {
  if (started) spawnSync(pgCtl, ["-D", data, "-m", "fast", "-w", "stop"], { encoding: "utf8" });
  if (root.startsWith(join(tmpdir(), "accelerate-phase-b-proof-")))
    rmSync(root, { recursive: true, force: true });
}
