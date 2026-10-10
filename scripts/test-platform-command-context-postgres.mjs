import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
const root = mkdtempSync(join(tmpdir(), "private-command-pg-"));
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const port = server.address().port;
    server.close(() => resolve(port));
  });
});
const run = (cmd, args, input) => {
  const result = spawnSync(cmd, args, { encoding: "utf8", input, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || `Fixture command ${cmd} failed`);
  return result.stdout.trim();
};
const tables = [
  "action_queue",
  "audit_log",
  "agent_runs",
  "agent_run_events",
  "ai_conversations",
  "ai_messages",
];
const revenue = readFileSync("migrations/20260816-revenue-os.sql", "utf8");
const conversation = readFileSync("migrations/20260824-ai-command-runtime.sql", "utf8");
const definitions = ["action_queue", "agent_runs", "agent_run_events", "audit_log"]
  .map((table) => {
    const ddl = revenue.match(
      new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`),
    );
    assert.ok(ddl, `Existing schema definition required: ${table}`);
    return ddl[0];
  })
  .join("\n");
const migration = readFileSync(
  "migrations/20261007181105_platform_private_command_context.sql",
  "utf8",
);
const tenantPolicy = readFileSync("migrations/20260830-shared-database-tenancy.sql", "utf8")
  .match(/'CREATE POLICY "Tenant member access"[^\n]+/)[0]
  .slice(1, -2);
const receipts = [];
let started = false;
try {
  run("initdb", ["-D", join(root, "data"), "-A", "trust", "-U", "postgres"]);
  run("pg_ctl", [
    "-D",
    join(root, "data"),
    "-l",
    join(root, "postgres.log"),
    "-o",
    `-h 127.0.0.1 -p ${port} -k ${root} -c log_min_error_statement=panic`,
    "-w",
    "start",
  ]);
  started = true;
  const baseArgs = [
    "-X",
    "-qAt",
    "-h",
    "127.0.0.1",
    "-p",
    String(port),
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
  ];
  run(
    "psql",
    [...baseArgs, "-d", "postgres"],
    "CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;",
  );
  for (const fixture of ["fresh", "populated"]) {
    const name = `private_command_${fixture}`;
    run("createdb", ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", name]);
    const sql = (text) => run("psql", [...baseArgs, "-d", name], text);
    const tenant = randomUUID(),
      otherTenant = randomUUID(),
      founder = randomUUID(),
      member = randomUUID(),
      outsider = randomUUID();
    const prefix = (user = founder, workspace = tenant, role = "authenticated") =>
      `SET ROLE ${role}; SET app.actor='${user}'; SET app.tenant='${workspace}'; `;
    const as = (text, user, workspace, role) => sql(prefix(user, workspace, role) + text);
    let checks = 0;
    const eq = (actual, expected) => {
      assert.equal(actual, expected);
      checks++;
    };
    const refuses = (text, user = founder, workspace = tenant, role = "authenticated") => {
      assert.throws(
        () => as(text, user, workspace, role),
        /ownership|owner|parent|row-level security|same owner|workspace|permission/i,
      );
      checks++;
    };
    sql(`CREATE SCHEMA auth; CREATE SCHEMA private;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.actor',true),'')::uuid $$;
      CREATE TABLE public.tenants(id uuid PRIMARY KEY,status text);
      CREATE TABLE public.tenant_memberships(tenant_id uuid,user_id uuid,role text,status text);
      CREATE FUNCTION private.request_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.tenant',true),'')::uuid $$;
      CREATE FUNCTION private.has_active_tenant_membership(t uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.tenant_memberships m JOIN public.tenants ten ON ten.id=m.tenant_id WHERE m.tenant_id=t AND m.user_id=auth.uid() AND m.status='active' AND ten.status='active') $$;
      ${definitions}
      ${conversation}
      ALTER TABLE public.action_queue DROP CONSTRAINT action_queue_status_check;
      ALTER TABLE public.action_queue ADD CHECK(status IN ('pending','approved','executing','executed','rejected','failed','expired','denied'));
      INSERT INTO auth.users VALUES('${founder}'),('${member}'),('${outsider}');
      INSERT INTO tenants VALUES('${tenant}','active'),('${otherTenant}','active');
      INSERT INTO tenant_memberships VALUES('${tenant}','${founder}','admin','active'),('${tenant}','${member}','admin','active'),('${otherTenant}','${outsider}','admin','active');
      GRANT USAGE ON SCHEMA auth,private TO authenticated,service_role;
      GRANT SELECT ON tenants,tenant_memberships TO authenticated,service_role;`);
    for (const table of tables)
      sql(
        `ALTER TABLE public.${table} ADD COLUMN tenant_id uuid NOT NULL REFERENCES public.tenants(id); ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY; ${tenantPolicy.replace("%I", table)}; GRANT SELECT,INSERT,UPDATE,DELETE ON public.${table} TO authenticated,service_role;`,
      );
    const conv = randomUUID(),
      runId = randomUUID(),
      action = randomUUID();
    const sharedConv = randomUUID(),
      sharedRun = randomUUID(),
      foreignConv = randomUUID();
    const seeds = `INSERT INTO ai_conversations(id,tenant_id,actor_email) VALUES('${sharedConv}','${tenant}','controlled@example.test'),('${foreignConv}','${otherTenant}','controlled@example.test');
      INSERT INTO agent_runs(id,tenant_id,conversation_id) VALUES('${sharedRun}','${tenant}','${sharedConv}');
      INSERT INTO action_queue(id,tenant_id,action_type,title) VALUES('${randomUUID()}','${tenant}','update_next_action','Shared');
      INSERT INTO ai_messages(tenant_id,conversation_id,role,content,run_id) VALUES('${tenant}','${sharedConv}','user','Controlled','${sharedRun}');
      INSERT INTO agent_run_events(tenant_id,run_id,event_type) VALUES('${tenant}','${sharedRun}','controlled');
      INSERT INTO audit_log(tenant_id,action,entity_type) VALUES('${tenant}','controlled','controlled');`;
    if (fixture === "populated") sql(seeds);
    const policyBefore = sql(
      "SELECT coalesce(jsonb_agg(jsonb_build_array(tablename,policyname,qual,with_check) ORDER BY tablename,policyname),'[]') FROM pg_policies WHERE policyname='Tenant member access'",
    );
    sql(migration);
    sql(migration);
    eq(
      sql(
        "SELECT coalesce(jsonb_agg(jsonb_build_array(tablename,policyname,qual,with_check) ORDER BY tablename,policyname),'[]') FROM pg_policies WHERE policyname='Tenant member access'",
      ),
      policyBefore,
    );
    eq(
      sql(
        "SELECT count(*) FROM pg_policies WHERE policyname='Private command owner' AND permissive='RESTRICTIVE'",
      ),
      "6",
    );
    eq(
      sql(
        "SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.proname IN ('guard_command_ownership','guard_private_command_claim') AND NOT p.prosecdef AND p.proconfig=ARRAY['search_path=\"\"']",
      ),
      "2",
    );
    if (fixture === "fresh") sql(seeds);
    for (const table of tables)
      eq(as(`SELECT count(*) FROM ${table} WHERE platform_owner_user_id IS NULL`, member), "1");
    as(`INSERT INTO ai_conversations(id,tenant_id,actor_email,platform_owner_user_id) VALUES('${conv}','${tenant}','controlled@example.test','${founder}');
      INSERT INTO agent_runs(id,tenant_id,conversation_id) VALUES('${runId}','${tenant}','${conv}');
      INSERT INTO agent_run_events(tenant_id,run_id,event_type) VALUES('${tenant}','${runId}','controlled');
      INSERT INTO ai_messages(tenant_id,conversation_id,run_id,role,content) VALUES('${tenant}','${conv}','${runId}','user','Controlled');
      INSERT INTO action_queue(id,tenant_id,action_type,title,platform_owner_user_id) VALUES('${action}','${tenant}','update_next_action','Controlled','${founder}');
      INSERT INTO audit_log(tenant_id,action,entity_type,entity_id) VALUES('${tenant}','controlled','action_queue','${action}');`);
    for (const table of tables) {
      eq(as(`SELECT count(*) FROM ${table} WHERE platform_owner_user_id='${founder}'`), "1");
      for (const [user, workspace] of [
        [member, tenant],
        [outsider, otherTenant],
        [founder, otherTenant],
      ]) {
        eq(
          as(
            `SELECT count(*) FROM ${table} WHERE platform_owner_user_id='${founder}'`,
            user,
            workspace,
          ),
          "0",
        );
        eq(
          as(
            `WITH changed AS (UPDATE ${table} SET platform_owner_user_id=NULL WHERE platform_owner_user_id='${founder}' RETURNING id) SELECT count(*) FROM changed`,
            user,
            workspace,
          ),
          "0",
        );
        eq(
          as(
            `WITH changed AS (DELETE FROM ${table} WHERE platform_owner_user_id='${founder}' RETURNING id) SELECT count(*) FROM changed`,
            user,
            workspace,
          ),
          "0",
        );
      }
      refuses(
        `UPDATE ${table} SET platform_owner_user_id=NULL WHERE platform_owner_user_id='${founder}'`,
      );
      refuses(
        `UPDATE ${table} SET platform_owner_user_id='${member}' WHERE platform_owner_user_id='${founder}'`,
      );
      refuses(
        `UPDATE ${table} SET tenant_id='${otherTenant}' WHERE platform_owner_user_id='${founder}'`,
      );
    }
    refuses(
      `INSERT INTO agent_run_events(tenant_id,run_id,event_type) VALUES('${tenant}','${runId}','guessed')`,
      member,
    );
    refuses(
      `INSERT INTO ai_messages(tenant_id,conversation_id,role,content) VALUES('${tenant}','${conv}','user','Controlled')`,
      member,
    );
    refuses(
      `INSERT INTO agent_runs(tenant_id,conversation_id) VALUES('${tenant}','${conv}')`,
      member,
    );
    refuses(
      `INSERT INTO ai_messages(tenant_id,conversation_id,run_id,role,content) VALUES('${tenant}','${sharedConv}','${runId}','user','Controlled')`,
    );
    refuses(
      `INSERT INTO ai_messages(tenant_id,conversation_id,run_id,role,content) VALUES('${tenant}','${conv}','${sharedRun}','user','Controlled')`,
    );
    refuses(
      `INSERT INTO agent_runs(tenant_id,conversation_id) VALUES('${tenant}','${foreignConv}')`,
    );
    refuses(
      `INSERT INTO agent_run_events(tenant_id,run_id,event_type,platform_owner_user_id) VALUES('${tenant}','${runId}','controlled','${member}')`,
    );
    refuses(
      `UPDATE agent_run_events SET run_id='${sharedRun}' WHERE platform_owner_user_id='${founder}'`,
    );
    refuses(
      `UPDATE ai_messages SET conversation_id='${sharedConv}' WHERE platform_owner_user_id='${founder}'`,
    );
    refuses(`UPDATE action_queue SET status='executing' WHERE id='${action}'`);
    // Even an internal service actor cannot bypass human approval.
    refuses(
      `UPDATE action_queue SET status='executing',approved_by='controlled@example.test',approved_at=now() WHERE id='${action}'`,
      outsider,
      tenant,
      "service_role",
    );
    sql(`UPDATE tenant_memberships SET status='revoked' WHERE user_id='${founder}'`);
    eq(
      as(
        `WITH changed AS (UPDATE action_queue SET status='executing',approved_by='controlled@example.test',approved_at=now() WHERE id='${action}' RETURNING id) SELECT count(*) FROM changed`,
      ),
      "0",
    );
    sql(`UPDATE tenant_memberships SET status='active' WHERE user_id='${founder}'`);
    eq(
      as(
        `WITH changed AS (UPDATE action_queue SET status='executing',approved_by='controlled@example.test',approved_at=now() WHERE id='${action}' AND status='pending' RETURNING id) SELECT count(*) FROM changed`,
      ),
      "1",
    );
    eq(
      as(
        `WITH changed AS (UPDATE action_queue SET status='executing' WHERE id='${action}' AND status='pending' RETURNING id) SELECT count(*) FROM changed`,
      ),
      "0",
    );
    // Parent deletion retains private visibility on nullable links; owned
    // children cascade as before without becoming shared.
    as(`DELETE FROM agent_runs WHERE id='${runId}'`);
    eq(
      as(
        "SELECT count(*) FROM ai_messages WHERE run_id IS NULL AND platform_owner_user_id IS NOT NULL",
      ),
      "1",
    );
    as(`DELETE FROM ai_conversations WHERE id='${conv}'`);
    eq(sql("SELECT count(*) FROM ai_messages WHERE platform_owner_user_id IS NOT NULL"), "0");
    receipts.push({ fixture, checks, migrationApplications: 2, status: "passed" });
    console.log(`Private command PostgreSQL ${fixture}: ${checks} checks passed`);
  }
  writeFileSync(
    join(tmpdir(), "accelerate-private-command-postgres.json"),
    JSON.stringify({ status: "passed", receipts }, null, 2) + "\n",
    { mode: 0o600 },
  );
} finally {
  if (started)
    spawnSync("pg_ctl", ["-D", join(root, "data"), "-m", "immediate", "-w", "stop"], {
      encoding: "utf8",
    });
  rmSync(root, { recursive: true, force: true });
}
