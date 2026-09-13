import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Runs inside the existing disposable PostgreSQL harness, never a live project. */
export async function proveAutonomyPolicyWrites({ sql, asyncSql, context, a, b }) {
  const migration = readFileSync("migrations/20260912230431-autonomy-policy-writes.sql", "utf8");
  const register = (
    key,
    level = "always_ask",
    coworker = "NULL",
    constraints = "{}",
    source = "system",
    floor = false,
  ) =>
    `SELECT upsert_autonomy_policy('${key}','Fixture','${level}',NULL,'${constraints}',${coworker},'${source}',${floor})`;
  const grant = (key, coworker = "NULL", actor = "human@example.test", constraints = "{}") =>
    `SELECT grant_standing_permission('${key}',${coworker},'${actor}','${constraints}')`;
  const current = (key, coworker = "NULL", tenant = a) =>
    JSON.parse(
      sql(`${context(tenant)} SELECT row_to_json(r) FROM check_autonomy('${key}',${coworker}) r`),
    );
  const readDefinition = sql(
    "SELECT pg_get_functiondef('public.check_autonomy(text,text)'::regprocedure)",
  );
  const legacy = [
    sql(`${context()} ${register("fixture.legacy")}`),
    sql(`${context()} ${register("fixture.legacy")}`),
  ];
  assert.equal(new Set(legacy).size, 2, "before: NULL registrations create duplicate identities");
  assert.throws(
    () => sql(`${context()} ${grant("fixture.legacy")}`),
    /more than one row/,
    "before: supported grant fails on duplicates",
  );
  const historicalIds = sql(
    "SELECT jsonb_agg(jsonb_build_object('id',id,'created_at',created_at) ORDER BY created_at,id) FROM autonomy_policies WHERE action_key='fixture.legacy'",
  );
  sql(`CREATE TABLE IF NOT EXISTS public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,actor_email text,action text NOT NULL,entity_type text NOT NULL,entity_id text,source text NOT NULL DEFAULT 'admin',before_state jsonb,after_state jsonb,metadata jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
    INSERT INTO audit_log(tenant_id,action,entity_type,metadata) VALUES('${a}','fixture.immutable','autonomy_policy','{"prior":true}');`);
  const auditBefore = sql(
    "SELECT row_to_json(a) FROM audit_log a WHERE action='fixture.immutable'",
  );
  sql(migration);
  sql(migration);
  assert.equal(
    sql("SELECT pg_get_functiondef('public.check_autonomy(text,text)'::regprocedure)"),
    readDefinition,
    "effective reader is byte-identical",
  );
  assert.equal(
    sql("SELECT row_to_json(a) FROM audit_log a WHERE action='fixture.immutable'"),
    auditBefore,
  );
  assert.equal(sql(`${context()} ${register("fixture.legacy")}`), legacy[0]);
  assert.equal(sql(`${context()} ${grant("fixture.legacy")}`), legacy[0]);
  assert.equal(current("fixture.legacy").allowed, true);
  assert.equal(
    sql(
      "SELECT count(*) FROM autonomy_policies WHERE action_key='fixture.legacy' AND approved_by='human@example.test'",
    ),
    "2",
  );
  assert.equal(
    sql(
      "SELECT jsonb_agg(jsonb_build_object('id',id,'created_at',created_at) ORDER BY created_at,id) FROM autonomy_policies WHERE action_key='fixture.legacy'",
    ),
    historicalIds,
  );
  const audit = JSON.parse(
    sql(
      "SELECT row_to_json(a) FROM audit_log a WHERE action='autonomy_policy.scope_approved' ORDER BY created_at DESC LIMIT 1",
    ),
  );
  assert.equal(audit.actor_email, "human@example.test");
  assert.deepEqual(
    audit.before_state.map((r) => r.level),
    ["always_ask", "always_ask"],
  );
  assert.deepEqual(
    audit.after_state.map((r) => r.level),
    ["standing_permission", "standing_permission"],
  );
  assert.equal(
    sql(`${context()} ${register("fixture.legacy", "always_ask")}`),
    legacy[0],
    "supported registration revokes",
  );
  assert.equal(current("fixture.legacy").requires_approval, true);
  assert.equal(
    sql(
      "SELECT count(*) FROM autonomy_policies WHERE action_key='fixture.legacy' AND approved_by IS NULL AND approved_at IS NULL",
    ),
    "2",
  );
  assert.equal(
    sql(`${context()} ${grant("fixture.legacy")}`),
    legacy[0],
    "supported regrant succeeds",
  );
  assert.equal(
    sql(`${context()} ${grant("fixture.legacy")}`),
    legacy[0],
    "repeated explicit grant returns same identity",
  );

  const concurrent = await Promise.all(
    Array.from({ length: 8 }, () => asyncSql(`${context()} ${register("fixture.concurrent")}`)),
  );
  assert.equal(new Set(concurrent).size, 1);
  assert.equal(
    sql("SELECT count(*) FROM autonomy_policies WHERE action_key='fixture.concurrent'"),
    "1",
  );
  await Promise.all([
    asyncSql(`${context()} ${grant("fixture.legacy")}`),
    asyncSql(`${context()} ${register("fixture.legacy")}`),
  ]);
  assert.equal(
    sql(
      "SELECT count(DISTINCT (level,approved_by,approved_at,constraints)) FROM autonomy_policies WHERE action_key='fixture.legacy'",
    ),
    "1",
    "concurrent revoke/grant leaves a coherent exact scope",
  );
  sql(`${context()} ${grant("fixture.legacy")}`);
  const approval = sql(
    "SELECT jsonb_agg(approved_at ORDER BY id) FROM autonomy_policies WHERE action_key='fixture.legacy'",
  );
  sql(
    `${context()} SELECT upsert_autonomy_policy('fixture.legacy','Renamed','standing_permission','Description only','{}',NULL,'system',false)`,
  );
  assert.equal(
    sql(
      "SELECT jsonb_agg(approved_at ORDER BY id) FROM autonomy_policies WHERE action_key='fixture.legacy'",
    ),
    approval,
    "label-only edits retain approval",
  );
  sql(`${context()} ${register("fixture.legacy", "standing_permission", "NULL", '{"limit":2}')}`);
  assert.equal(
    current("fixture.legacy").requires_approval,
    true,
    "material constraints edit clears approval",
  );
  assert.equal(
    sql(
      "SELECT count(*) FROM autonomy_policies WHERE action_key='fixture.legacy' AND approved_at IS NULL",
    ),
    "2",
  );
  sql(`${context()} ${grant("fixture.legacy", "NULL", "human@example.test", '{"unknown":true}')}`);
  assert.equal(
    current("fixture.legacy").requires_approval,
    true,
    "unknown constraints remain fail-closed",
  );
  sql(`${context()} ${grant("fixture.legacy")}`);
  sql(
    `${context()} ${register("fixture.legacy", "standing_permission", "NULL", "{}", "updated-source")}`,
  );
  assert.equal(
    current("fixture.legacy").requires_approval,
    true,
    "material source edit clears approval",
  );

  const otherTenant = sql(`${context(b)} ${register("fixture.legacy")}`);
  const coworker = sql(`${context()} ${register("fixture.legacy", "always_ask", "'sales'")}`);
  assert.notEqual(otherTenant, legacy[0]);
  assert.notEqual(coworker, legacy[0]);
  sql(`${context()} ${grant("fixture.legacy", "'sales'")}`);
  assert.equal(current("fixture.legacy", "'sales'").allowed, true);
  assert.equal(
    current("fixture.legacy").requires_approval,
    true,
    "coworker grant does not change generic policy",
  );
  assert.equal(current("fixture.legacy", "NULL", b).requires_approval, true, "tenant B unchanged");
  sql(
    `INSERT INTO coworkers(id,tenant_id,name) VALUES('foreign-policy-worker','${b}','Foreign fixture')`,
  );
  assert.throws(
    () =>
      sql(`${context()} ${register("fixture.foreign", "always_ask", "'foreign-policy-worker'")}`),
    /foreign key/,
  );

  sql(`${context()} ${register("fixture.floor", "always_ask", "NULL", "{}", "system", true)}`);
  assert.throws(
    () => sql(`${context()} ${register("fixture.floor")}`),
    /hard floor cannot be downgraded/,
  );
  assert.throws(() => sql(`${context()} ${grant("fixture.floor")}`), /hard floor/);
  sql(`${context()} ${register("fixture.floor", "always_ask", "'sales'")}`);
  assert.throws(
    () => sql(`${context()} ${grant("fixture.floor", "'sales'")}`),
    /hard floor/,
    "generic floor applies to coworker grant",
  );
  assert.throws(
    () => sql(`${context(b)} ${register("credential.change", "autonomous")}`),
    /hard floor/,
  );
  sql(`${context()} ${register("fixture.prohibited", "prohibited")}`);
  assert.throws(() => sql(`${context()} ${grant("fixture.prohibited")}`), /prohibited/);
  assert.throws(
    () => sql(`${context()} ${grant("fixture.legacy", "NULL", "  ")}`),
    /explicit human approver/,
  );
  assert.throws(
    () => sql(`${context()} ${register("fixture.invalid", "always_ask", "NULL", "[]")}`),
    /Invalid/,
  );
  assert.throws(
    () =>
      sql(
        `${context()} BEGIN ISOLATION LEVEL REPEATABLE READ; ${register("fixture.snapshot")}; COMMIT;`,
      ),
    /READ COMMITTED/,
  );
  assert.throws(
    () =>
      sql(
        `SET request.headers='{}';SET request.jwt.claim.role='service_role';SET ROLE service_role;${grant("fixture.legacy")}`,
      ),
    /tenant/i,
  );
  for (const role of ["anon", "authenticated"]) {
    assert.throws(
      () =>
        sql(
          `SET request.headers='{"x-tenant-id":"${a}"}'; SET request.jwt.claim.role='${role}';SET request.jwt.claim.sub='${a}';SET ROLE ${role};${register("fixture.denied")}`,
        ),
      /permission denied/,
    );
    assert.throws(
      () =>
        sql(
          `SET request.headers='{"x-tenant-id":"${a}"}'; SET request.jwt.claim.role='${role}';SET request.jwt.claim.sub='${a}';SET ROLE ${role};${grant("fixture.legacy")}`,
        ),
      /permission denied/,
    );
  }
  sql(`UPDATE tenants SET status='suspended' WHERE id='${b}'`);
  assert.throws(
    () => sql(`${context(b)} ${grant("fixture.legacy")}`),
    /suspended|inactive|forbidden|unavailable/i,
  );
  sql(`UPDATE tenants SET status='active' WHERE id='${b}'`);
  assert.equal(
    sql("SELECT row_to_json(a) FROM audit_log a WHERE action='fixture.immutable'"),
    auditBefore,
  );
  console.log(
    "PASS: policy writes reproduce NULL duplicate/grant failure before migration; preserve legacy IDs/history; converge concurrent scopes; revoke/regrant; clear material approval; retain strict reads, hard floors and tenant/role authorization.",
  );
}
