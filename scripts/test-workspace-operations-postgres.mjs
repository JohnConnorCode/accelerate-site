import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { createServer } from "node:net";

const root = mkdtempSync(join(tmpdir(), "workspace-generation-pg-"));
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const value = server.address().port;
    server.close(() => resolve(value));
  });
});
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
const run = (cmd, argv, input) => {
  const result = spawnSync(cmd, argv, { encoding: "utf8", input });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
};
const sql = (text) => run("psql", args, text);
const asyncSql = (text) =>
  new Promise((resolve, reject) => {
    const child = spawn("psql", args);
    let out = "",
      err = "";
    child.stdout.on("data", (data) => (out += data));
    child.stderr.on("data", (data) => (err += data));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err))));
    child.stdin.end(text);
  });
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const bp = "33333333-3333-4333-8333-333333333333";
const second = "44444444-4444-4444-8444-444444444444";
const concurrent = "55555555-5555-4555-8555-555555555555";
const document = {
  schemaVersion: "workspace-blueprint.v1",
  businessSummary: "A fictional roofing team reviews won jobs before sending a welcome email.",
};
const plan = {
  navigation: [
    {
      ref: "navigation:Jobs",
      label: "Jobs",
      targetType: "board",
      targetKey: "won_jobs",
      status: "ready",
      reason: null,
    },
  ],
  boards: [
    {
      ref: "board:won_jobs",
      blueprintBoardKey: "won_jobs",
      name: "Won jobs",
      sourceType: "opportunity",
      targetBoardKey: "pipeline",
      status: "ready",
      reason: null,
      columns: [
        { columnKey: "won", label: "Keep existing won", lifecycleStates: ["won"] },
        { columnKey: "job_review", label: "Review job", lifecycleStates: ["won"] },
      ],
    },
  ],
  views: [
    {
      ref: "view:review_jobs",
      name: "Review jobs",
      sourceType: "opportunity",
      status: "ready",
      filters: [{ field: "stage", op: "eq", value: "won" }],
      sort: [],
      columns: ["stage"],
    },
  ],
  workflows: [
    {
      key: "welcome",
      status: "ready",
      approvalRequired: true,
      steps: [{ capabilityKey: "email.send", status: "ready" }],
    },
  ],
  coworkers: [
    {
      key: "sales",
      status: "ready",
      requiredCapabilities: ["email.draft"],
      missingCapabilities: [],
    },
  ],
  customAppBriefs: [],
  canApply: true,
};
const literal = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const prefix = (tenant = a, role = "service_role") =>
  `SET request.headers='{"x-tenant-id":"${tenant}"}'; SET request.jwt.claim.role='${role}'; SET ROLE ${role}; `;
const call = ({
  tenant = a,
  blueprint = bp,
  version = 1,
  key = "first",
  actor = "fictional@example.test",
  doc = document,
  proposed = plan,
} = {}) =>
  `SELECT public.generate_workspace_operations('${tenant}','${blueprint}',${version},'${key}','${actor}',${literal(doc)},${literal(proposed)});`;
const counters = () =>
  sql(
    "SELECT (SELECT count(*) FROM workspace_generated_operations)||','||(SELECT count(*) FROM audit_log)||','||(SELECT count(*) FROM workspace_generated_operation_requests)||','||(SELECT count(*) FROM kanban_columns)",
  );
let started = false;
try {
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
  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA private; CREATE SCHEMA auth;
    CREATE TABLE tenants(id uuid PRIMARY KEY,status text);
    INSERT INTO tenants VALUES('${a}','active'),('${b}','active');
    CREATE TABLE audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,
      actor_email text,action text,entity_type text,entity_id text,source text,after_state jsonb,metadata jsonb,
      UNIQUE(tenant_id,id));
    CREATE TABLE opportunities(id uuid PRIMARY KEY,tenant_id uuid,stage text);
    INSERT INTO opportunities VALUES(gen_random_uuid(),'${a}','won'),(gen_random_uuid(),'${b}','qualified');
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
    CREATE FUNCTION private.request_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (current_setting('request.headers',true)::jsonb->>'x-tenant-id')::uuid $$;
    CREATE FUNCTION private.has_active_tenant_membership(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    GRANT USAGE ON SCHEMA auth,private TO service_role;`);
  const contextMigration = readFileSync(
    "migrations/20260830-tenant-context-authorization.sql",
    "utf8",
  );
  sql(
    contextMigration.slice(
      contextMigration.indexOf("CREATE OR REPLACE FUNCTION private.authorized_request_tenant_id()"),
      contextMigration.indexOf("DROP FUNCTION IF EXISTS public.claim_revenue_job_run"),
    ),
  );
  const kanban = readFileSync("migrations/20260902-kanban-columns.sql", "utf8");
  sql(
    kanban.slice(
      kanban.indexOf("CREATE TABLE IF NOT EXISTS public.kanban_columns"),
      kanban.indexOf(
        "-- =============================================================================",
        kanban.indexOf("CREATE TABLE IF NOT EXISTS public.kanban_columns"),
      ),
    ),
  );
  sql(readFileSync("migrations/20260923-workspace-blueprints.sql", "utf8"));
  sql(readFileSync("migrations/20260925-workspace-generated-operations.sql", "utf8"));
  const migration = readFileSync(
    "migrations/20261008183625_workspace_operations_atomic.sql",
    "utf8",
  );
  sql(migration);
  sql(migration);
  sql(`GRANT SELECT ON tenants TO service_role; GRANT ALL ON audit_log,kanban_columns TO service_role;
    INSERT INTO kanban_columns(tenant_id,board_key,column_key,label,sort_order,is_default,metadata)
      VALUES('${a}','pipeline','won','Won',1000,true,'{"canonicalRole":"won"}');`);
  for (const [tenant, id] of [
    [a, bp],
    [a, second],
    [a, concurrent],
    [b, bp],
  ]) {
    sql(`INSERT INTO workspace_blueprints(tenant_id,id,status,latest_version) VALUES('${tenant}','${id}','approved',1);
      INSERT INTO workspace_blueprint_versions(tenant_id,blueprint_id,version,document,change_summary) VALUES('${tenant}','${id}',1,${literal(document)},'Fictional setup');`);
  }
  const sourceState = sql("SELECT jsonb_agg(to_jsonb(o) ORDER BY tenant_id) FROM opportunities o");
  sql(`CREATE FUNCTION public.fail_generation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.actor_email='forced@example.test' THEN
      PERFORM pg_sleep(1); RAISE EXCEPTION 'forced audit failure';
    END IF; RETURN NEW; END $$;
    CREATE TRIGGER fail_generation_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_generation_audit();`);
  assert.throws(
    () => sql(prefix() + call({ actor: "forced@example.test" })),
    /forced audit failure/,
  );
  assert.equal(
    counters(),
    "0,0,0,1",
    "audit failure rolls columns, receipt and request back together",
  );
  const first = JSON.parse(sql(prefix() + call()));
  assert.equal(first.replayed, false);
  assert.deepEqual(first.receipt.boards[0].columnsCreated, ["job_review"]);
  assert.ok(first.receipt.auditId);
  assert.equal(first.receipt.workflows[0].approvalRequired, true);
  assert.equal(first.receipt.workflows[0].actionId, null);
  assert.equal(counters(), "1,1,1,2");
  assert.equal(
    sql("SELECT label||','||is_default FROM kanban_columns WHERE column_key='won'"),
    "Won,true",
  );
  assert.deepEqual(JSON.parse(sql(prefix() + call())).receipt, first.receipt);
  assert.deepEqual(JSON.parse(sql(prefix() + call({ key: "alias" }))).receipt, first.receipt);
  assert.equal(counters(), "1,1,2,2");
  assert.throws(
    () => sql(prefix() + call({ blueprint: second, key: "alias" })),
    /generation_request_conflict/,
  );
  const parallel = await Promise.all([
    asyncSql(prefix() + call({ blueprint: second, key: "parallel-a" })),
    asyncSql(prefix() + call({ blueprint: second, key: "parallel-b" })),
  ]);
  assert.deepEqual(parallel.map((s) => JSON.parse(s).replayed).sort(), [false, true]);
  assert.equal(counters(), "2,2,4,2");

  // Start the second caller while the first is inside its forced audit failure.
  // Its uncommitted columns cannot become somebody else's successful receipt.
  const failing = asyncSql(
    "SET application_name='workspace_generation_failure';" +
      prefix() +
      call({
        blueprint: concurrent,
        key: "retryable",
        actor: "forced@example.test",
        proposed: {
          ...plan,
          boards: [
            {
              ...plan.boards[0],
              columns: [
                { columnKey: "concurrent_job", label: "Concurrent job", lifecycleStates: ["won"] },
              ],
            },
          ],
        },
      }),
  );
  const failingOutcome = failing.then(
    () => ({ passed: true }),
    (error) => ({ error }),
  );
  const deadline = Date.now() + 5000;
  while (
    sql(
      "SELECT count(*) FROM pg_stat_activity WHERE application_name='workspace_generation_failure' AND wait_event='PgSleep'",
    ) !== "1"
  ) {
    if (Date.now() > deadline) throw new Error("Forced audit barrier was not reached");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const successful = asyncSql(
    prefix() +
      call({
        blueprint: concurrent,
        key: "concurrent-good",
        proposed: {
          ...plan,
          boards: [
            {
              ...plan.boards[0],
              columns: [
                { columnKey: "concurrent_job", label: "Concurrent job", lifecycleStates: ["won"] },
              ],
            },
          ],
        },
      }),
  );
  const [failure, success] = await Promise.all([failingOutcome, successful]);
  assert.match(failure.error?.message ?? "", /forced audit failure/);
  assert.equal(JSON.parse(success).replayed, false);
  assert.deepEqual(JSON.parse(success).receipt.boards[0].columnsCreated, ["concurrent_job"]);
  assert.equal(counters(), "3,3,5,3");
  assert.equal(
    JSON.parse(sql(prefix() + call({ blueprint: concurrent, key: "retryable" }))).replayed,
    true,
  );
  assert.equal(counters(), "3,3,6,3");
  assert.equal(
    sql("SELECT jsonb_agg(to_jsonb(o) ORDER BY tenant_id) FROM opportunities o"),
    sourceState,
  );

  assert.throws(() => sql(prefix(b) + call()), /generation_forbidden/);
  assert.throws(
    () => sql(prefix() + call({ version: 2, key: "stale" })),
    /generation_approval_changed/,
  );
  assert.throws(
    () =>
      sql(prefix() + call({ doc: { ...document, businessSummary: "Changed" }, key: "changed" })),
    /generation_approval_changed/,
  );
  sql(`UPDATE workspace_blueprints SET status='draft' WHERE tenant_id='${a}' AND id='${bp}';`);
  assert.throws(() => sql(prefix() + call()), /generation_approval_changed/);
  sql(
    `UPDATE workspace_blueprints SET status='approved' WHERE tenant_id='${a}' AND id='${bp}'; UPDATE tenants SET status='suspended' WHERE id='${a}';`,
  );
  assert.throws(() => sql(prefix() + call()), /generation_forbidden/);
  sql(`UPDATE tenants SET status='active' WHERE id='${a}';`);
  for (const role of ["anon", "authenticated"]) {
    assert.throws(() => sql(prefix(a, role) + call()), /permission denied/);
    assert.throws(
      () => sql(prefix(a, role) + "SELECT * FROM workspace_generated_operation_requests"),
      /permission denied/,
    );
  }
  assert.equal(
    sql("SELECT prosecdef FROM pg_proc WHERE proname='generate_workspace_operations'"),
    "f",
  );
  assert.equal(
    sql(
      "SELECT has_function_privilege('authenticated','public.generate_workspace_operations(uuid,uuid,integer,text,text,jsonb,jsonb)','EXECUTE')",
    ),
    "f",
  );
  const otherTenant = JSON.parse(sql(prefix(b) + call({ tenant: b, key: "first" })));
  assert.equal(otherTenant.replayed, false);
  assert.deepEqual(otherTenant.receipt.boards[0].columnsCreated, ["won", "job_review"]);

  sql(
    `UPDATE workspace_generated_operations SET receipt=jsonb_set(receipt,'{auditId}','"00000000-0000-4000-8000-000000000000"') WHERE tenant_id='${a}' AND blueprint_id='${second}';`,
  );
  assert.throws(
    () => sql(prefix() + call({ blueprint: second, key: "tampered" })),
    /generation_reconciliation_required/,
  );
  sql(
    `UPDATE workspace_generated_operations SET receipt=jsonb_set(receipt,'{auditId}',to_jsonb(audit_id::text)) WHERE tenant_id='${a}' AND blueprint_id='${second}';`,
  );
  sql(`UPDATE workspace_blueprints SET latest_version=2 WHERE tenant_id='${a}' AND id='${bp}';
    INSERT INTO workspace_blueprint_versions(tenant_id,blueprint_id,version,document,change_summary) VALUES('${a}','${bp}',2,${literal(document)},'Legacy setup');
    INSERT INTO workspace_generated_operations(tenant_id,blueprint_id,version,request_key,receipt) VALUES('${a}','${bp}',2,'legacy','{}');`);
  const beforeLegacy = counters();
  sql(migration);
  sql(migration);
  assert.throws(
    () => sql(prefix() + call({ version: 2, key: "legacy" })),
    /generation_reconciliation_required/,
  );
  assert.throws(
    () => sql(prefix() + call({ version: 2, key: "legacy-alias" })),
    /generation_reconciliation_required/,
  );
  assert.equal(
    counters(),
    beforeLegacy,
    "populated migration and refused replay preserve old rows",
  );
  assert.equal(
    sql("SELECT audit_id IS NULL FROM workspace_generated_operations WHERE request_key='legacy'"),
    "t",
  );
  console.log(
    JSON.stringify({
      result: "passed",
      postgres: sql("SHOW server_version"),
      scenarios: [
        "audit rollback and safe retry",
        "existing column preservation",
        "same-key and alias replay",
        "alias conflict",
        "same-version concurrency",
        "concurrent audit failure",
        "tenant-bound receipts",
        "active tenant",
        "current approval",
        "document freshness",
        "service-only invoker",
        "historical reconciliation",
        "fresh and populated migration replay",
        "authoritative lifecycle unchanged",
      ],
    }),
  );
} finally {
  if (started) run("pg_ctl", ["-D", join(root, "data"), "-m", "immediate", "-w", "stop"]);
  rmSync(root, { recursive: true, force: true });
}
