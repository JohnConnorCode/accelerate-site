import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { createServer } from "node:net";
const root = mkdtempSync(join(tmpdir(), "source-authority-pg-"));
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    server.close(() => resolve(port));
  });
});
const run = (cmd, args, input) => {
  const r = spawnSync(cmd, args, {
    input,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || `${cmd} failed`);
  return r.stdout.trim();
};
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
const sql = (text) => run("psql", args, text);
const processes = new Set();
function asyncSql(text) {
  const child = spawn("psql", args, { stdio: ["pipe", "pipe", "pipe"] });
  processes.add(child);
  let stdout = "",
    stderr = "";
  child.stdout.on("data", (x) => {
    stdout += x;
  });
  child.stderr.on("data", (x) => {
    stderr += x;
  });
  const result = new Promise((resolve) =>
    child.on("close", (code) => {
      processes.delete(child);
      resolve({ code, stdout: stdout.trim(), stderr });
    }),
  );
  child.stdin.end(text);
  return { child, result };
}
async function waitUntil(check) {
  const end = Date.now() + 15_000;
  while (!check()) {
    assert.ok(Date.now() < end, "PostgreSQL concurrency barrier timed out");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  member = "33333333-3333-4333-8333-333333333333";
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const base = {
  systemKey: "canonical_crm",
  displayName: "Canonical CRM",
  truthDomains: ["contact_identity"],
  authorityTier: "official",
  ownerEmail: "owner@example.test",
  lastVerifiedAt: "2026-01-01T00:00:00.000Z",
  verificationLapseDays: 90,
  appliesTo: null,
  expectedVersion: 0,
};
const command = (payload, key, actor = a) =>
  `SELECT register_source_authority(${quote(JSON.stringify(payload))}::jsonb,${quote(key)},${quote(actor)}::uuid,'owner@example.test');`;
const prefix = (tenant = a, role = "service_role", actor = a) =>
  `SET ROLE ${role}; SET app.role='${role}'; SET app.tenant='${tenant}'; SET app.actor='${actor}'; `;
const invoke = (payload, key, tenant = a, actor = a) =>
  JSON.parse(sql(prefix(tenant) + command(payload, key, actor)));
const old = readFileSync("migrations/20260925-source-authority-registry.sql", "utf8");
const migration = readFileSync(
  "migrations/20261008230447_source_authority_atomic_receipts.sql",
  "utf8",
);
let started = false;
const checks = [];
try {
  const version = run("initdb", ["--version"]);
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
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA private; CREATE SCHEMA auth;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('app.role',true) $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.actor',true),'')::uuid $$;
CREATE FUNCTION private.request_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.tenant',true),'')::uuid $$;
CREATE TABLE tenants(id uuid PRIMARY KEY,status text);
CREATE TABLE tenant_memberships(tenant_id uuid,user_id uuid,role text,status text,PRIMARY KEY(tenant_id,user_id));
CREATE FUNCTION public.accelerate_default_tenant_id() RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT '${a}'::uuid $$;
CREATE FUNCTION private.has_active_tenant_membership(t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.tenant_id=t AND m.user_id=auth.uid() AND m.status='active') $$;
CREATE TABLE audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,actor_email text,action text,entity_type text,entity_id text,source text,before_state jsonb,after_state jsonb,metadata jsonb);
GRANT USAGE ON SCHEMA auth,private TO anon,authenticated,service_role;
GRANT SELECT ON tenants,tenant_memberships TO authenticated,service_role;
INSERT INTO tenants VALUES('${a}','active'),('${b}','active');
INSERT INTO tenant_memberships VALUES('${a}','${a}','admin','active'),('${b}','${b}','admin','active'),('${a}','${member}','member','active');`);
  sql(readFileSync("migrations/20260831-tenant-suspension-guards.sql", "utf8"));
  sql(old);
  sql(migration);
  sql(migration);
  assert.equal(sql("SELECT count(*) FROM source_authority_registry"), "0");
  checks.push("fresh migration and repeat");
  // A preexisting row has no trustworthy request receipt; preserve it, then
  // require explicit reverification rather than manufacture historical audit.
  sql(
    `INSERT INTO source_authority_registry(tenant_id,system_key,display_name,truth_domains,authority_tier,owner_email,last_verified_at,request_key) VALUES('${b}','legacy','Legacy',ARRAY['history'],'low','owner@example.test',now(),'legacy-key');`,
  );
  sql(old);
  sql(migration);
  assert.equal(
    sql("SELECT count(*) FROM source_authority_registry WHERE system_key='legacy' AND version=0"),
    "1",
  );
  assert.throws(
    () => invoke({ ...base, systemKey: "legacy" }, "legacy-key", b, b),
    /Legacy source request/,
  );
  checks.push("populated historical replay and legacy receipt refusal");
  const first = invoke(base, "first");
  assert.equal(first.entry.version, 1);
  assert.equal(first.replayed, false);
  assert.equal(
    sql(
      `SELECT count(*) FROM source_authority_receipts r JOIN audit_log a ON a.id=r.audit_id AND a.tenant_id=r.tenant_id WHERE r.request_key='first' AND a.metadata->>'request_key'='first' AND a.after_state=r.receipt->'entry';`,
    ),
    "1",
  );
  checks.push("atomic registry, exact audit and receipt");
  const updated = invoke({ ...base, authorityTier: "approved", expectedVersion: 1 }, "second");
  const replay = invoke(base, "first");
  assert.deepEqual(replay, { ...first, replayed: true });
  assert.equal(updated.entry.version, 2);
  assert.equal(
    sql(`SELECT authority_tier FROM source_authority_registry WHERE tenant_id='${a}'`),
    "approved",
  );
  checks.push("immutable replay after later update");
  assert.throws(() => invoke({ ...base, displayName: "Changed" }, "first"), /request key reused/);
  assert.throws(() => invoke({ ...base, systemKey: "different" }, "first"), /request key reused/);
  assert.throws(() => invoke(base, "stale-version"), /version changed/);
  checks.push("request collision and optimistic version refusal");
  for (const invalid of [
    null,
    { ...base, authorityTier: "unknown" },
    { ...base, truthDomains: [5] },
    { ...base, lastVerifiedAt: "infinity" },
    { ...base, appliesTo: { entityTypes: "contact" } },
    { ...base, tenantId: b },
  ])
    assert.throws(() => sql(prefix() + command(invalid, "invalid")), /Invalid/);
  checks.push("SQL rejects malformed and forged command fields");
  sql(
    `CREATE FUNCTION fail_source_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.metadata->>'request_key' IN ('fail-insert','fail-update') THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_source_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_source_audit();`,
  );
  assert.throws(
    () => invoke({ ...base, systemKey: "new_source" }, "fail-insert"),
    /injected audit/,
  );
  assert.throws(() => invoke({ ...base, expectedVersion: 2 }, "fail-update"), /injected audit/);
  assert.equal(
    sql(`SELECT count(*) FROM source_authority_registry WHERE system_key='new_source'`),
    "0",
  );
  assert.equal(
    sql(
      `SELECT version FROM source_authority_registry WHERE tenant_id='${a}' AND system_key='canonical_crm'`,
    ),
    "2",
  );
  assert.equal(
    sql(`SELECT count(*) FROM source_authority_receipts WHERE request_key LIKE 'fail-%'`),
    "0",
  );
  sql("DROP TRIGGER fail_source_audit ON audit_log;");
  assert.equal(invoke({ ...base, expectedVersion: 2 }, "fail-update").entry.version, 3);
  checks.push("forced audit failure rolls back insert and update; identical retry succeeds");
  // Two sessions prove the successful writer waits for the failed transaction
  // and survives rollback. No sleeps guess a race; native lock state is the gate.
  sql(
    `CREATE FUNCTION source_race_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.metadata->>'request_key'='race-failed' THEN PERFORM pg_advisory_xact_lock(842001); RAISE EXCEPTION 'injected concurrent audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER source_race_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION source_race_audit();`,
  );
  const barrier = spawn("psql", args, { stdio: ["pipe", "pipe", "pipe"] });
  processes.add(barrier);
  barrier.stdout.resume();
  barrier.stderr.resume();
  barrier.stdin.write("SELECT pg_advisory_lock(842001);\n");
  await waitUntil(
    () =>
      sql(
        "SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND objid=842001 AND granted",
      ) === "1",
  );
  const failed = asyncSql(
    `SET application_name='source_failed'; ` +
      prefix() +
      command({ ...base, expectedVersion: 3 }, "race-failed"),
  );
  await waitUntil(
    () =>
      sql(
        "SELECT count(*) FROM pg_stat_activity WHERE application_name='source_failed' AND wait_event='advisory'",
      ) === "1",
  );
  const success = asyncSql(
    `SET application_name='source_success'; ` +
      prefix() +
      command({ ...base, expectedVersion: 3, authorityTier: "working" }, "race-success"),
  );
  await waitUntil(
    () =>
      sql(
        "SELECT count(*) FROM pg_stat_activity WHERE application_name='source_success' AND wait_event='advisory'",
      ) === "1",
  );
  barrier.stdin.end("SELECT pg_advisory_unlock(842001);\n");
  const [failureResult, successResult] = await Promise.all([failed.result, success.result]);
  assert.notEqual(failureResult.code, 0);
  assert.match(failureResult.stderr, /injected concurrent/);
  assert.equal(successResult.code, 0, successResult.stderr);
  const winner = JSON.parse(successResult.stdout);
  assert.equal(winner.entry.authority_tier, "working");
  assert.equal(winner.entry.version, 4);
  assert.equal(
    sql(`SELECT count(*) FROM source_authority_receipts WHERE request_key='race-failed'`),
    "0",
  );
  assert.equal(
    sql(
      `SELECT authority_tier FROM source_authority_registry WHERE tenant_id='${a}' AND system_key='canonical_crm'`,
    ),
    "working",
  );
  sql("DROP TRIGGER source_race_audit ON audit_log;");
  checks.push("concurrent failed update cannot erase successful update");
  const parallel = await Promise.all([
    asyncSql(prefix() + command({ ...base, expectedVersion: 4 }, "same-request")).result,
    asyncSql(prefix() + command({ ...base, expectedVersion: 4 }, "same-request")).result,
  ]);
  parallel.forEach((r) => assert.equal(r.code, 0, r.stderr));
  assert.equal(
    sql(`SELECT count(*) FROM source_authority_receipts WHERE request_key='same-request'`),
    "1",
  );
  checks.push("concurrent identical requests produce one receipt");
  const other = invoke(base, "first", b, b);
  assert.equal(other.entry.tenant_id, b);
  assert.equal(
    sql(
      prefix(a, "authenticated", a) +
        "SELECT count(*) FROM source_authority_registry WHERE tenant_id<>'" +
        a +
        "';",
    ),
    "0",
  );
  assert.equal(
    sql(prefix(a) + "SELECT count(*) FROM source_authority_receipts WHERE tenant_id<>'" + a + "';"),
    "0",
  );
  assert.throws(() => invoke({ ...base, systemKey: "forged" }, "forged", b, a), /administrator/);
  assert.throws(
    () => sql(prefix(a, "authenticated") + command(base, "direct")),
    /permission denied/,
  );
  assert.throws(
    () => sql(prefix(a, "anon") + "SELECT * FROM source_authority_registry"),
    /permission denied/,
  );
  for (const role of ["authenticated", "service_role"])
    assert.throws(
      () => sql(prefix(a, role) + "UPDATE source_authority_registry SET authority_tier='official'"),
      /permission denied/,
    );
  assert.throws(
    () => invoke({ ...base, systemKey: "member" }, "member", a, member),
    /administrator/,
  );
  checks.push("tenant isolation, service-only command, member and direct-write refusal");
  sql(`UPDATE tenant_memberships SET status='revoked' WHERE tenant_id='${a}' AND user_id='${a}';`);
  assert.throws(() => invoke(base, "first"), /administrator/);
  sql(
    `UPDATE tenant_memberships SET status='active' WHERE tenant_id='${a}' AND user_id='${a}'; UPDATE tenants SET status='suspended' WHERE id='${a}';`,
  );
  assert.throws(() => invoke(base, "first"), /unavailable/);
  sql(`UPDATE tenants SET status='active' WHERE id='${a}';`);
  checks.push("replay rechecks current membership and tenant lifecycle");
  assert.throws(() => sql("UPDATE source_authority_receipts SET request_hash='fake'"), /immutable/);
  sql(`UPDATE audit_log SET metadata='{}' WHERE id='${first.auditId}';`);
  assert.throws(() => invoke(base, "first"), /audit could not be verified/);
  assert.throws(() => sql(`DELETE FROM audit_log WHERE id='${first.auditId}'`), /foreign key/);
  checks.push("immutable receipts and exact linked audit revalidation");
  const receipt = {
    result: "passed",
    boundary: "native PostgreSQL with simulated authenticated identity and membership",
    postgres: version,
    migration: "20261008230447_source_authority_atomic_receipts.sql",
    checks,
  };
  writeFileSync("/tmp/accelerate-source-authority-postgres.json", JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} finally {
  for (const child of processes) child.kill("SIGTERM");
  if (started)
    spawnSync("pg_ctl", ["-D", join(root, "data"), "-m", "immediate", "stop"], {
      encoding: "utf8",
    });
  rmSync(root, { recursive: true, force: true });
}
