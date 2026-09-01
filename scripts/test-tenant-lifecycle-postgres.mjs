import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

const root = mkdtempSync(join(tmpdir(), "accelerate-tenant-lifecycle-"));
const data = join(root, "data");
const fixture = join(root, "fixture.sql");
const proof = join(root, "proof.sql");
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

const fixtureSql = String.raw`
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT);
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
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
CREATE UNIQUE INDEX idx_tenant_memberships_email_open ON public.tenant_memberships (tenant_id, lower(invited_email)) WHERE status IN ('invited','active');
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
CREATE FUNCTION public.accelerate_default_tenant_id() RETURNS UUID LANGUAGE sql IMMUTABLE AS $$ SELECT 'acce1e8e-0000-4000-8000-000000000001'::uuid $$;
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-4111-8111-111111111111', 'founder@example.com'),
  ('22222222-2222-4222-8222-222222222222', 'client@example.com');
INSERT INTO public.tenants (id, slug, name, status, created_by) VALUES
  (public.accelerate_default_tenant_id(), 'accelerate', 'Accelerate', 'active', '11111111-1111-4111-8111-111111111111');
`;

const proofSql = String.raw`
SELECT public.platform_create_tenant('northline', 'Northline', '11111111-1111-4111-8111-111111111111', 'founder@example.com');
DO $$
DECLARE v_tenant_id UUID;
DECLARE member_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = 'northline';
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant was not created'; END IF;
  IF (SELECT count(*) FROM public.tenant_memberships WHERE tenant_memberships.tenant_id = v_tenant_id AND status = 'active') <> 1 THEN RAISE EXCEPTION 'founder membership missing'; END IF;
  IF (SELECT count(*) FROM public.platform_audit_log WHERE platform_audit_log.tenant_id = v_tenant_id AND action = 'tenant.created') <> 1 THEN RAISE EXCEPTION 'create audit missing'; END IF;

  PERFORM public.platform_upsert_tenant_membership(v_tenant_id, '22222222-2222-4222-8222-222222222222', 'client@example.com', 'invited', '11111111-1111-4111-8111-111111111111', 'founder@example.com');
  PERFORM public.platform_upsert_tenant_membership(v_tenant_id, '22222222-2222-4222-8222-222222222222', 'client@example.com', 'invited', '11111111-1111-4111-8111-111111111111', 'founder@example.com');
  IF (SELECT count(*) FROM public.tenant_memberships WHERE tenant_memberships.tenant_id = v_tenant_id AND user_id = '22222222-2222-4222-8222-222222222222') <> 1 THEN RAISE EXCEPTION 'membership replay duplicated access'; END IF;
  IF (SELECT count(*) FROM public.platform_audit_log WHERE platform_audit_log.tenant_id = v_tenant_id AND action = 'tenant.membership_invited') <> 1 THEN RAISE EXCEPTION 'membership replay duplicated audit'; END IF;

  PERFORM public.platform_set_tenant_status(v_tenant_id, 'suspended', '11111111-1111-4111-8111-111111111111', 'founder@example.com');
  BEGIN
    PERFORM public.platform_upsert_tenant_membership(v_tenant_id, '22222222-2222-4222-8222-222222222222', 'client@example.com', 'active', '11111111-1111-4111-8111-111111111111', 'founder@example.com');
    RAISE EXCEPTION 'suspended tenant accepted membership';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'suspended tenant accepted membership' THEN RAISE; END IF;
  END;

  PERFORM public.platform_set_tenant_status(v_tenant_id, 'active', '11111111-1111-4111-8111-111111111111', 'founder@example.com');
  SELECT id INTO member_id FROM public.tenant_memberships WHERE tenant_memberships.tenant_id = v_tenant_id AND user_id = '22222222-2222-4222-8222-222222222222';
  PERFORM public.platform_revoke_tenant_membership(member_id, '11111111-1111-4111-8111-111111111111', 'founder@example.com');
  PERFORM public.platform_revoke_tenant_membership(member_id, '11111111-1111-4111-8111-111111111111', 'founder@example.com');
  IF (SELECT count(*) FROM public.platform_audit_log WHERE target_id = member_id::text AND action = 'tenant.membership_revoked') <> 1 THEN RAISE EXCEPTION 'revocation replay duplicated audit'; END IF;

  PERFORM public.platform_set_tenant_status(v_tenant_id, 'archived', '11111111-1111-4111-8111-111111111111', 'founder@example.com');
  BEGIN
    PERFORM public.platform_set_tenant_status(v_tenant_id, 'active', '11111111-1111-4111-8111-111111111111', 'founder@example.com');
    RAISE EXCEPTION 'archived tenant was reactivated';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'archived tenant was reactivated' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.platform_set_tenant_status(public.accelerate_default_tenant_id(), 'suspended', '11111111-1111-4111-8111-111111111111', 'founder@example.com');
    RAISE EXCEPTION 'bootstrap tenant was suspended';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'bootstrap tenant was suspended' THEN RAISE; END IF;
  END;

  IF has_function_privilege('anon', 'public.platform_create_tenant(text,text,uuid,text)', 'EXECUTE') THEN RAISE EXCEPTION 'anon can execute platform lifecycle'; END IF;
  IF has_function_privilege('authenticated', 'public.platform_create_tenant(text,text,uuid,text)', 'EXECUTE') THEN RAISE EXCEPTION 'authenticated can execute platform lifecycle'; END IF;
  IF NOT has_function_privilege('service_role', 'public.platform_create_tenant(text,text,uuid,text)', 'EXECUTE') THEN RAISE EXCEPTION 'service role cannot execute platform lifecycle'; END IF;
END $$;
SELECT json_build_object(
  'result', 'passed',
  'tenants', (SELECT count(*) FROM public.tenants),
  'memberships', (SELECT count(*) FROM public.tenant_memberships),
  'audits', (SELECT count(*) FROM public.platform_audit_log)
);
`;

try {
  writeFileSync(fixture, fixtureSql);
  writeFileSync(proof, proofSql);
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
  run(psql, [...args, "-f", "migrations/20260831-tenant-lifecycle-rpcs.sql"]);
  const output = run(psql, [...args, "-t", "-A", "-f", proof])
    .trim()
    .split("\n")
    .at(-1);
  console.log(output);
} finally {
  if (started) spawnSync(pgCtl, ["-D", data, "-m", "fast", "-w", "stop"], { encoding: "utf8" });
  if (root.startsWith(join(tmpdir(), "accelerate-tenant-lifecycle-")))
    rmSync(root, { recursive: true, force: true });
}
