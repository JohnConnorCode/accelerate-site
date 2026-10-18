import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { createServer } from "node:net";

const root = mkdtempSync(join(tmpdir(), "accelerate-ai-spend-"));
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const value = server.address().port;
    server.close(() => resolve(value));
  });
});
const bin = (name) => (process.env.POSTGRES_BIN ? join(process.env.POSTGRES_BIN, name) : name);
const args = [
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
];
const run = (command, argv, input) => {
  const result = spawnSync(command, argv, { input, encoding: "utf8", timeout: 30000 });
  if (result.status !== 0)
    throw new Error(result.error?.message || result.stderr || result.stdout || `${command} failed`);
  return result.stdout.trim();
};
const sql = (input) => run(bin("psql"), args, input);
const asyncSql = (input) =>
  new Promise((resolve, reject) => {
    const child = spawn(bin("psql"), args, {
      env: { ...process.env, PGOPTIONS: "-c lock_timeout=10000 -c statement_timeout=20000" },
    });
    let out = "",
      error = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (error += chunk));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(error))));
    child.stdin.end(input);
  });

const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  actor = "33333333-3333-4333-8333-333333333333";
const prefix = (tenant = a, role = "service_role") =>
  `SET request.headers='{"x-tenant-id":"${tenant}"}'; SET request.jwt.claim.role='${role}'; SET ROLE ${role}; `;
const defaults = {
  enabled: true,
  recurringEnabled: false,
  dailyUsd: 1,
  monthlyUsd: 2,
  requestUsd: 0.6,
  dailyCalls: 2,
};
const save = (revision, policy = defaults, tenant = a) =>
  `SELECT public.save_workspace_ai_controls('${tenant}','${actor}','owner@example.test',${revision},'${JSON.stringify(policy)}');`;
const reserve = (id, cost = 0.6, recurring = false, tenant = a) =>
  `SELECT public.reserve_workspace_ai_call('${tenant}','00000000-0000-4000-8000-${String(id).padStart(12, "0")}','connectivity-check','provider/model',${cost},${recurring});`;
const denied = (input, pattern) => assert.throws(() => sql(input), pattern);
let started = false;
try {
  run(bin("initdb"), ["-A", "trust", "-U", "postgres", "-D", join(root, "data")]);
  run(bin("pg_ctl"), [
    "-D",
    join(root, "data"),
    "-l",
    join(root, "postgres.log"),
    "-o",
    `-F -h 127.0.0.1 -k '' -p ${port}`,
    "-w",
    "start",
  ]);
  started = true;
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA private; CREATE SCHEMA auth;
    CREATE TABLE public.tenants(id uuid PRIMARY KEY,status text);
    CREATE TABLE public.tenant_memberships(tenant_id uuid,user_id uuid,role text,status text);
    INSERT INTO public.tenants VALUES('${a}','active'),('${b}','active');
    INSERT INTO public.tenant_memberships VALUES('${a}','${actor}','admin','active');
    CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,actor_email text,action text,entity_type text,entity_id text,source text,after_state jsonb);
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
    CREATE FUNCTION private.request_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (current_setting('request.headers',true)::jsonb->>'x-tenant-id')::uuid $$;
    CREATE FUNCTION private.has_active_tenant_membership(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    GRANT USAGE ON SCHEMA auth,private TO service_role; GRANT SELECT ON public.tenants,public.tenant_memberships TO service_role; GRANT INSERT ON public.audit_log TO service_role;`);
  const context = readFileSync("migrations/20260830-tenant-context-authorization.sql", "utf8");
  sql(
    context.slice(
      context.indexOf("CREATE OR REPLACE FUNCTION private.authorized_request_tenant_id()"),
      context.indexOf("DROP FUNCTION IF EXISTS public.claim_revenue_job_run"),
    ),
  );
  const migration = readFileSync(
    "migrations/20261018173749_workspace_ai_spend_controls.sql",
    "utf8",
  );
  sql(migration);
  sql(migration);
  denied(prefix() + reserve(1), /paused/);
  denied(prefix(a, "authenticated") + save(0), /permission denied/);
  denied(prefix(b) + save(0, defaults, a), /administrator required/);
  denied(prefix() + save(0, { ...defaults, monthlyUsd: -1 }), /check constraint/);
  assert.equal(sql("SELECT count(*) FROM public.workspace_ai_controls"), "0");
  sql(prefix() + save(0));
  denied(prefix() + save(0), /changed/);
  denied(prefix() + reserve(1, 0.01, true), /Recurring AI work is paused/);
  denied(prefix() + reserve(1, 0.61), /budget reached/);
  denied(prefix() + reserve(1, "'NaN'"), /Invalid AI reservation/);
  const concurrent = await Promise.allSettled([
    asyncSql(prefix() + reserve(1)),
    asyncSql(prefix() + reserve(2)),
  ]);
  assert.equal(
    concurrent.filter((result) => result.status === "fulfilled").length,
    1,
    "Concurrent requests cannot both consume the final budget",
  );
  const savedId = sql("SELECT id FROM public.workspace_ai_reservations LIMIT 1");
  denied(
    prefix() +
      `SELECT public.reserve_workspace_ai_call('${a}','${savedId}','connectivity-check','provider/model',0.1,false);`,
    /already reserved/,
  );
  assert.equal(sql("SELECT count(*) FROM public.workspace_ai_reservations"), "1");
  sql(prefix() + reserve(3, 0.4));
  denied(prefix() + reserve(4, 0), /budget reached/);
  sql(prefix() + `SELECT public.finish_workspace_ai_call('${a}','${savedId}',0.01,'gen-test');`);
  assert.equal(
    JSON.parse(sql(prefix() + `SELECT public.read_workspace_ai_usage('${a}');`)).usage
      .dailyReservedUsd,
    0.41,
    "Final provider costs release only the unused part of that request reservation",
  );
  sql(prefix() + save(1, { ...defaults, dailyUsd: 10, monthlyUsd: 0.5, dailyCalls: 100 }));
  denied(prefix() + reserve(4, 0.1), /budget reached/);
  sql(prefix() + save(2, { ...defaults, recurringEnabled: true, dailyCalls: 10 }));
  sql(prefix() + reserve(10, 0.01, true));
  sql(prefix() + `SELECT public.finish_workspace_ai_call('${a}','${savedId}',0.9,'gen-changed');`);
  assert.equal(
    sql(`SELECT actual_usd FROM public.workspace_ai_reservations WHERE id='${savedId}'`),
    "0.01",
    "A duplicate final receipt cannot change the recorded charge",
  );
  sql(prefix() + save(3, { ...defaults, enabled: false }));
  denied(prefix() + reserve(5, 0), /paused/);
  sql(
    `CREATE FUNCTION reject_ai_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled audit failure'; END $$; CREATE TRIGGER reject_audit BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION reject_ai_audit();`,
  );
  denied(
    prefix() + save(4, { ...defaults, enabled: true, recurringEnabled: true }),
    /controlled audit failure/,
  );
  assert.equal(
    sql(`SELECT enabled||':'||revision FROM public.workspace_ai_controls WHERE tenant_id='${a}'`),
    "false:4",
  );
  sql("DROP TRIGGER reject_audit ON public.audit_log");
  sql(`UPDATE public.tenant_memberships SET status='revoked' WHERE tenant_id='${a}';`);
  denied(prefix() + save(4), /administrator required/);
  sql(`UPDATE public.tenants SET status='suspended' WHERE id='${a}';`);
  denied(prefix() + reserve(5, 0), /context required/);
  console.log(
    "PASS: AI defaults off, tenant/admin denial, revision conflicts, finite caps, concurrent admission, recurring pause, exact replay refusal, held uncertainty, audit rollback and revoked access",
  );
} finally {
  if (started) run(bin("pg_ctl"), ["-D", join(root, "data"), "-m", "fast", "-w", "stop"]);
  rmSync(root, { recursive: true, force: true });
}
