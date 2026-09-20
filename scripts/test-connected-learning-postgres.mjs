import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
const root = mkdtempSync(join(tmpdir(), "accelerate-connected-learning-"));
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
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA private;
    CREATE FUNCTION private.request_tenant_id() RETURNS uuid LANGUAGE sql AS $$
      SELECT coalesce(nullif(current_setting('test.tenant',true),''),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')::uuid $$;
    CREATE FUNCTION public.accelerate_default_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT private.request_tenant_id() $$;
    CREATE FUNCTION private.authorized_request_tenant_id() RETURNS uuid LANGUAGE sql AS $$ SELECT private.request_tenant_id() $$;
    CREATE FUNCTION private.has_active_tenant_membership(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
    CREATE TABLE coworkers(id text PRIMARY KEY,tenant_id uuid);
    CREATE TABLE action_queue(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid DEFAULT private.request_tenant_id(),
      action_type text,payload jsonb,status text,approved_by text,approved_at timestamptz);
    CREATE TABLE audit_log(id uuid DEFAULT gen_random_uuid(),tenant_id uuid,actor_email text,action text,
      entity_type text,entity_id text,source text,metadata jsonb);
  `,
  ]);
  for (const path of [
    "migrations/20260903-agent-memory-and-budgets.sql",
    "migrations/20260911-learning-inbox.sql",
    "migrations/20260920-connected-learning.sql",
    "migrations/20260920-connected-learning.sql",
  ])
    run("psql", [...args, "-f", path]);
  run("psql", [
    ...args,
    "-c",
    `
    INSERT INTO learning_proposals(id,proposal_type,rule,dedupe_key) VALUES
      ('10000000-0000-4000-8000-000000000001','messaging','First rule','first'),
      ('10000000-0000-4000-8000-000000000002','messaging','Independent rule','second'),
      ('10000000-0000-4000-8000-000000000003','messaging','Replacement rule','third'),
      ('10000000-0000-4000-8000-000000000004','messaging','Must roll back','fourth');
    INSERT INTO action_queue(id,action_type,payload,status,approved_by,approved_at)
      SELECT id,'approve_learning',jsonb_build_object('proposalId',id),'executing','owner@example.test',now() FROM learning_proposals;
    UPDATE learning_proposals SET approval_action_id=id;
    DO $$ BEGIN
      BEGIN
        PERFORM approve_learning_proposal('10000000-0000-4000-8000-000000000001','wrong@example.test');
        RAISE EXCEPTION 'wrong actor accepted';
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'Learning requires its human-approved action' THEN RAISE; END IF;
      END;
    END $$;
  `,
  ]);
  // Separate database sessions exercise the real row/advisory locks.
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execute = promisify(execFile);
  const approve = (suffix) =>
    execute("psql", [
      ...args,
      "-c",
      `SELECT approve_learning_proposal('10000000-0000-4000-8000-00000000000${suffix}','owner@example.test');`,
    ]);
  await Promise.all([approve(1), approve(1), approve(2)]);
  run("psql", [
    ...args,
    "-c",
    `
    DO $$ DECLARE old_id uuid; new_id uuid; BEGIN
      IF (SELECT count(*) FROM learned_policies WHERE superseded_at IS NULL)<>2 THEN RAISE EXCEPTION 'independent rules displaced'; END IF;
      IF (SELECT count(*) FROM audit_log WHERE action='learning.approved')<>2 THEN RAISE EXCEPTION 'replay duplicated audit'; END IF;
      SELECT learned_policy_id INTO old_id FROM learning_proposals WHERE dedupe_key='first';
      UPDATE learning_proposals SET supersedes_policy_id=old_id WHERE dedupe_key='third';
      PERFORM approve_learning_proposal('10000000-0000-4000-8000-000000000003','owner@example.test');
      SELECT learned_policy_id INTO new_id FROM learning_proposals WHERE dedupe_key='third';
      IF NOT EXISTS(SELECT 1 FROM learned_policies WHERE id=old_id AND superseded_by=new_id) THEN RAISE EXCEPTION 'missing explicit replacement'; END IF;
      IF (SELECT count(*) FROM learned_policies WHERE superseded_at IS NULL)<>2 THEN RAISE EXCEPTION 'replacement damaged unrelated rules'; END IF;
      UPDATE learning_proposals SET supersedes_policy_id=old_id WHERE dedupe_key='fourth';
      BEGIN
        PERFORM approve_learning_proposal('10000000-0000-4000-8000-000000000004','owner@example.test');
        RAISE EXCEPTION 'stale replacement accepted';
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'Replacement target is unavailable or already superseded' THEN RAISE; END IF;
      END;
      IF (SELECT status FROM learning_proposals WHERE dedupe_key='fourth')<>'proposed' THEN RAISE EXCEPTION 'failed approval changed proposal'; END IF;
      PERFORM set_config('test.tenant','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
      BEGIN
        PERFORM approve_learning_proposal('10000000-0000-4000-8000-000000000001','owner@example.test');
        RAISE EXCEPTION 'cross tenant approval accepted';
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'Learning proposal not found' THEN RAISE; END IF;
      END;
    END $$;
    SELECT set_config('test.tenant','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
    CREATE FUNCTION fail_learning_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action='learning.approved' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER reject_learning_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_learning_audit();
    UPDATE learning_proposals SET supersedes_policy_id=(SELECT learned_policy_id FROM learning_proposals WHERE dedupe_key='second') WHERE dedupe_key='fourth';
    DO $$ BEGIN
      BEGIN
        PERFORM approve_learning_proposal('10000000-0000-4000-8000-000000000004','owner@example.test');
        RAISE EXCEPTION 'audit failure ignored';
      EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'injected audit failure' THEN RAISE; END IF; END;
      IF (SELECT count(*) FROM learned_policies WHERE superseded_at IS NULL)<>2 OR
         (SELECT count(*) FROM learned_policies)<>3 OR
         (SELECT status FROM learning_proposals WHERE dedupe_key='fourth')<>'proposed'
      THEN RAISE EXCEPTION 'audit failure did not roll back all state'; END IF;
    END $$;
  `,
  ]);
  run("psql", [
    ...args,
    "-c",
    `
    CREATE TABLE tenants(id uuid PRIMARY KEY);
    INSERT INTO tenants VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    CREATE TABLE drive_documents(id uuid PRIMARY KEY,tenant_id uuid,name text,extracted_text text,content_hash text,modified_at timestamptz,web_view_link text,
      external_id text,folder_id text,provider_revision text,indexed_status text,metadata jsonb);
    CREATE TABLE integration_connections(tenant_id uuid,provider text,status text,settings jsonb);
    CREATE TABLE messages(id uuid PRIMARY KEY,tenant_id uuid,subject text,body_text text,created_at timestamptz);
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid,bucket_id text,name text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT (string_to_array($1,'/'))[1:1] $$;
  `,
  ]);
  run("psql", [...args, "-f", "migrations/20260927-knowledge-documents.sql"]);
  run("psql", [...args, "-f", "migrations/20260927-knowledge-documents.sql"]);
  run("psql", [
    ...args,
    "-c",
    `
    INSERT INTO knowledge_documents(tenant_id,title,mime_type,storage_path,content_hash,owner_email,status,extracted_text)
      VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Reference','text/plain','a/1','one','owner','indexed','Consultations last thirty minutes'),
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Archived','text/plain','a/2','two','owner','archived','Consultations last sixty minutes'),
      ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Foreign','text/plain','b/1','one','owner','indexed','Consultations last ninety minutes');
    DO $$ DECLARE found jsonb; BEGIN
      found:=search_document_knowledge('consultations',10);
      IF jsonb_array_length(found)<>1 OR found->0->>'title'<>'Reference' THEN RAISE EXCEPTION 'source search leaked archived or foreign data'; END IF;
      IF jsonb_array_length(search_document_knowledge('nonexistent',10))<>0 THEN RAISE EXCEPTION 'unrelated search result'; END IF;
      IF has_function_privilege('anon','public.search_document_knowledge(text,integer)','execute') THEN RAISE EXCEPTION 'anonymous search granted'; END IF;
    END $$;
  `,
  ]);
  console.log(
    "Knowledge SQL: full-text retrieval, missing query, tenant/archive exclusion, private storage policy and repeatable migration passed.",
  );
  console.log(
    "PostgreSQL learning: independent rules, concurrent replay, explicit replacement, stale target, actor/tenant isolation, audit rollback and repeatable migration passed.",
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
  if (root.startsWith(join(tmpdir(), "accelerate-connected-learning-")))
    rmSync(root, { recursive: true, force: true });
}
