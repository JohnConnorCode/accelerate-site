import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
const root = mkdtempSync(join(tmpdir(), "forms-pg-"));
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

  sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA private;
    CREATE FUNCTION private.authorized_request_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.tenant',true),'')::uuid $$;
    CREATE TABLE public.tenants(id uuid PRIMARY KEY,status text,config jsonb);
    CREATE TABLE public.admin_notifications(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,type text,title text,description text,link text,priority text);
    CREATE TABLE public.audit_log(tenant_id uuid,actor_email text,action text,entity_type text,entity_id text,source text,metadata jsonb);
    CREATE TABLE public.action_queue(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,action_type text,title text,description text,payload jsonb,source_context text,entity_type text,entity_id uuid,dedupe_key text,proposed_by text,expires_at timestamptz);
    INSERT INTO tenants VALUES('${a}','active','{"modules":{"form-builder":true}}'),('${b}','active','{"modules":{"form-builder":true}}');`);
  for (const file of [
    "20260914-form-builder.sql",
    "20260919203846_form_submission_safety.sql",
    "20260919204344_form_definition_commands.sql",
    "20260919211809_form_review_commands.sql",
  ])
    sql(readFileSync(`migrations/${file}`, "utf8"));
  const definition = {
    elements: [{ name: "email", type: "text", inputType: "email", isRequired: true }],
  };
  const json = (value) => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
  const token = "a".repeat(64),
    otherToken = "b".repeat(64),
    foreignToken = "c".repeat(64);
  sql(`INSERT INTO form_definitions(id,tenant_id,name,schema,status,share_token) VALUES
    ('${a}','${a}','First',${json(definition)},'published','${token}'),
    (gen_random_uuid(),'${a}','Second',${json(definition)},'published','${otherToken}'),
    ('${b}','${b}','Foreign',${json(definition)},'published','${foreignToken}');`);
  const command = (
    key,
    response = { email: "person@example.test" },
    share = token,
    schema = definition,
  ) =>
    `SET ROLE service_role; SELECT record_form_submission('${share}','${key}',${json(response)},${json(schema)},NULL,'person@example.test');`;
  const runAsync = (input) =>
    new Promise((resolve, reject) => {
      const child = spawn("psql", args);
      let out = "",
        err = "";
      child.stdout.on("data", (chunk) => (out += chunk));
      child.stderr.on("data", (chunk) => (err += chunk));
      child.on("error", reject);
      child.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err))));
      child.stdin.end(input);
    });
  const key = "33333333-3333-4333-8333-333333333333";
  const race = await Promise.all([runAsync(command(key)), runAsync(command(key))]);
  const receipts = race.map(JSON.parse);
  assert.equal(receipts[0].submissionId, receipts[1].submissionId);
  assert.deepEqual(receipts.map((r) => r.duplicate).sort(), [false, true]);
  assert.equal(sql("SELECT count(*) FROM form_submissions"), "1");
  assert.equal(sql("SELECT count(*) FROM form_submission_commands"), "1");
  assert.equal(sql("SELECT count(*) FROM admin_notifications"), "1");
  assert.throws(() => sql(command(key, { email: "changed@example.test" })), /reused/);
  assert.throws(() => sql(command(key, undefined, otherToken)), /reused/);
  // The same key is independent in a different tenant, with no receipt leakage.
  const foreign = JSON.parse(sql(command(key, undefined, foreignToken)));
  assert.notEqual(foreign.submissionId, receipts[0].submissionId);
  assert.throws(() => sql(command(a, undefined, token, { elements: [] })), /Form changed/);
  for (const role of ["anon", "authenticated"])
    assert.throws(
      () => sql(command(a).replace("SET ROLE service_role", `SET ROLE ${role}`)),
      /permission denied/,
    );
  sql(`CREATE FUNCTION private.reject_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled notification failure'; END $$;
    CREATE TRIGGER reject_notice BEFORE INSERT ON admin_notifications FOR EACH ROW EXECUTE FUNCTION private.reject_notice();`);
  assert.throws(() => sql(command(a)), /controlled notification failure/);
  assert.equal(sql("SELECT count(*) FROM form_submissions"), "2");
  assert.equal(sql("SELECT count(*) FROM form_submission_commands"), "2");
  sql("DROP TRIGGER reject_notice ON admin_notifications");
  assert.equal(JSON.parse(sql(command(a))).duplicate, false);
  const definitionCommand = (operation, revision, patch) =>
    `SET app.tenant='${a}'; SET ROLE service_role; SELECT write_form_definition('${operation}','${key}',${revision ? "'" + revision + "'" : "NULL"},${json(patch)},'owner@example.test');`;
  const created = JSON.parse(
    sql(
      definitionCommand("create", null, {
        name: "Draft",
        schema: definition,
        share_token: "d".repeat(64),
      }),
    ),
  );
  const saved = JSON.parse(
    sql(definitionCommand("save", created.updated_at, { schema: definition, name: "Saved" })),
  );
  assert.throws(
    () => sql(definitionCommand("save", created.updated_at, { schema: definition })),
    /Form changed/,
  );
  const definitionsRace = await Promise.allSettled([
    runAsync(
      definitionCommand("save", saved.updated_at, { schema: definition, name: "Racing edit" }),
    ),
    runAsync(
      definitionCommand("status", saved.updated_at, { schema: definition, status: "published" }),
    ),
  ]);
  assert.equal(definitionsRace.filter((result) => result.status === "fulfilled").length, 1);
  assert.match(
    definitionsRace.find((result) => result.status === "rejected").reason.message,
    /Form changed/,
  );
  const review = (decision, requestId) =>
    `SET app.tenant='${a}'; SET ROLE service_role; SELECT review_form_submission('${receipts[0].submissionId}','${decision}','${requestId}','owner@example.test');`;
  assert.throws(() => sql(review("accepted", key)), /reused/);
  const acceptKey = "44444444-4444-4444-8444-444444444444",
    rejectKey = "55555555-5555-4555-8555-555555555555";
  const reviewRace = await Promise.allSettled([
    runAsync(review("accepted", acceptKey)),
    runAsync(review("rejected", rejectKey)),
  ]);
  assert.equal(reviewRace.filter((result) => result.status === "fulfilled").length, 1);
  assert.match(
    reviewRace.find((result) => result.status === "rejected").reason.message,
    /already reviewed/,
  );
  const reviewReceipt = JSON.parse(
    reviewRace.find((result) => result.status === "fulfilled").value,
  );
  assert.equal(
    sql("SELECT count(*) FROM action_queue"),
    reviewReceipt.decision === "accepted" ? "1" : "0",
  );
  assert.equal(
    JSON.parse(
      sql(
        review(
          reviewReceipt.decision,
          reviewReceipt.decision === "accepted" ? acceptKey : rejectKey,
        ),
      ),
    ).duplicate,
    true,
  );
  sql(`UPDATE tenants SET config='{"modules":{"form-builder":false}}' WHERE id='${a}'`);
  assert.throws(() => sql(command(key)), /Form not found/);
  sql(
    `UPDATE tenants SET config='{"modules":{"form-builder":true}}',status='suspended' WHERE id='${a}'`,
  );
  assert.throws(() => sql(command(key)), /Form not found/);
  console.log(
    "PASS: real PostgreSQL concurrent submission replay, form/payload/tenant key binding, one notification, full rollback, stale definition and disabled/suspended tenant refusal.",
  );
} finally {
  if (started) run("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
  rmSync(root, { recursive: true, force: true });
}
