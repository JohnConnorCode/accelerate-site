import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
const root = mkdtempSync(join(tmpdir(), "accelerate-social-proof-"));
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
function run(cmd, argv, input) {
  const r = spawnSync(cmd, argv, { encoding: "utf8", input });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout.trim();
}
const sql = (input) => run("psql", args, input);
const lit = (v) => "'" + String(v).replaceAll("'", "''") + "'";
const json = (v) => lit(JSON.stringify(v)) + "::jsonb";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const ctx = (t = a) =>
  `SET request.headers='{"x-tenant-id":"${t}"}'; SET request.jwt.claim.role='service_role'; SET ROLE service_role;`;
const fail = (input) =>
  assert.notEqual(
    spawnSync("psql", args, { input, encoding: "utf8" }).status,
    0,
    "Expected SQL refusal",
  );
function concurrent(input) {
  return new Promise((resolve, reject) => {
    const p = spawn("psql", args);
    let out = "",
      err = "";
    p.stdout.on("data", (v) => (out += v));
    p.stderr.on("data", (v) => (err += v));
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
  sql(`CREATE EXTENSION pgcrypto; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE SCHEMA private; CREATE SCHEMA auth; CREATE SCHEMA storage;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
 CREATE TABLE tenants(id uuid PRIMARY KEY,status text,config jsonb,updated_at timestamptz DEFAULT now());
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
 CREATE TABLE tenant_memberships(tenant_id uuid,user_id uuid,status text,role text);
 CREATE TABLE integration_connections(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,provider text,status text,account_email text,credential_version integer);
 CREATE TABLE action_queue(id uuid PRIMARY KEY,tenant_id uuid,action_type text,status text,approved_by text,approved_at timestamptz,payload jsonb,UNIQUE(tenant_id,id));
 CREATE TABLE work_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,kind text,objective text,reason text,source text,entity_type text,entity_id uuid,dedupe_key text,due_at timestamptz,next_check_at timestamptz,next_check_reason text,max_attempts integer,UNIQUE(tenant_id,dedupe_key));
 CREATE TABLE audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,actor_email text,action text,entity_type text,entity_id text,source text,metadata jsonb);
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 GRANT SELECT,INSERT ON storage.objects TO authenticated;
 CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$;
 INSERT INTO tenants(id,status,config) VALUES('${a}','active','{"modules":{"social-marketing":true}}'),('${b}','active','{"modules":{"social-marketing":true}}');
 INSERT INTO auth.users VALUES('${a}','owner@example.test'),('${b}','other@example.test');
 INSERT INTO tenant_memberships VALUES('${a}','${a}','active','admin'),('${b}','${b}','active','admin');
 INSERT INTO integration_connections(tenant_id,provider,status,account_email,credential_version) VALUES('${a}','postiz','connected','org-a',1),('${b}','postiz','connected','org-b',1);
 GRANT USAGE ON SCHEMA public,private,auth,storage TO authenticated,service_role; GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role; GRANT SELECT ON auth.users TO service_role;
 `);
  const tenancy = readFileSync("migrations/20260830-shared-database-tenancy.sql", "utf8");
  sql(
    tenancy.slice(
      tenancy.indexOf("CREATE OR REPLACE FUNCTION private.request_tenant_id()"),
      tenancy.indexOf("ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;"),
    ),
  );
  sql(readFileSync("migrations/20260831-tenant-suspension-guards.sql", "utf8"));
  const migration = readFileSync("migrations/20260912170924-social-marketing.sql", "utf8");
  const privileges = readFileSync(
    "migrations/20260912190757-social-marketing-function-privileges.sql",
    "utf8",
  );
  sql(migration);
  sql(privileges);
  sql(migration);
  sql(privileges);
  assert.equal(
    sql(
      "SELECT has_function_privilege('authenticated','public.claim_social_publication(uuid,integer)','EXECUTE')",
    ),
    "f",
  );
  assert.equal(
    sql(
      "SELECT has_function_privilege('anon','public.record_social_publication(uuid,text,text,text,text,jsonb)','EXECUTE')",
    ),
    "f",
  );
  const storageContext = `SET ROLE authenticated; SET request.headers='{"x-tenant-id":"${a}"}'; SET request.jwt.claim.sub='${a}';`;
  sql(
    `${storageContext} INSERT INTO storage.objects(bucket_id,name) VALUES('workspace-media','${a}/owned.png')`,
  );
  fail(
    `${storageContext} INSERT INTO storage.objects(bucket_id,name) VALUES('workspace-media','${b}/foreign.png')`,
  );
  sql(`INSERT INTO storage.objects(bucket_id,name) VALUES('workspace-media','${b}/private.png')`);
  assert.equal(
    sql(`${storageContext} SELECT count(*) FROM storage.objects`),
    "1",
    "Storage reads must exclude another workspace",
  );
  const stamp = (t) => sql(`SELECT updated_at FROM tenants WHERE id='${t}'`);
  const command = (change, key = randomUUID(), t = a, action = null) =>
    `${ctx(t)} SELECT execute_social_command('${key}',${json(change)},${lit(stamp(t))},'owner@example.test',${action ? lit(action) : "NULL"});`;
  const execute = (change, key = randomUUID(), t = a, action = null) =>
    JSON.parse(sql(command(change, key, t, action)));
  const id = randomUUID();
  const draft = {
    id,
    revision: 0,
    title: "Controlled draft",
    content: "Verified source excerpt",
    channelId: "page-a",
    scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    timeZone: "America/Chicago",
    sources: [
      {
        title: "Fictional source",
        url: "https://example.test",
        excerpt: "Verified source excerpt",
      },
    ],
    mediaId: null,
  };
  const save = { operation: "save", drafts: [draft] };
  const op = randomUUID();
  const first = execute(save, op);
  assert.equal(execute(save, op).id, first.id);
  fail(command({ ...save, drafts: [{ ...draft, title: "Changed" }] }, op));
  fail(command({ operation: "save", drafts: [{ ...draft, revision: 1 }] }, randomUUID(), b));
  const other = randomUUID();
  execute({ operation: "save", drafts: [{ ...draft, id: other }] }, randomUUID(), b);
  const sharedMedia = randomUUID();
  sql(
    `INSERT INTO media_assets(id,tenant_id,storage_path,content_hash,mime_type,size_bytes) VALUES('${sharedMedia}','${b}','${b}/image','${"a".repeat(64)}','image/png',8)`,
  );
  fail(
    command({ operation: "save", drafts: [{ ...draft, id: randomUUID(), mediaId: sharedMedia }] }),
  );
  fail(
    `INSERT INTO integration_connections(tenant_id,provider,status,account_email,credential_version) VALUES('${b}','postiz','connected','org-a',1)`,
  );
  const schedule = { operation: "schedule", posts: [{ id, revision: 1 }] };
  fail(command(schedule));
  const approval = randomUUID();
  sql(
    `INSERT INTO action_queue VALUES('${approval}','${a}','social_marketing_change','executing','owner@example.test',now(),${json({ change: schedule, connection: { version: 1, organizationId: "org-a" } })})`,
  );
  execute(schedule, randomUUID(), a, approval);
  assert.equal(
    sql(`SELECT count(*) FROM work_items WHERE tenant_id='${a}' AND entity_id='${id}'`),
    "1",
  );
  execute({
    operation: "save",
    drafts: [{ ...draft, revision: 1, content: "Edited approved draft" }],
  });
  assert.equal(
    sql(`SELECT state||':'||(approval_id IS NULL) FROM social_posts WHERE id='${id}'`),
    "draft:true",
  );
  fail(command(schedule, randomUUID(), a, approval));
  const schedule2 = { operation: "schedule", posts: [{ id, revision: 2 }] };
  sql(
    `UPDATE action_queue SET payload=${json({ change: schedule2, connection: { version: 1, organizationId: "org-a" } })} WHERE id='${approval}'`,
  );
  execute(schedule2, randomUUID(), a, approval);
  sql(`UPDATE social_posts SET scheduled_at=now()-interval '1 second' WHERE id='${id}'`);
  const claims = await Promise.all(
    [1, 2].map(() => concurrent(`${ctx()}SELECT claim_social_publication('${id}',2);`)),
  );
  const parsed = claims.map((v) => JSON.parse(v));
  assert.equal(parsed.filter((v) => v.claimed).length, 1);
  const attempt = parsed.find((v) => v.claimed).attempt;
  assert.equal(sql(`${ctx()}SELECT assert_social_dispatch('${attempt.id}')`), "t");
  sql(`UPDATE tenant_memberships SET status='revoked' WHERE tenant_id='${a}'`);
  assert.equal(sql(`${ctx()}SELECT assert_social_dispatch('${attempt.id}')`), "f");
  sql(`UPDATE tenant_memberships SET status='active' WHERE tenant_id='${a}'`);
  sql(`${ctx()}SELECT record_social_publication('${attempt.id}','unknown',NULL,NULL,'Timeout')`);
  assert.equal(
    JSON.parse(sql(`${ctx()}SELECT claim_social_publication('${id}',2)`)).claimed,
    false,
  );
  fail(`${ctx()}SELECT record_social_publication('${attempt.id}','published','provider-id',NULL)`);
  fail(
    `${ctx(b)}SELECT record_social_publication('${attempt.id}','published','provider-id','https://www.linkedin.com/feed/update/fixture')`,
  );
  sql(`${ctx()}SELECT record_social_publication('${attempt.id}','submitted','provider-id')`);
  sql(
    `${ctx()}SELECT record_social_publication('${attempt.id}','published','provider-id','https://www.linkedin.com/feed/update/fixture')`,
  );
  fail(`${ctx()}SELECT record_social_publication('${attempt.id}','submitted','different-id')`);
  fail(`UPDATE social_post_revisions SET draft='{}'`);
  assert.equal(
    sql(
      `SET ROLE authenticated; SET request.headers='{"x-tenant-id":"${b}"}'; SET request.jwt.claim.sub='${b}'; SELECT count(*) FROM social_posts WHERE tenant_id='${a}'`,
    ),
    "0",
  );
  fail(`SET ROLE authenticated; ${command(save)}`.replace("SET ROLE service_role;", ""));
  console.log(
    "Passed: idempotent migration, tenant RLS/media/organization separation, exact approval, edit invalidation, durable work item, concurrent one-time dispatch, late revocation, unknown outcome fencing, truthful publication URL, immutable history and service-only writes.",
  );
} finally {
  if (started) run("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
  rmSync(root, { recursive: true, force: true });
}
