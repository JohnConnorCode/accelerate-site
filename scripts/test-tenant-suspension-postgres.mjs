import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

const root = mkdtempSync(join(tmpdir(), "accelerate-tenant-suspension-"));
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

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed`);
  return result.stdout;
}

const fixtureSql = String.raw`
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('provisioning','active','suspended','archived'))
);
CREATE TABLE public.operational_records (id UUID PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES public.tenants(id), value TEXT NOT NULL);
CREATE TABLE public.execution_receipts (id UUID PRIMARY KEY, tenant_id UUID NOT NULL REFERENCES public.tenants(id), status TEXT NOT NULL);
CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT current_setting('request.jwt.claim.role', true)
$$;
CREATE FUNCTION private.request_tenant_id() RETURNS UUID LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE raw_value TEXT;
BEGIN
  raw_value := current_setting('request.headers', true)::jsonb ->> 'x-tenant-id';
  RETURN raw_value::uuid;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;
CREATE FUNCTION private.has_active_tenant_membership(requested_tenant UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT current_setting('test.active_membership', true) = 'true'
$$;
INSERT INTO public.tenants (id, status) VALUES
  ('11111111-1111-4111-8111-111111111111', 'active'),
  ('22222222-2222-4222-8222-222222222222', 'suspended');
INSERT INTO public.operational_records VALUES ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'preserve me');
INSERT INTO public.execution_receipts VALUES ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'completed');
`;

const proofSql = String.raw`
SELECT set_config('request.headers', '{"x-tenant-id":"11111111-1111-4111-8111-111111111111"}', false);
SELECT set_config('request.jwt.claim.role', 'service_role', false);
SET ROLE service_role;
DO $$ BEGIN
  IF private.authorized_request_tenant_id() <> '11111111-1111-4111-8111-111111111111'::uuid THEN
    RAISE EXCEPTION 'active service context was rejected';
  END IF;
END $$;
RESET ROLE;

UPDATE public.tenants SET status = 'suspended' WHERE id = '11111111-1111-4111-8111-111111111111';
SET ROLE service_role;
DO $$ BEGIN
  BEGIN
    PERFORM private.authorized_request_tenant_id();
    RAISE EXCEPTION 'stale service context was accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'tenant execution is unavailable' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

DO $$ BEGIN
  IF (SELECT count(*) FROM public.operational_records WHERE tenant_id = '11111111-1111-4111-8111-111111111111') <> 1 THEN
    RAISE EXCEPTION 'suspension removed operational data';
  END IF;
  IF (SELECT count(*) FROM public.execution_receipts WHERE tenant_id = '11111111-1111-4111-8111-111111111111') <> 1 THEN
    RAISE EXCEPTION 'suspension removed execution receipts';
  END IF;
END $$;

UPDATE public.tenants SET status = 'active' WHERE id = '11111111-1111-4111-8111-111111111111';
SELECT set_config('request.jwt.claim.role', 'authenticated', false);
SELECT set_config('test.active_membership', 'true', false);
SET ROLE authenticated;
DO $$ BEGIN
  IF private.authorized_request_tenant_id() <> '11111111-1111-4111-8111-111111111111'::uuid THEN
    RAISE EXCEPTION 'active member context was rejected';
  END IF;
END $$;
RESET ROLE;

SELECT set_config('test.active_membership', 'false', false);
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM private.authorized_request_tenant_id();
    RAISE EXCEPTION 'inactive membership was accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'tenant access forbidden' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.role', 'service_role', false);
SELECT set_config('request.headers', '{}', false);
SET ROLE service_role;
DO $$ BEGIN
  BEGIN
    PERFORM private.authorized_request_tenant_id();
    RAISE EXCEPTION 'missing tenant context was accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'explicit tenant context is required' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

SELECT json_build_object('result', 'passed', 'active_service', true, 'stale_service_rejected', true, 'inactive_member_rejected', true);
`;

try {
  writeFileSync(fixture, fixtureSql);
  writeFileSync(proof, proofSql);
  const initdb = binary("initdb");
  const pgCtl = binary("pg_ctl");
  const psql = binary("psql");
  run(initdb, ["-A", "trust", "-U", "postgres", "-D", data]);
  try {
    run(pgCtl, ["-D", data, "-l", log, "-o", `-F -h 127.0.0.1 -k '' -p ${port}`, "-w", "start"]);
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : "PostgreSQL failed to start"}\n${readFileSync(log, "utf8").trim()}`,
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
  run(psql, [...args, "-f", "migrations/20260831-tenant-suspension-guards.sql"]);
  const output = run(psql, [...args, "-t", "-A", "-f", proof])
    .trim()
    .split("\n")
    .at(-1);
  console.log(output);
} finally {
  if (started)
    spawnSync(binary("pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"], { encoding: "utf8" });
  if (root.startsWith(join(tmpdir(), "accelerate-tenant-suspension-")))
    rmSync(root, { recursive: true, force: true });
}
