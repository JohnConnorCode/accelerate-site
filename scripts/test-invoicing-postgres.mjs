// Disposable PostgreSQL proof for workspace-owned invoices: the migration runs
// twice, drafts/issue/payment/close transitions are atomic and tenant-scoped,
// numbering never repeats, a paid invoice never regresses, and Collections
// read balances from the invoices table rather than a caller-supplied value.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

const root = mkdtempSync(join(tmpdir(), "invoicing-pg-"));
const data = join(root, "data");
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const value = server.address().port;
    server.close(() => resolve(value));
  });
});
const bin = (name) => (process.env.INVOICING_PG_BIN ? join(process.env.INVOICING_PG_BIN, name) : name);
const args = ["-X", "-qAt", "-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
function run(command, argv, input) {
  const result = spawnSync(bin(command), argv, { encoding: "utf8", input });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}
const sql = (input) => run("psql", args, input);
function fail(input, expected) {
  const result = spawnSync(bin("psql"), args, { encoding: "utf8", input });
  assert.notEqual(result.status, 0, "unsafe SQL unexpectedly succeeded");
  assert.match(result.stderr, expected);
}
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => literal(JSON.stringify(value)) + "::jsonb";
const a = "acce1e8e-0000-4000-8000-000000000001",
  b = "22222222-2222-4222-8222-222222222222",
  contactA = "33333333-3333-4333-8333-333333333333",
  contactB = "44444444-4444-4444-8444-444444444444";
const as = (tenant = a) =>
  `SET request.headers='{"x-tenant-id":"${tenant}"}'; SET request.jwt.claim.role='service_role'; SET ROLE service_role;`;
const draft = (extra = {}) => ({
  contactId: contactA,
  customerName: "Example Customer",
  customerEmail: "Billing@Example.test",
  lines: [{ description: "Kickoff payment", quantity: 1, unitCents: 200000 }],
  memo: "",
  dueDate: "2020-01-01",
  paymentMethods: ["us_bank_account", "card"],
  ...extra,
});
const one = (input, tenant = a) => JSON.parse(sql(as(tenant) + input));
const save = (value, id = null, revision = null, tenant = a) =>
  one(`SELECT public.save_invoice_draft(${id ? literal(id) : "NULL"},${revision ?? "NULL"},${json(value)},'owner@example.test');`, tenant);
const issue = (id, intent, tenant = a) =>
  one(`SELECT public.issue_invoice(${literal(id)},${literal(intent)},'acct_fixture',false,${literal(createHash("sha256").update(intent).digest("hex"))},'encrypted');`, tenant);
const observe = (id, external, observation, tenant = a) =>
  one(`SELECT public.observe_invoice_payment(${literal(id)},${literal(external)},${json(observation)});`, tenant);

let started = false;
try {
  run("initdb", ["-D", data, "-A", "trust", "-U", "postgres"]);
  run("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${root}`, "-w", "start"]);
  started = true;
  sql(`CREATE EXTENSION pgcrypto;
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA private; CREATE SCHEMA auth;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
    GRANT USAGE ON SCHEMA auth TO service_role;
    CREATE TABLE public.tenants(id uuid PRIMARY KEY,status text,config jsonb);
    CREATE TABLE public.tenant_memberships(tenant_id uuid,user_id uuid,status text);
    CREATE TABLE public.contacts(id uuid PRIMARY KEY,tenant_id uuid,full_name text,UNIQUE(tenant_id,id));
    CREATE TABLE public.action_queue(id uuid PRIMARY KEY,tenant_id uuid,UNIQUE(tenant_id,id));
    CREATE TABLE public.integration_connections(tenant_id uuid,provider text,status text,account_email text,credential_version integer);
    CREATE TABLE public.activities(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,activity_type text,title text,contact_id uuid,source text,actor_email text,external_id text,metadata jsonb);
    CREATE TABLE public.audit_log(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,actor_email text,action text,entity_type text,entity_id text,before_state jsonb,after_state jsonb);
    CREATE TABLE public.work_items(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,kind text,objective text,reason text,source text,entity_type text,entity_id uuid,dedupe_key text,due_at timestamptz,next_check_at timestamptz,next_check_reason text,status text DEFAULT 'pending',outcome text,finished_at timestamptz,lease_owner text,lease_expires_at timestamptz);
    CREATE UNIQUE INDEX ON public.work_items(tenant_id,dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('pending','claimed','in_progress','waiting');
    CREATE TABLE public.invoice_pages(id uuid PRIMARY KEY);
    CREATE FUNCTION public.protect_published_invoice_page() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
    CREATE FUNCTION private.request_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (current_setting('request.headers',true)::jsonb->>'x-tenant-id')::uuid $$;
    CREATE FUNCTION private.has_active_tenant_membership(t uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    CREATE FUNCTION private.authorized_request_tenant_id() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE t uuid:=private.request_tenant_id(); BEGIN IF t IS NULL OR NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=t AND status='active') THEN RAISE EXCEPTION 'tenant execution is unavailable'; END IF; IF auth.role()='service_role' OR private.has_active_tenant_membership(t) THEN RETURN t; END IF; RAISE EXCEPTION 'tenant access forbidden'; END $$;
    GRANT USAGE ON SCHEMA private TO authenticated,service_role;
    GRANT SELECT ON public.tenants,public.contacts TO service_role;
    INSERT INTO public.tenants VALUES('${a}','active','{"modules":{"stripe-invoicing":true,"receivables-collections":true}}'),('${b}','active','{"modules":{}}');
    INSERT INTO public.contacts VALUES('${contactA}','${a}','Example Customer'),('${contactB}','${b}','Other Customer');`);
  sql(readFileSync(new URL("../migrations/20260906-collections-cases.sql", import.meta.url), "utf8"));
  const migration = readFileSync(new URL("../migrations/20261127200000_owned_invoices.sql", import.meta.url), "utf8");
  sql(migration);
  sql(migration);

  assert.equal(sql(`SELECT config->'modules'->>'invoicing' FROM tenants WHERE id='${a}'`), "true", "enabled module stays enabled");
  assert.equal(sql(`SELECT config->'modules' ? 'stripe-invoicing' FROM tenants WHERE id='${a}'`), "f");
  assert.equal(sql("SELECT to_regclass('public.invoice_pages') IS NULL"), "t");
  assert.equal(
    sql("SELECT count(*) FROM information_schema.columns WHERE table_name='collection_observations' AND column_name IN ('creation_action_id','provider_account')"),
    "0",
  );

  // Disabled workspace cannot create invoices.
  fail(as(b) + `SELECT public.save_invoice_draft(NULL,NULL,${json(draft({ contactId: null }))},'x@example.test');`, /Invoicing is disabled/);
  // Totals are computed in SQL, not trusted from the caller.
  fail(as() + `SELECT public.save_invoice_draft(NULL,NULL,${json(draft({ lines: [{ description: "x", quantity: 1, unitCents: 10 }] }))},'x@example.test');`, /between \$0\.50/);
  fail(as() + `SELECT public.save_invoice_draft(NULL,NULL,${json(draft({ paymentMethods: ["bitcoin"] }))},'x@example.test');`, /payment_methods/);

  const first = save(draft());
  assert.equal(first.status, "draft");
  assert.equal(first.total_cents, 200000);
  assert.equal(first.customer_email, "billing@example.test");
  assert.equal(first.number, null);
  const edited = save(draft({ lines: [{ description: "Kickoff", quantity: 2, unitCents: 100050 }] }), first.id, 1);
  assert.equal(edited.total_cents, 200100);
  fail(as() + `SELECT public.save_invoice_draft('${first.id}',1,${json(draft())},'x@example.test');`, /changed/);

  // Issue: numbering, idempotent retry, no second number.
  const issued = issue(first.id, "pi_first");
  assert.equal(issued.status, "open");
  assert.equal(issued.number, "INV-0001");
  assert.equal(issue(first.id, "pi_first").number, "INV-0001");
  fail(as() + `SELECT public.issue_invoice('${first.id}','pi_other','acct_fixture',false,'${"c".repeat(64)}','e');`, /already issued/);
  fail(as() + `SELECT public.save_invoice_draft('${first.id}',${issued.revision},${json(draft())},'x@example.test');`, /Only a draft/);
  const second = save(draft());
  assert.equal(issue(second.id, "pi_second").number, "INV-0002");

  // Payment observations: must match the recorded intent and account.
  fail(as() + `SELECT public.observe_invoice_payment('${first.id}','evt_bad',${json({ intent_id: "pi_other", account_id: "acct_fixture", livemode: false, intent_status: "succeeded", amount_received: 200100 })});`, /does not match/);
  fail(as() + `SELECT public.observe_invoice_payment('${first.id}','evt_short',${json({ intent_id: "pi_first", account_id: "acct_fixture", livemode: false, intent_status: "succeeded", amount_received: 100 })});`, /amount differs/);
  const base = { intent_id: "pi_first", account_id: "acct_fixture", livemode: false };
  assert.equal(observe(first.id, "evt_1", { ...base, intent_status: "processing" }).status, "processing");
  fail(as() + `SELECT public.close_invoice('${first.id}',${issued.revision + 1},'void','');`, /processing/);
  const paid = observe(first.id, "evt_2", { ...base, intent_status: "succeeded", amount_received: 200100, charge_id: "py_1", paid_at: "2026-11-30T00:00:00Z" });
  assert.equal(paid.status, "paid");
  assert.equal(paid.amount_paid_cents, 200100);
  assert.equal(observe(first.id, "evt_3", { ...base, intent_status: "requires_payment_method" }).status, "paid", "paid never regresses");
  assert.equal(observe(first.id, "evt_2", { ...base, intent_status: "canceled" }).status, "paid", "replayed event is ignored");
  assert.equal(sql(`SELECT count(*) FROM invoice_payment_receipts WHERE invoice_id='${first.id}'`), "3");

  // Close: void and outside payment.
  const third = save(draft());
  fail(as() + `SELECT public.close_invoice('${third.id}',1,'paid_external','Check');`, /Issue the invoice/);
  assert.equal(one(`SELECT public.close_invoice('${third.id}',1,'void','');`).status, "void");
  const secondRow = one(`SELECT to_jsonb(i) FROM invoices i WHERE id='${second.id}';`);
  assert.equal(one(`SELECT public.close_invoice('${second.id}',${secondRow.revision},'paid_external','Check 1042');`).status, "paid_external");

  // Tenant isolation: another workspace cannot see or change these invoices.
  sql(`UPDATE tenants SET config='{"modules":{"invoicing":true}}' WHERE id='${b}'`);
  fail(as(b) + `SELECT public.issue_invoice('${third.id}','pi_x','acct_fixture',false,'${"d".repeat(64)}','e');`, /Invoice not found/);
  fail(as(b) + `SELECT public.close_invoice('${second.id}',1,'void','');`, /Invoice not found/);
  assert.equal(save(draft({ contactId: contactB }), null, null, b).number, null);
  assert.equal(issue(save(draft({ contactId: contactB }), null, null, b).id, "pi_b", b).number, "INV-0001", "numbering is per workspace");
  fail(`SET ROLE anon; SELECT * FROM invoices;`, /permission denied/);
  fail(`SET ROLE authenticated; SELECT public.save_invoice_draft(NULL,NULL,'{}','x');`, /permission denied/);

  // Collections observe our invoices; an overdue open invoice opens a case.
  const overdue = save(draft());
  issue(overdue.id, "pi_overdue");
  const request = randomUUID();
  const result = one(`SELECT public.sync_collection_observations('${request}',${json([{ invoiceId: overdue.id }])},'owner@example.test');`);
  assert.equal(result.caseIds.length, 1);
  assert.equal(sql(`SELECT remaining FROM collection_observations WHERE invoice_id='${overdue.id}'`), "200000");
  observe(overdue.id, "evt_overdue", { intent_id: "pi_overdue", account_id: "acct_fixture", livemode: false, intent_status: "succeeded", amount_received: 200000 });
  one(`SELECT public.sync_collection_observations('${randomUUID()}',${json([{ invoiceId: overdue.id }])},'owner@example.test');`);
  assert.equal(sql(`SELECT status FROM collection_cases WHERE id='${result.caseIds[0]}'`), "settled", "payment settles the case");
  fail(as(b) + `SELECT public.sync_collection_observations('${randomUUID()}',${json([{ invoiceId: overdue.id }])},'owner@example.test');`, /Collections is disabled|issued invoices/);

  console.log("invoicing postgres: migration x2, atomic transitions, per-workspace numbering, isolation and collections — ok");
} finally {
  if (started) spawnSync(bin("pg_ctl"), ["-D", data, "-m", "immediate", "stop"], { encoding: "utf8" });
  rmSync(root, { recursive: true, force: true });
}
