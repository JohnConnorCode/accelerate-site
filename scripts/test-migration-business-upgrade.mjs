import assert from "node:assert/strict";
import { migrationCatalog, migrationProgram } from "./lib/migration-ledger.mjs";
import { runPsql, POOLER_HOST, repoRoot } from "./lib/accelerate-database.mjs";
assert.ok(["localhost", "127.0.0.1"].includes(POOLER_HOST));
function sql(input) {
  const result = runPsql(["-qAt"], { input });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
// The native fixture provides only Supabase Auth's database interface. Auth
// delivery is not under test. The Supabase-only cron/vault/network extension
// migration is explicitly excluded here; its real clean-install proof is
// recorded separately. All business migrations run from their actual sources.
sql(`CREATE SCHEMA auth; CREATE SCHEMA extensions;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
INSERT INTO auth.users VALUES('11111111-1111-4111-8111-111111111111','owner@example.test');`);
process.env.BOOTSTRAP_FOUNDER_EMAIL = "owner@example.test";
process.env.BOOTSTRAP_BRAND_NAME = "Upgrade proof";
const catalog = migrationCatalog(repoRoot).filter(
  (m) => m.file !== "migrations/20260823-command-center-scheduler.sql",
);
sql(migrationProgram(catalog, { through: "migrations/20260831-tenant-suspension-guards.sql" }));
const a = "acce1e8e-0000-4000-8000-000000000001",
  b = "22222222-2222-4222-8222-222222222222";
sql(`INSERT INTO tenants(id,slug,name,status,config) SELECT '${b}','second','Second workspace','active',config FROM tenants WHERE id='${a}';
INSERT INTO contacts(tenant_id,full_name,primary_email) VALUES('${a}','First customer','shared@example.test'),('${b}','Second customer','shared@example.test');
UPDATE tenants SET config=jsonb_set(config,'{brand,tagline}','"Saved business configuration"') WHERE id='${a}';`);
const before = sql(
  `SELECT jsonb_agg(jsonb_build_object('id',id,'tenant',tenant_id,'name',full_name,'email',primary_email) ORDER BY tenant_id)::text FROM contacts;`,
);
sql(migrationProgram(catalog));
sql(migrationProgram(catalog));
assert.equal(
  sql(
    `SELECT jsonb_agg(jsonb_build_object('id',id,'tenant',tenant_id,'name',full_name,'email',primary_email) ORDER BY tenant_id)::text FROM contacts;`,
  ),
  before,
);
assert.equal(
  sql(`SELECT config #>> '{brand,tagline}' FROM tenants WHERE id='${a}';`),
  "Saved business configuration",
);
assert.equal(sql(`SELECT count(*) FROM contacts WHERE primary_email='shared@example.test';`), "2");
assert.equal(
  sql(
    `SELECT count(*) FROM tenant_memberships WHERE tenant_id='${a}' AND user_id='11111111-1111-4111-8111-111111111111' AND status='active' AND role='admin';`,
  ),
  "1",
);
assert.equal(sql(`SELECT count(*) FROM accelerate_schema_migrations;`), String(catalog.length));
for (const table of ["entity_types", "entity_links", "plugins", "work_items", "feature_requests"])
  assert.equal(sql(`SELECT to_regclass('public.${table}') IS NOT NULL;`), "t", table);
console.log(
  "PASS: actual business migration upgrade and replay preserve two tenants, duplicate contact emails, canonical record IDs, owner membership and edited configuration.",
);

// Real PostgreSQL conflict inference: mirrors the tenant-bound PostgREST
// upserts used by recorded email and Google synchronization. Memory fixtures
// cannot detect an otherwise-correct column list backed only by partial indexes.
sql(`BEGIN;
INSERT INTO conversations(tenant_id,channel,external_id,subject)
VALUES('${a}','resend','upsert-proof','First'),('${b}','resend','upsert-proof','Other tenant')
ON CONFLICT (tenant_id,channel,external_id) DO NOTHING;
INSERT INTO conversations(tenant_id,channel,external_id,subject)
VALUES('${a}','resend','upsert-proof','Replay')
ON CONFLICT (tenant_id,channel,external_id) DO NOTHING;
INSERT INTO conversations(tenant_id,channel,subject)
VALUES('${a}','resend','No external ID'),('${a}','resend','Another without ID')
ON CONFLICT (tenant_id,channel,external_id) DO NOTHING;
INSERT INTO messages(tenant_id,conversation_id,external_id,direction,body_text)
SELECT tenant_id,id,'message-proof','inbound','First' FROM conversations WHERE external_id='upsert-proof'
ON CONFLICT (tenant_id,conversation_id,external_id) DO UPDATE SET body_text=excluded.body_text;
INSERT INTO messages(tenant_id,conversation_id,external_id,direction,body_text)
SELECT tenant_id,id,'message-proof','inbound','Updated' FROM conversations WHERE external_id='upsert-proof'
ON CONFLICT (tenant_id,conversation_id,external_id) DO UPDATE SET body_text=excluded.body_text;
INSERT INTO messages(tenant_id,conversation_id,direction,body_text)
SELECT '${a}',id,'outbound','No external ID' FROM conversations CROSS JOIN generate_series(1,2) WHERE tenant_id='${a}' AND channel='resend' AND external_id='upsert-proof'
ON CONFLICT (tenant_id,conversation_id,external_id) DO NOTHING;
DO $$ BEGIN
 IF (SELECT count(*) FROM conversations WHERE external_id='upsert-proof') <> 2 THEN RAISE EXCEPTION 'Conversation replay or tenant isolation failed'; END IF;
 IF (SELECT count(*) FROM messages WHERE external_id='message-proof' AND body_text='Updated') <> 2 THEN RAISE EXCEPTION 'Message replay or tenant isolation failed'; END IF;
 IF (SELECT count(*) FROM conversations WHERE tenant_id='${a}' AND channel='resend' AND external_id IS NULL) <> 2 THEN RAISE EXCEPTION 'Null conversation identity was collapsed'; END IF;
 IF (SELECT count(*) FROM messages WHERE body_text='No external ID') <> 2 THEN RAISE EXCEPTION 'Null message identity was collapsed'; END IF;
END $$;
ROLLBACK;`);
console.log(
  "PASS: native conversation/message conflict targets support replay, tenant ID reuse and null external IDs.",
);

await import("./test-radar-store-postgres.mjs");
await import("./test-radar-ranking-postgres.mjs");
await import("./test-radar-relationships-postgres.mjs");
await import("./test-proposal-lifecycle-postgres.mjs");

if (process.env.COLLECTIONS_POSTGRES_PROOF === "1") await import("./test-collections-postgres.mjs");

if (process.env.COLLECTIONS_REMINDER_POSTGRES_PROOF === "1")
  await import("./test-collections-reminder-postgres.mjs");

await import("./test-radar-outreach-postgres.mjs");
