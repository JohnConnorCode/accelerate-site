import { WORKSHOP_EVENT, WORKSHOP_EVENT_ID } from "../src/content/workshops.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";

const root = mkdtempSync(join(tmpdir(), "event-ticketing-pg-"));
const data = join(root, "data");
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const value = server.address().port;
    server.close(() => resolve(value));
  });
});
const executable = (name) =>
  process.env.EVENT_TICKETING_PG_BIN ? join(process.env.EVENT_TICKETING_PG_BIN, name) : name;
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
function run(command, argv, input) {
  const result = spawnSync(executable(command), argv, { encoding: "utf8", input });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}
const sql = (input) => run("psql", args, input);
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => literal(JSON.stringify(value)) + "::jsonb";
const a = "acce1e8e-0000-4000-8000-000000000001",
  b = "22222222-2222-4222-8222-222222222222";
const context = (
  tenant = a,
  role = "service_role",
  user = "11111111-1111-4111-8111-111111111111",
) =>
  `SET request.headers='{"x-tenant-id":"${tenant}"}'; SET request.jwt.claim.sub='${user}'; SET ROLE ${role};`;
function fail(input, expected) {
  const result = spawnSync(executable("psql"), args, { encoding: "utf8", input });
  assert.notEqual(result.status, 0, "unsafe SQL unexpectedly succeeded");
  assert.match(result.stderr, expected);
}
const asyncSql = (input) =>
  new Promise((resolve, reject) => {
    const child = spawn(executable("psql"), args);
    let output = "",
      error = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (error += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output: output.trim(), error }));
    child.stdin.end(input);
  });
const save = (event, revision, requestId = randomUUID(), tenant = a, id = WORKSHOP_EVENT_ID) =>
  context(tenant) +
  `SELECT public.save_ticket_event('${id}',${revision},${json(event)},'${requestId}','owner@example.test');`;
const reserve = (
  requestId = randomUUID(),
  quantity = 4,
  revision = 2,
  tenant = a,
  slug = WORKSHOP_EVENT.slug,
  digest = "a".repeat(64),
  mode = true,
) =>
  context(tenant) +
  `SELECT public.reserve_event_order(${literal(slug)},'${requestId}',${quantity},${revision},'Workshop buyer','buyer@example.test','${digest}','{}','acct_fixture',${mode});`;
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
    CREATE TABLE public.tenants(id uuid PRIMARY KEY,status text,config jsonb);
    CREATE TABLE public.tenant_memberships(tenant_id uuid,user_id uuid,status text);
    CREATE TABLE public.audit_log(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,actor_email text,action text,entity_type text,entity_id text,source text,metadata jsonb);
    CREATE TABLE public.messages(tenant_id uuid,idempotency_key text,status text,provider_id text);
    GRANT SELECT ON public.messages TO service_role;
    CREATE FUNCTION private.request_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (current_setting('request.headers',true)::jsonb->>'x-tenant-id')::uuid $$;
    CREATE FUNCTION private.has_active_tenant_membership(t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.tenant_memberships m JOIN public.tenants n ON n.id=m.tenant_id WHERE m.tenant_id=t AND m.user_id=current_setting('request.jwt.claim.sub',true)::uuid AND m.status='active' AND n.status='active') $$;
    CREATE FUNCTION private.authorized_request_tenant_id() RETURNS uuid LANGUAGE plpgsql AS $$ DECLARE t uuid; BEGIN t:=private.request_tenant_id(); IF current_user<>'service_role' OR t IS NULL OR NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=t AND status='active') THEN RAISE EXCEPTION 'tenant access forbidden'; END IF; RETURN t; END $$;
    GRANT USAGE ON SCHEMA private TO authenticated,service_role;
    GRANT SELECT,INSERT ON public.audit_log TO service_role;
    GRANT SELECT ON public.tenants TO service_role;
    INSERT INTO public.tenants VALUES('${a}','active','{"brand":{"domain":"harbor.example"}}'),('${b}','active','{"modules":{"event-ticketing":true}}');
    INSERT INTO public.tenant_memberships VALUES('${a}','11111111-1111-4111-8111-111111111111','active');`);
  const migration = readFileSync(
    new URL("../migrations/20261016200534_event_ticketing.sql", import.meta.url),
    "utf8",
  );
  sql(migration);
  assert.equal(sql("SELECT count(*) FROM ticket_events"), "0", "Forks retain no agency event seed");
  assert.equal(
    sql(`SELECT config->'modules'->>'event-ticketing' IS NULL FROM tenants WHERE id='${a}'`),
    "t",
    "Forks retain the optional module's disabled default",
  );
  sql(
    `UPDATE tenants SET config='{"brand":{"name":"Recovery proof","domain":"acceleratewith.us"}}' WHERE id='${a}'`,
  );
  sql(migration);
  assert.equal(
    sql("SELECT count(*) FROM ticket_events"),
    "0",
    "A customized bootstrap identity remains unchanged",
  );
  assert.equal(
    sql(`SELECT config->'modules'->>'event-ticketing' IS NULL FROM tenants WHERE id='${a}'`),
    "t",
  );
  sql(
    `UPDATE tenants SET config='{"brand":{"name":"Accelerate","domain":"acceleratewith.us"}}' WHERE id='${a}'`,
  );
  sql(migration);
  sql(migration);
  assert.equal(sql(`SELECT count(*) FROM ticket_events WHERE id='${WORKSHOP_EVENT_ID}'`), "1");
  assert.equal(sql(`SELECT status FROM ticket_events WHERE id='${WORKSHOP_EVENT_ID}'`), "draft");

  const future = Date.now() + 7 * 86400000;
  const published = {
    ...WORKSHOP_EVENT,
    starts_at: new Date(future).toISOString(),
    ends_at: new Date(future + 90 * 60000).toISOString(),
    refund_cutoff: new Date(future - 48 * 3600000).toISOString(),
    status: "published",
  };
  const saveKey = randomUUID();
  const saved = JSON.parse(sql(save(published, 1, saveKey)));
  assert.equal(saved.revision, 2);
  assert.equal(
    JSON.parse(sql(save(published, 1, saveKey))).revision,
    2,
    "lost-response retry returns the original receipt",
  );
  fail(save({ ...published, price_cents: 7500 }, 1, saveKey), /already used/);
  fail(save(published, 1), /changed/);
  fail(save({ ...published, timezone: "Invalid/TimeZone" }, 2), /Invalid event time zone/);
  fail(
    context(a, "authenticated") +
      `SELECT save_ticket_event('${WORKSHOP_EVENT_ID}',2,${json(published)},'${randomUUID()}','owner@example.test');`,
    /permission denied/,
  );
  fail(context(a, "anon") + "SELECT * FROM ticket_orders;", /permission denied/);
  fail(
    context(a, "authenticated") + `UPDATE ticket_events SET price_cents=1;`,
    /permission denied/,
  );

  const races = await Promise.all(Array.from({ length: 12 }, () => asyncSql(reserve())));
  assert.equal(races.filter((result) => result.code === 0).length, 10, JSON.stringify(races));
  assert.ok(
    races
      .filter((result) => result.code !== 0)
      .every((result) => /Not enough tickets/.test(result.error)),
  );
  assert.equal(sql(`SELECT sum(quantity) FROM ticket_orders WHERE tenant_id='${a}'`), "40");
  assert.equal(
    sql(`SELECT available_tickets FROM ticket_event_availability WHERE id='${WORKSHOP_EVENT_ID}'`),
    "0",
  );
  fail(save({ ...published, capacity: 39 }, 2), /Capacity cannot be below/);
  const first = JSON.parse(races.find((result) => result.code === 0).output);
  assert.equal(first.unit_price_cents, 5000);
  const observation = {
    state: "paid",
    session_id: "cs_test_fixture",
    account_id: "acct_fixture",
    livemode: true,
    currency: "usd",
    quantity: 4,
    total_cents: 20000,
    payment_intent_id: "pi_fixture",
    refund_cents: 0,
  };
  const observe = (value, external = "evt_fixture", tenant = a) =>
    context(tenant) +
    `SELECT observe_event_payment('${first.id}',${literal(external)},${json(value)});`;
  fail(observe({ ...observation, quantity: 1 }), /does not match/);
  fail(observe({ ...observation, total_cents: 1 }), /does not match/);
  fail(observe({ ...observation, account_id: "acct_other" }), /does not match/);
  fail(observe({ ...observation, livemode: false }), /does not match/);
  fail(observe(observation, "evt_other_tenant", b), /Order not found/);
  assert.equal(JSON.parse(sql(observe(observation))).state, "paid");
  fail(
    context() + `SELECT record_ticket_confirmation('${first.id}','sent',NULL);`,
    /recorded provider email receipt/,
  );
  sql(
    `INSERT INTO messages VALUES('${a}','event-ticket-confirmation:${a}:${first.id}','sent','email_fixture');`,
  );
  assert.equal(
    JSON.parse(sql(context() + `SELECT record_ticket_confirmation('${first.id}','sent',NULL);`))
      .email_status,
    "sent",
  );
  fail(
    context(a, "authenticated") + `SELECT record_ticket_confirmation('${first.id}','sent',NULL);`,
    /permission denied/,
  );
  sql(observe(observation));
  assert.equal(sql(`SELECT count(*) FROM ticket_order_receipts WHERE order_id='${first.id}'`), "1");
  assert.equal(
    sql(`SELECT paid_tickets FROM ticket_event_availability WHERE id='${WORKSHOP_EVENT_ID}'`),
    "4",
  );
  assert.equal(
    sql(`SELECT gross_cents FROM ticket_event_availability WHERE id='${WORKSHOP_EVENT_ID}'`),
    "20000",
  );
  assert.equal(
    JSON.parse(sql(observe({ ...observation, refund_cents: 5000 }, "evt_partial"))).state,
    "paid",
  );
  assert.equal(
    JSON.parse(sql(observe({ ...observation, refund_cents: 20000 }, "evt_refund"))).state,
    "refunded",
  );
  assert.equal(
    sql(`SELECT available_tickets FROM ticket_event_availability WHERE id='${WORKSHOP_EVENT_ID}'`),
    "4",
  );
  assert.equal(
    JSON.parse(sql(observe(observation, "evt_late_payment"))).state,
    "refunded",
    "late callbacks cannot undo a refund",
  );

  const repriced = JSON.parse(sql(save({ ...published, price_cents: 7500 }, 2)));
  assert.equal(repriced.revision, 3);
  fail(reserve(randomUUID(), 1, 2), /Event changed/);
  const newOrder = JSON.parse(sql(reserve(randomUUID(), 4, 3)));
  assert.equal(newOrder.unit_price_cents, 7500);
  assert.equal(sql(`SELECT unit_price_cents FROM ticket_orders WHERE id='${first.id}'`), "5000");
  assert.equal(
    sql(`SELECT event_snapshot->>'refund_policy' FROM ticket_orders WHERE id='${first.id}'`),
    WORKSHOP_EVENT.refund_policy,
  );
  sql(save({ ...published, price_cents: 7500, status: "paused" }, 3));
  fail(reserve(randomUUID(), 1, 4), /sales are closed/);

  const secondaryId = randomUUID();
  sql(save(published, 0, randomUUID(), b, secondaryId));
  const sharedKey = randomUUID();
  const sameRequests = await Promise.all(
    Array.from({ length: 6 }, () => asyncSql(reserve(sharedKey, 2, 1, b))),
  );
  assert.ok(sameRequests.every((result) => result.code === 0));
  assert.equal(new Set(sameRequests.map((result) => JSON.parse(result.output).id)).size, 1);
  assert.equal(sql(`SELECT count(*) FROM ticket_orders WHERE tenant_id='${b}'`), "1");
  fail(reserve(sharedKey, 3, 1, b, WORKSHOP_EVENT.slug, "b".repeat(64)), /already used/);
  const held = JSON.parse(sameRequests[0].output);
  fail(
    context(b) + `SELECT release_uncreated_ticket_order('${held.id}','req_complete_listing');`,
    /still requires/,
  );
  sql(`UPDATE ticket_orders SET expires_at=now()-interval '2 minutes' WHERE id='${held.id}';`);
  const expired = JSON.parse(
    sql(context(b) + `SELECT release_uncreated_ticket_order('${held.id}','req_complete_listing');`),
  );
  assert.equal(expired.state, "expired");
  fail(
    context(b) +
      `SELECT observe_event_payment('${held.id}','evt_late',${json({ ...observation, quantity: 2, total_cents: 10000 })});`,
    /Released order requires/,
  );

  sql(save({ ...published, price_cents: 7500 }, 4));
  const testOrder = JSON.parse(
    sql(reserve(randomUUID(), 4, 5, a, WORKSHOP_EVENT.slug, "c".repeat(64), false)),
  );
  sql(
    context(a) +
      `SELECT observe_event_payment('${testOrder.id}','evt_test_mode',${json({ ...observation, session_id: "cs_test_mode", payment_intent_id: "pi_testmode", livemode: false, total_cents: 30000 })});`,
  );
  assert.equal(
    sql(`SELECT gross_cents FROM ticket_event_availability WHERE id='${WORKSHOP_EVENT_ID}'`),
    "20000",
    "test payments never inflate live gross sales",
  );
  assert.equal(
    sql(`SELECT available_tickets FROM ticket_event_availability WHERE id='${WORKSHOP_EVENT_ID}'`),
    "0",
  );
  assert.equal(sql(context(b, "authenticated") + "SELECT count(*) FROM ticket_orders;"), "0");
  sql(`UPDATE tenant_memberships SET status='revoked' WHERE tenant_id='${a}';`);
  assert.equal(sql(context(a, "authenticated") + "SELECT count(*) FROM ticket_orders;"), "0");
  sql(`UPDATE tenants SET status='suspended' WHERE id='${b}';`);
  fail(reserve(randomUUID(), 1, 1, b), /tenant access forbidden/);
  fail(context(a) + "DELETE FROM ticket_order_receipts;", /permission denied/);
} finally {
  if (started) run("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
  rmSync(root, { recursive: true, force: true });
}
console.log(
  JSON.stringify({
    result: "passed",
    checks: [
      "idempotent migration and draft seed",
      "idempotent revision-checked event edits",
      "concurrent capacity cannot exceed forty",
      "parallel identical requests create one order",
      "prices and refund terms remain snapshotted",
      "payment amount/account/mode/quantity verification",
      "tenant and role denial",
      "refund replay and capacity release",
      "provider-absence recovery only after expiration",
    ],
  }),
);
