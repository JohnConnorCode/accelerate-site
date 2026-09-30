import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Exercise the actual review transaction against two isolated tenants. */
export async function proveContactImportReview({ sql, asyncSql, context, a, b }) {
  const batchId = "31111111-1111-4111-8111-111111111111";
  const foreignBatch = "32222222-2222-4222-8222-222222222222";
  const ids = ["41111111-1111-4111-8111-111111111111", "42222222-2222-4222-8222-222222222222"];
  const foreignRow = "43333333-3333-4333-8333-333333333333";
  const revision = "2026-09-29T12:00:00Z";
  sql(`UPDATE tenants SET status='active';
    CREATE TABLE contact_import_batches(id uuid PRIMARY KEY,tenant_id uuid,status text,updated_at timestamptz,
      selected_row_count integer,proposed_row_count integer,review_digest text,approval_digest text,
      approved_by text,approved_at timestamptz,completed_at timestamptz,execution_claimed_at timestamptz,summary jsonb,error text);
    CREATE TABLE contact_import_rows(id uuid PRIMARY KEY,tenant_id uuid,batch_id uuid,row_index integer,
      raw_data jsonb,reviewed_data jsonb,action text,status text,included boolean,errors text[],warnings text[],
      match_reason text,matched_contact_id uuid,matched_company_id uuid,error text);
    CREATE TABLE contact_import_events(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,batch_id uuid,event_type text,actor_email text,summary jsonb);
    ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS after_state jsonb;
    GRANT SELECT,INSERT,UPDATE ON contact_import_batches,contact_import_rows,contact_import_events,audit_log TO authenticated,service_role;
    INSERT INTO contact_import_batches(id,tenant_id,status,updated_at,review_digest,approval_digest,approved_by)
      VALUES('${batchId}','${a}','approved','${revision}','old','old','admin@fictional.example'),
            ('${foreignBatch}','${b}','ready','${revision}','foreign',null,null);
    INSERT INTO contact_import_rows(id,tenant_id,batch_id,row_index,raw_data,reviewed_data,action,status,included,errors,warnings)
      VALUES('${ids[0]}','${a}','${batchId}',0,'{"name":"Original 1"}','{"fullName":"Original 1"}','create','proposed',true,'{}','{}'),
            ('${ids[1]}','${a}','${batchId}',1,'{"name":"Original 2"}','{"fullName":"Original 2"}','create','proposed',true,'{}','{}'),
            ('${foreignRow}','${b}','${foreignBatch}',0,'{}','{}','skip','skipped',false,'{}','{}');`);
  const migration = readFileSync(
    "migrations/20260929211535_contact_import_review_atomic.sql",
    "utf8",
  );
  sql(migration);
  sql(migration);
  const tenancy = readFileSync("migrations/20260830-tenant-context-authorization.sql", "utf8");
  sql(
    tenancy.slice(
      tenancy.indexOf("CREATE OR REPLACE FUNCTION public.claim_contact_import_batch"),
      tenancy.indexOf("CREATE OR REPLACE FUNCTION public.publish_email_template"),
    ),
  );
  const rows = (name = "Edited", keys = ids) =>
    keys.map((id, index) => ({
      id,
      reviewed_data: { fullName: `${name} ${index + 1}` },
      action: "create",
      included: true,
      status: "proposed",
      errors: [],
      warnings: [],
      match_reason: null,
      matched_contact_id: null,
      matched_company_id: null,
    }));
  const save = (values = rows(), expected = revision) =>
    `SELECT save_contact_import_review('${batchId}','${expected}','${JSON.stringify(values)}','${"a".repeat(64)}','{"create":2}','admin@fictional.example')`;
  const snapshot = () =>
    sql(
      `SELECT jsonb_build_object('rows',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM contact_import_rows r),'batch',(SELECT to_jsonb(b) FROM contact_import_batches b WHERE id='${batchId}'),'events',(SELECT count(*) FROM contact_import_events),'audits',(SELECT count(*) FROM audit_log));`,
    );
  const original = snapshot();
  const priorAudits = JSON.parse(original).audits;
  assert.throws(() => sql(`${context(b)} ${save()}`), /not found/);
  assert.throws(
    () => sql(`${context()} ${save(rows("Edited", [ids[0], foreignRow]))}`),
    /every source row/,
  );
  assert.throws(
    () => sql(`${context()} ${save(rows("Edited", [ids[0], ids[0]]))}`),
    /every source row/,
  );
  assert.throws(() => sql(`SET ROLE anon; ${save()}`), /permission denied/);
  assert.equal(snapshot(), original);
  sql(`CREATE FUNCTION private.reject_review_row() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.row_index=1 AND NEW.reviewed_data->>'fullName'='Reject 2' THEN RAISE EXCEPTION 'controlled row failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER reject_review_row BEFORE UPDATE ON contact_import_rows FOR EACH ROW EXECUTE FUNCTION private.reject_review_row();`);
  assert.throws(() => sql(`${context()} ${save(rows("Reject"))}`), /controlled row failure/);
  assert.equal(
    snapshot(),
    original,
    "a later row failure rolls back earlier rows and old approval",
  );
  sql(`CREATE FUNCTION private.reject_review_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled audit failure'; END $$;
    CREATE TRIGGER reject_review_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION private.reject_review_audit();`);
  assert.throws(() => sql(`${context()} ${save()}`), /controlled audit failure/);
  assert.equal(snapshot(), original, "receipt failure rolls back the entire review");
  sql("DROP TRIGGER reject_review_audit ON audit_log;");
  const competing = await Promise.allSettled(
    ["First", "Second"].map((name) => asyncSql(`${context()} ${save(rows(name))}`)),
  );
  assert.equal(competing.filter((result) => result.status === "fulfilled").length, 1);
  assert.match(
    competing.find((result) => result.status === "rejected").reason.message,
    /review changed/,
  );
  const committed = JSON.parse(snapshot());
  assert.equal(committed.batch.status, "ready");
  assert.equal(committed.batch.approval_digest, null);
  assert.equal(committed.batch.approved_by, null);
  assert.equal(committed.events, 1);
  assert.equal(committed.audits, priorAudits + 1);
  assert.equal(committed.rows[0].raw_data.name, "Original 1");
  assert.equal(
    sql(
      `${context()} SELECT count(*) FROM claim_contact_import_batch('${batchId}','admin@fictional.example');`,
    ),
    "0",
  );
  const newRevision = committed.batch.updated_at;
  assert.throws(() => sql(`${context()} ${save()}`), /review changed/);
  sql(`UPDATE contact_import_rows SET status='imported' WHERE id='${ids[0]}';`);
  assert.throws(
    () => sql(`${context()} ${save(rows("Changed"), newRevision)}`),
    /Imported rows cannot be edited/,
  );

  // Force execution to own the batch lock while a save waits. The waiting
  // transaction must recheck the committed status before touching any row.
  sql(`UPDATE contact_import_batches SET status='approved',updated_at='${revision}',review_digest='old',approval_digest='old',approved_by='admin@fictional.example' WHERE id='${batchId}';
    UPDATE contact_import_rows SET status='proposed',reviewed_data=jsonb_build_object('fullName','Original '||(row_index+1)) WHERE batch_id='${batchId}';`);
  const claimed = asyncSql(
    `${context()} SET application_name='import-execution-fixture'; BEGIN; SELECT id FROM claim_contact_import_batch('${batchId}','admin@fictional.example'); SELECT pg_sleep(0.4); COMMIT;`,
  );
  let ownsBatch = false;
  for (let poll = 0; poll < 25 && !ownsBatch; poll++) {
    ownsBatch =
      sql(
        `SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity s ON s.pid=l.pid WHERE s.application_name='import-execution-fixture' AND l.relation='contact_import_batches'::regclass AND l.mode='RowExclusiveLock' AND l.granted)`,
      ) === "t";
    if (!ownsBatch) await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.ok(ownsBatch, "executor must own the batch lock before review save starts");
  await assert.rejects(asyncSql(`${context()} ${save()}`), /executing batch cannot be edited/);
  await claimed;
  assert.equal(
    sql(`SELECT reviewed_data->>'fullName' FROM contact_import_rows WHERE id='${ids[0]}'`),
    "Original 1",
  );
  sql(`UPDATE tenants SET status='suspended' WHERE id='${a}';`);
  assert.throws(() => sql(`${context()} ${save()}`), /tenant execution is unavailable/);
  sql(`UPDATE tenants SET status='active' WHERE id='${a}';`);
  return [
    "atomic-import-review-rollback",
    "atomic-import-review-receipts",
    "import-review-revision-and-tenant-fences",
    "import-review-execution-race",
    "imported-row-immutability",
  ];
}
