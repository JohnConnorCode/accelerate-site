import assert from "node:assert/strict";
import { migrationCatalog, migrationProgram } from "./lib/migration-ledger.mjs";
import { runPsql, POOLER_HOST, repoRoot } from "./lib/accelerate-database.mjs";
assert.ok(["localhost", "127.0.0.1"].includes(POOLER_HOST));
function sql(input) {
  const result = runPsql(["-qAt"], { input });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
// The native fixture provides Supabase Auth and Storage database interfaces. Auth
// delivery is not under test. The Supabase-only cron/vault/network extension
// migration is explicitly excluded here; its real clean-install proof is
// recorded separately. All business migrations run from their actual sources.
sql(`CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
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

await import("./test-site-studio-postgres.mjs");
await import("./test-website-postgres.mjs");

await import("./test-campaign-duplicate-postgres.mjs");

await import("./test-delivery-handoff-postgres.mjs");
await import("./test-contact-bulk-postgres.mjs");

// The booking ledger must preserve individual commitments and reject foreign
// evidence even when a privileged host invokes its service-only RPC.
sql(`BEGIN;
INSERT INTO contacts(id,tenant_id,full_name,primary_email) VALUES
 ('aaaa1111-1111-4111-8111-111111111111','${a}','Debate lead','debate-lead@test.example'),
 ('bbbb2222-2222-4222-8222-222222222222','${a}','Debate counterpart','debate-counter@test.example');
INSERT INTO debate_productions(id,tenant_id,request_key,title,lead_contact_id,counterpart_contact_id,target_at)
 VALUES('cccc3333-3333-4333-8333-333333333333','${a}','debate-native-proof','Native debate proof',
 'aaaa1111-1111-4111-8111-111111111111','bbbb2222-2222-4222-8222-222222222222','2026-10-21T18:00:00Z');
INSERT INTO calendar_events(id,tenant_id,provider,external_id,title,start_at,status,metadata)
 VALUES('ffff6666-6666-4666-8666-666666666666','${a}','google','cancelled-debate-proof',
 'Canceled debate','2026-10-21T18:00:00Z','cancelled',jsonb_build_object('debate_verified_at',now()));
INSERT INTO calendar_events(id,tenant_id,provider,external_id,title,start_at,status,metadata)
 VALUES('ffff6666-6666-4666-8666-777777777777','${a}','google','verified-debate-proof',
 'Verified debate','2026-10-21T18:00:00Z','confirmed',jsonb_build_object(
   'debate_integrity','verified','debate_production_id','cccc3333-3333-4333-8333-333333333333'));
INSERT INTO debate_productions(id,tenant_id,request_key,title,lead_contact_id,counterpart_contact_id,
 target_at,calendar_event_id) VALUES('99997777-7777-4777-8777-777777777777','${a}',
 'debate-cancelled-proof','Canceled debate proof','aaaa1111-1111-4111-8111-111111111111',
 'bbbb2222-2222-4222-8222-222222222222','2026-10-21T18:00:00Z',
 'ffff6666-6666-4666-8666-666666666666');
INSERT INTO conversations(id,tenant_id,channel,external_id)
 VALUES('dddd4444-4444-4444-8444-444444444444','${b}','gmail','foreign-debate-proof');
INSERT INTO messages(id,tenant_id,conversation_id,direction,sender_email,body_text)
 VALUES('eeee5555-5555-4555-8555-555555555555','${b}','dddd4444-4444-4444-8444-444444444444',
 'inbound','foreign@test.example','Unrelated');
SET request.headers='{"x-tenant-id":"${a}"}';
SET request.jwt.claim.role='service_role';
SET ROLE service_role;
DO $$
DECLARE first jsonb; second jsonb; created jsonb; replay jsonb; blocked boolean;
BEGIN
 SELECT write_debate_production('create',jsonb_build_object('requestKey','debate-rpc-replay',
   'title','RPC debate proof','leadContactId','aaaa1111-1111-4111-8111-111111111111'),
   'owner@example.test') INTO created;
 SELECT write_debate_production('create',jsonb_build_object('requestKey','debate-rpc-replay',
   'title','RPC debate proof','leadContactId','aaaa1111-1111-4111-8111-111111111111'),
   'owner@example.test') INTO replay;
 IF created->>'id' <> replay->>'id' OR replay->>'duplicate' <> 'true'
   THEN RAISE EXCEPTION 'Production create replay was not idempotent'; END IF;
 SELECT record_debate_milestone('cccc3333-3333-4333-8333-333333333333','topic_interest',
   'verified','Interested','founder_confirmation','owner@example.test',now(),'owner@example.test') INTO first;
 IF first->>'status' <> 'verified' THEN RAISE EXCEPTION 'First booking milestone failed'; END IF;
 SELECT record_debate_milestone('cccc3333-3333-4333-8333-333333333333','topic_interest',
   'declined','Declined','founder_confirmation','owner@example.test',now(),'owner@example.test') INTO second;
 IF second->>'claimId' = first->>'claimId' THEN
   RAISE EXCEPTION 'Changed commitment did not supersede its old claim';
 END IF;
 blocked := false;
 BEGIN
  PERFORM record_debate_milestone('cccc3333-3333-4333-8333-333333333333','proposition',
    'verified','Wrong source','gmail_message','eeee5555-5555-4555-8555-555555555555',now(),'owner@example.test');
 EXCEPTION WHEN OTHERS THEN blocked := true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Foreign tenant evidence was accepted'; END IF;
 blocked := false;
 BEGIN
  PERFORM record_debate_milestone('cccc3333-3333-4333-8333-333333333333','invitation',
    'verified','No event','founder_confirmation','owner@example.test',now(),'owner@example.test');
 EXCEPTION WHEN OTHERS THEN blocked := true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Invitation was verified without a provider event'; END IF;
 SELECT record_debate_milestone('cccc3333-3333-4333-8333-333333333333','date',
   'verified','October 21','founder_confirmation','owner@example.test',now(),'owner@example.test') INTO second;
 blocked := false;
 BEGIN
  PERFORM write_debate_production('update',jsonb_build_object('productionId',
    'cccc3333-3333-4333-8333-333333333333','expectedRevision',0,'targetAt','2026-10-22T18:00:00Z'),
    'owner@example.test');
 EXCEPTION WHEN OTHERS THEN blocked := true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Confirmed date was changed directly'; END IF;
 SELECT write_debate_production('link_invitation',jsonb_build_object('productionId',
   'cccc3333-3333-4333-8333-333333333333','expectedRevision',0,
   'calendarEventId','ffff6666-6666-4666-8666-777777777777'),
   'owner@example.test') INTO second;
 IF second->>'calendar_event_id' <> 'ffff6666-6666-4666-8666-777777777777'
   OR second->>'revision' <> '1' THEN
   RAISE EXCEPTION 'Verified invitation was not linked'; END IF;
 SELECT record_debate_milestone('cccc3333-3333-4333-8333-333333333333','invitation',
   'verified','verified-debate-proof','calendar_event','ffff6666-6666-4666-8666-777777777777',
   now(),'owner@example.test') INTO second;
 IF second->>'status' <> 'verified' THEN RAISE EXCEPTION 'Invitation receipt was not recorded'; END IF;
 SELECT write_debate_production('reopen_cancelled_invitation',jsonb_build_object(
   'productionId','99997777-7777-4777-8777-777777777777','expectedRevision',0),
   'owner@example.test') INTO second;
 IF second->>'calendar_event_id' IS NOT NULL OR second->>'revision' <> '1'
   THEN RAISE EXCEPTION 'Canceled invitation did not reopen'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM claims WHERE tenant_id='${a}' AND entity_type='debate_production'
   AND field='topic_interest' AND status='superseded') <> 1 THEN
   RAISE EXCEPTION 'Old commitment claim was not superseded';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM debate_milestones
   WHERE production_id='99997777-7777-4777-8777-777777777777'
     AND milestone='invitation' AND status='cancelled') THEN
   RAISE EXCEPTION 'Canceled invitation lacks its evidence';
 END IF;
END $$;
ROLLBACK;`);
assert.equal(
  sql(`SELECT has_function_privilege('authenticated',
  'public.record_debate_milestone(uuid,text,text,text,text,text,timestamptz,text)','EXECUTE');`),
  "f",
);
assert.equal(
  sql("SELECT has_table_privilege('authenticated','public.debate_milestones','INSERT');"),
  "f",
);
assert.equal(
  sql("SELECT has_table_privilege('authenticated','public.debate_productions','UPDATE');"),
  "f",
);
assert.equal(
  sql("SELECT has_table_privilege('authenticated','public.debate_productions','INSERT');"),
  "f",
);
console.log(
  "PASS: booking create replay, claim supersession, date protection, foreign evidence and invitation checks; direct writes are closed.",
);
