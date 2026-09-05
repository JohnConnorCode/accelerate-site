import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { createServer } from "node:net";
const root = mkdtempSync(join(tmpdir(), "accelerate-runtime-proof-"));
const data = join(root, "data");
const port = await new Promise((resolve, reject) => {
  const s = createServer();
  s.on("error", reject);
  s.listen(0, "127.0.0.1", () => {
    const p = s.address().port;
    s.close(() => resolve(p));
  });
});
const args = [
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
function run(cmd, argv, input) {
  const r = spawnSync(cmd, argv, { encoding: "utf8", input });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout.trim();
}
const sql = (input) => run("psql", args, input);
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const context = (tenant = a) =>
  `SET request.headers='{"x-tenant-id":"${tenant}"}'; SET request.jwt.claim.role='service_role'; SET ROLE service_role;`;
function asyncSql(input) {
  return new Promise((resolve, reject) => {
    const p = spawn("psql", args);
    let out = "",
      err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve(out.trim()) : reject(new Error(err))));
    p.stdin.end(input);
  });
}
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
  sql(`CREATE EXTENSION pgcrypto; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
 CREATE SCHEMA private;CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
 CREATE FUNCTION public.accelerate_default_tenant_id() RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT '${a}'::uuid $$;
 CREATE TABLE tenants(id uuid PRIMARY KEY,status text); INSERT INTO tenants VALUES('${a}','active'),('${b}','active');
 CREATE TABLE tenant_memberships(tenant_id uuid,user_id uuid,status text);
 INSERT INTO tenant_memberships VALUES('${a}','${a}','active');
 CREATE TABLE action_queue(id uuid PRIMARY KEY,tenant_id uuid NOT NULL);
 CREATE TABLE coworkers(id text PRIMARY KEY,tenant_id uuid NOT NULL,name text,UNIQUE(tenant_id,id));
 CREATE TABLE plugins(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,UNIQUE(tenant_id,id));
 CREATE TABLE plugin_tools(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,plugin_id uuid REFERENCES plugins(id));
 CREATE TABLE plugin_triggers(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,plugin_id uuid REFERENCES plugins(id));
 `);
  const tenancy = readFileSync("migrations/20260830-shared-database-tenancy.sql", "utf8");
  sql(
    tenancy.slice(
      tenancy.indexOf("CREATE OR REPLACE FUNCTION private.request_tenant_id()"),
      tenancy.indexOf("ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;"),
    ),
  );
  sql(readFileSync("migrations/20260831-tenant-suspension-guards.sql", "utf8"));
  for (const file of [
    "20260902-autonomy-policies.sql",
    "20260902-work-items.sql",
    "20260903-agent-memory-and-budgets.sql",
  ])
    sql(readFileSync(`migrations/${file}`, "utf8"));
  for (let i = 0; i < 2; i++)
    for (const file of [
      "20260904-runtime-tenant-boundaries.sql",
      "20260904-runtime-policy-enforcement.sql",
      "20260904-runtime-budget-claims.sql",
      "20260904-runtime-work-approval-links.sql",
      "20260904-runtime-work-claims.sql",
    ])
      sql(readFileSync(`migrations/${file}`, "utf8"));
  sql(`GRANT USAGE ON SCHEMA public,auth,private TO authenticated,service_role;
 GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
 GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
 INSERT INTO coworkers VALUES('sales','${a}','A sales'),('sales','${b}','B sales');
 INSERT INTO plugins VALUES('${a}','${a}');`);
  assert.equal(sql("SELECT count(*) FROM coworkers WHERE id='sales'"), "2");
  assert.throws(
    () => sql(`INSERT INTO plugin_tools VALUES(gen_random_uuid(),'${b}','${a}')`),
    /foreign key/,
  );
  assert.throws(
    () =>
      sql(
        `INSERT INTO agent_memory(tenant_id,coworker_id,category,subject,body) VALUES('${b}','missing','prior_work','x','x')`,
      ),
    /foreign key/,
  );
  assert.equal(
    sql(`${context(b)} SELECT hard_floor FROM check_autonomy('credential.change',null)`),
    "t",
  );
  assert.equal(
    sql(`${context()} SELECT requires_approval FROM check_autonomy('create_task',null)`),
    "t",
  );
  sql(
    `INSERT INTO autonomy_policies(tenant_id,action_key,label,level,approved_by,approved_at) VALUES('${a}','create_task','Create tasks','standing_permission',null,null);`,
  );
  assert.equal(sql(`${context()} SELECT allowed FROM check_autonomy('create_task',null)`), "f");
  sql(`UPDATE autonomy_policies SET approved_by='founder',approved_at=now();`);
  assert.equal(sql(`${context()} SELECT allowed FROM check_autonomy('create_task',null)`), "t");
  sql(`UPDATE autonomy_policies SET constraints='{"unknown":true}';`);
  assert.equal(
    sql(`${context()} SELECT requires_approval FROM check_autonomy('create_task',null)`),
    "t",
  );
  assert.throws(
    () =>
      sql(
        `SET request.headers='{"x-tenant-id":"${b}"}'; SET request.jwt.claim.role='authenticated';SET request.jwt.claim.sub='${a}';SET ROLE authenticated;SELECT * FROM check_autonomy('create_task',null)`,
      ),
    /forbidden/,
  );
  assert.equal(
    sql(
      `SET request.headers='{"x-tenant-id":"${a}"}'; SET request.jwt.claim.role='authenticated';SET request.jwt.claim.sub='${a}';SET ROLE authenticated;SELECT count(*) FROM autonomy_hard_floors WHERE tenant_id='${b}'`,
    ),
    "0",
  );
  sql(
    `INSERT INTO autonomy_policies(tenant_id,action_key,label,level) VALUES('${a}','create_task','Strict duplicate','prohibited');`,
  );
  assert.equal(
    sql(`${context()} SELECT level FROM check_autonomy('create_task',null)`),
    "prohibited",
    "duplicates choose the strictest policy",
  );
  sql(
    `INSERT INTO autonomy_policies(tenant_id,action_key,label,level,is_hard_floor) VALUES('${a}','custom.floor','Floor','always_ask',true);`,
  );
  assert.equal(
    sql(`${context()} SELECT hard_floor FROM check_autonomy('custom.floor','sales')`),
    "t",
    "a generic policy floor cannot be bypassed by a worker",
  );
  const workId = "33333333-3333-4333-8333-333333333333";
  sql(
    `INSERT INTO work_items(id,tenant_id,kind,objective,reason,source) VALUES('${workId}','${a}','fixture','Test','Test','test');`,
  );
  const workClaims = await Promise.all(
    ["worker-one", "worker-two"].map((owner) =>
      asyncSql(
        `${context()} BEGIN; SELECT claimed FROM claim_work_item('fixture',null,'${owner}',60000); SELECT pg_sleep(0.05); COMMIT;`,
      ),
    ),
  );
  assert.equal(
    workClaims.filter((x) => x.trim() === "t").length,
    1,
    "one work lease wins under contention",
  );
  sql(`UPDATE work_items SET lease_expires_at=now()-interval '1 second' WHERE id='${workId}';`);
  const recoveries = await Promise.all(
    ["replacement-one", "replacement-two"].map((owner) =>
      asyncSql(
        `${context()} BEGIN; SELECT claimed FROM claim_work_item('fixture',null,'${owner}',60000); SELECT pg_sleep(0.05); COMMIT;`,
      ),
    ),
  );
  assert.equal(
    recoveries.filter((x) => x.trim() === "t").length,
    1,
    "concurrent stale recovery cannot steal a replacement claim",
  );
  assert.equal(sql(`SELECT attempt_count FROM work_items WHERE id='${workId}'`), "2");
  sql(
    `UPDATE work_items SET status='pending',next_check_at=now()+interval '1 hour',next_check_reason='Retry backoff',lease_owner=null,lease_expires_at=null WHERE id='${workId}';`,
  );
  assert.equal(
    sql(`${context()} SELECT claimed FROM claim_work_item('fixture','${workId}','early',60000)`),
    "f",
    "explicit IDs must honor retry delay",
  );
  assert.equal(
    sql(`${context(b)} SELECT claimed FROM claim_work_item('fixture','${workId}','foreign',60000)`),
    "f",
  );
  assert.equal(
    sql(`${context()} SELECT claimed FROM claim_work_item('wrong-kind','${workId}','wrong',60000)`),
    "f",
  );
  sql(
    `INSERT INTO budget_limits(tenant_id,coworker_id,budget_kind,limit_value,period) VALUES('${a}','*','vendor_api_calls',1,'daily');`,
  );
  const results = await Promise.all(
    ["one", "two"].map((key) =>
      asyncSql(
        `${context()} BEGIN; SELECT allowed FROM claim_budget_usage('sales','vendor_api_calls',1,'${key}',null); SELECT pg_sleep(0.05); COMMIT;`,
      ),
    ),
  );
  assert.equal(
    results.filter((x) => x.trim() === "t").length,
    1,
    "two simultaneous workers cannot spend the last unit twice",
  );
  const winningKey = results[0].trim() === "t" ? "one" : "two";
  assert.equal(
    sql(
      `${context()} SELECT replayed FROM claim_budget_usage('sales','vendor_api_calls',1,'${winningKey}',null)`,
    ),
    "t",
  );
  assert.equal(
    sql(
      `${context(b)} SELECT allowed FROM claim_budget_usage('sales','vendor_api_calls',1,'one',null)`,
    ),
    "t",
    "same key in another tenant is independent",
  );
  assert.throws(
    () =>
      sql(
        `${context()} SELECT * FROM claim_budget_usage('sales','vendor_api_calls',-1,'bad',null)`,
      ),
    /non-negative/,
  );
  sql(`UPDATE tenants SET status='suspended' WHERE id='${a}';`);
  assert.throws(
    () =>
      sql(
        `${context()} SELECT * FROM claim_budget_usage('sales','vendor_api_calls',1,'after-suspension',null)`,
      ),
    /unavailable/,
  );
  console.log(
    JSON.stringify({
      result: "passed",
      checks: [
        "idempotent-migrations",
        "tenant-composite-coworkers",
        "foreign-link-refusal",
        "hard-floors-all-tenants",
        "signed-standing-policy",
        "unknown-constraints-require-approval",
        "membership-bound-policy-RPC",
        "hard-floor-RLS",
        "concurrent-budget-claim",
        "replay-refusal",
        "tenant-key-independence",
        "invalid-budget",
        "concurrent-work-claims",
        "concurrent-stale-recovery",
        "explicit-work-delay",
        "strictest-duplicate-policy",
        "suspension",
      ],
    }),
  );
} finally {
  if (started) spawnSync("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"], { encoding: "utf8" });
  rmSync(root, { recursive: true, force: true });
}
