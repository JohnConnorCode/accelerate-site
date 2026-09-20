import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
const root = mkdtempSync(join(tmpdir(), "accelerate-readiness-report-"));
const data = join(root, "data");
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close(() => resolve(address.port));
  });
});
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed`);
  return result.stdout;
}
let started = false;
try {
  run("initdb", ["-A", "trust", "-U", "postgres", "-D", data]);
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    join(root, "postgres.log"),
    "-o",
    `-F -h 127.0.0.1 -k '' -p ${port}`,
    "-w",
    "start",
  ]);
  started = true;
  const args = [
    "-X",
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
    "-q",
  ];
  run("psql", [
    ...args,
    "-c",
    `
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA private;
    CREATE FUNCTION private.request_tenant_id() RETURNS uuid LANGUAGE sql AS $$
      SELECT coalesce(nullif(current_setting('test.tenant',true),''),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')::uuid $$;
    CREATE FUNCTION public.accelerate_default_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT private.request_tenant_id() $$;
    CREATE FUNCTION private.has_active_tenant_membership(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    CREATE TABLE tenants(id uuid PRIMARY KEY,status text);
    CREATE TABLE contacts(tenant_id uuid,id uuid,UNIQUE(tenant_id,id));
    CREATE TABLE opportunities(tenant_id uuid,id uuid,UNIQUE(tenant_id,id));
    INSERT INTO tenants VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','active'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','active');
    GRANT USAGE ON SCHEMA public,private TO authenticated,service_role;
    GRANT SELECT ON tenants TO service_role;
  `,
  ]);
  for (const file of [
    "migrations/20260920-ai-readiness-assessment.sql",
    "migrations/20260920201517_ai_readiness_atomic_reports.sql",
    "migrations/20260920201517_ai_readiness_atomic_reports.sql",
  ])
    run("psql", [...args, "-f", file]);
  const tenant = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const input = JSON.stringify({
    version: "test",
    answers: {},
    profile: {},
    name: "Fixture",
    email: "qa-report@example.invalid",
    business_name: "Fixture",
    consent_given: true,
  });
  const report = JSON.stringify({
    score: 40,
    coverage: 100,
    dimensionScores: [],
    aiStatus: "rules",
  });
  const call = (session, token, value = report) =>
    `select complete_ai_readiness_report('${tenant}','${session.repeat(32)}','${token.repeat(32)}','${input}','${value}');`;
  // Actual competing connections must return one immutable report identity.
  const { spawn } = await import("node:child_process");
  const concurrent = (sql) =>
    new Promise((resolve, reject) => {
      const child = spawn("psql", [...args, "-At", "-c", sql]);
      let out = "",
        err = "";
      child.stdout.on("data", (x) => (out += x));
      child.stderr.on("data", (x) => (err += x));
      child.on("error", reject);
      child.on("close", (code) => (code ? reject(new Error(err)) : resolve(JSON.parse(out))));
    });
  const [first, second] = await Promise.all([
    concurrent(call("s", "r")),
    concurrent(call("s", "t")),
  ]);
  if (first.reportToken !== second.reportToken || first.assessmentId !== second.assessmentId)
    throw new Error("Concurrent report identity changed");
  const replay = await concurrent(
    call("s", "u", JSON.stringify({ ...JSON.parse(report), score: 99 })),
  );
  if (replay.report.score !== 40 || replay.reportToken !== first.reportToken)
    throw new Error("Retry replaced saved report");
  const bad = spawnSync(
    "psql",
    [...args, "-c", call("f", "v", JSON.stringify({ ...JSON.parse(report), aiStatus: "invalid" }))],
    { encoding: "utf8" },
  );
  if (bad.status === 0) throw new Error("Invalid report accepted");
  const count = run("psql", [
    ...args,
    "-At",
    "-c",
    `select count(*) from ai_readiness_assessments where session_token='${"f".repeat(32)}';`,
  ]).trim();
  if (count !== "0") throw new Error("Report failure did not roll back assessment");
  run("psql", [
    ...args,
    "-c",
    `
    INSERT INTO ai_readiness_assessments(tenant_id,session_token,version) VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',repeat('b',32),'test');
    SET ROLE authenticated;
    DO $$ BEGIN
      IF (SELECT count(*) FROM ai_readiness_assessments)<>1 THEN RAISE EXCEPTION 'Tenant data exposed'; END IF;
      IF has_function_privilege('authenticated','public.complete_ai_readiness_report(uuid,text,text,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Public write exposed'; END IF;
    END $$;
    RESET ROLE;
    SET ROLE service_role;
    ${call("z", "x")}
    RESET ROLE;
  `,
  ]);
  console.log(
    "Readiness PostgreSQL: concurrent completion, immutable replay, rollback, tenant RLS, service-only write and repeatable migration passed.",
  );
} catch (error) {
  if (!started) {
    try {
      console.error(readFileSync(join(root, "postgres.log"), "utf8"));
    } catch {
      /* Server may not have started. */
    }
  }
  throw error;
} finally {
  if (started) spawnSync("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"], { encoding: "utf8" });
  if (root.startsWith(join(tmpdir(), "accelerate-readiness-report-")))
    rmSync(root, { recursive: true, force: true });
}
