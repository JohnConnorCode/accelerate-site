/** Disposable native Supabase recovery. Never targets an existing installation.
 * Uploaded bytes are copied through Storage; recorded source migrations rebuild
 * routines/policies before a native data-only restore. This is not a hosted dump. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { migrationCatalog, migrationProgram } from "./lib/migration-ledger.mjs";
import { bootstrapOwnerMembershipSql } from "./lib/bootstrap-owner-membership.mjs";
import { backupStorage, restoreStorage } from "./lib/storage-recovery.mjs";
import { encryptTenantSecret, decryptTenantSecret } from "../src/lib/revenue-os/encryption";
import { settleWorkItem, claimWorkItem, type WorkItem } from "../src/lib/revenue-os/work-items";
import { reconcileWork } from "../src/lib/revenue-os/work-result";
import { claimApprovedAction, retryPluginAction } from "../src/lib/revenue-os/actions";
import { bindTenantDatabase } from "../src/lib/supabase/server";

const safe = (text: string) =>
  text
    .split("\n")
    .filter((line) => !/password|secret|token|apikey|authorization|jwt|postgres:\/\//i.test(line))
    .slice(-8)
    .map((line) => line.replace(/[A-Za-z0-9_+/=-]{40,}/g, "[redacted]").slice(0, 300))
    .join("\n");
async function main() {
  assert.equal(
    process.env.RECOVERY_PROOF_NATIVE,
    "1",
    "Use the isolated Connected fork recovery job, or explicitly enable RECOVERY_PROOF_NATIVE=1 on a disposable Docker runner.",
  );
  assert.ok(
    process.env.RUNNER_TEMP,
    "Set RUNNER_TEMP to the disposable runner's private temporary directory.",
  );
  // Published main before the latest ordered application migrations. Keep this
  // pinned source revision: a same-schema replay is not an upgrade exercise.
  const prior = "765a747ff31543d336078d83fc8ccef69dff3267";
  const output = join(resolve(process.env.RUNNER_TEMP), "accelerate-release-recovery");
  await mkdir(output, { recursive: true, mode: 0o700 });
  const root = await mkdtemp(
    join(resolve(process.env.RUNNER_TEMP), "accelerate-recovery-private-"),
  );
  const suffix = randomBytes(5).toString("hex");
  const projects = ["source", "target"].map((kind, index) => ({
    id: `recovery-${suffix}-${kind}`,
    root: join(root, kind),
    port: 54321 + index * 1000,
  }));
  type Project = (typeof projects)[number];
  let phase = "setup";
  const checks: string[] = [];
  const began = Date.now();
  function run(command: string, args: string[], input?: string | Buffer): Buffer {
    const result = spawnSync(command, args, {
      input,
      maxBuffer: 64 * 1024 * 1024,
      timeout: 600_000,
    });
    if (result.status !== 0) {
      console.error(safe(String(result.stderr ?? "")));
      throw new Error(`${command} failed during ${phase}; exit ${result.status ?? "unavailable"}`);
    }
    return result.stdout;
  }
  const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
  const sql = (project: Project, input: string, user = "postgres") =>
    run(
      "docker",
      [
        "exec",
        "-i",
        `supabase_db_${project.id}`,
        "sh",
        "-c",
        'PGPASSWORD="$POSTGRES_PASSWORD" exec psql "$@"',
        "--",
        "-X",
        "-qAt",
        "-U",
        user,
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      input,
    )
      .toString()
      .trim();
  function client(origin: string, key: string, tenant?: string) {
    return createClient(origin, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: tenant ? { "x-tenant-id": tenant } : {},
        fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(30_000) }),
      },
    });
  }
  async function start(project: Project) {
    await mkdir(project.root, { mode: 0o700 });
    run("supabase", ["init", "--yes", "--workdir", project.root]);
    const path = join(project.root, "supabase/config.toml");
    let config = await readFile(path, "utf8");
    config = config.replace(/^project_id = .*$/m, `project_id = "${project.id}"`);
    config = config.replace(/(\[api\][\s\S]*?)(?=\n\[|$)/, (block) =>
      block.replace(/^port = .*$/m, `port = ${project.port}`),
    );
    config = config.replace(/(\[db\][\s\S]*?)(?=\n\[|$)/, (block) =>
      block
        .replace(/^port = .*$/m, `port = ${project.port + 1}`)
        .replace(/^shadow_port = .*$/m, `shadow_port = ${project.port - 1}`)
        .replace(/^major_version = .*$/m, "major_version = 17"),
    );
    await writeFile(path, config, { mode: 0o600 });
    run("supabase", [
      "start",
      "--workdir",
      project.root,
      "--exclude",
      "realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor",
    ]);
    const status = JSON.parse(
      run("supabase", ["status", "-o", "json", "--workdir", project.root]).toString(),
    );
    const origin = `http://127.0.0.1:${project.port}`;
    assert.equal(
      new URL(status.API_URL).port,
      String(project.port),
      "Owned native API port must match",
    );
    assert.ok(
      status.SERVICE_ROLE_KEY && status.ANON_KEY,
      "Native service and anonymous credentials must exist",
    );
    return {
      origin,
      service: client(origin, status.SERVICE_ROLE_KEY),
      anon: status.ANON_KEY,
      serviceKey: status.SERVICE_ROLE_KEY,
    };
  }
  function stop(project: Project) {
    run("supabase", ["stop", "--no-backup", "--project-id", project.id]);
  }
  const tables = [
    "tenants",
    "tenant_memberships",
    "contacts",
    "tasks",
    "opportunities",
    "integration_connections",
    "work_items",
    "action_queue",
    "model_call_receipts",
    "model_call_events",
    "knowledge_documents",
    "accelerate_schema_migrations",
  ];
  function snapshot(project: Project) {
    return JSON.parse(
      sql(
        project,
        `SELECT jsonb_build_object(${tables.map((table) => `${literal(table)},(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]'::jsonb) FROM public.${table} r)`).join(",")},'auth_users',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]'::jsonb) FROM auth.users r),'auth_identities',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]'::jsonb) FROM auth.identities r));`,
      ),
    );
  }
  const a = "acce1e8e-0000-4000-8000-000000000001";
  const owner = "owner@recovery.test",
    second = "member@recovery.test";
  const password = randomBytes(24).toString("base64url");
  const recoveryKey = randomBytes(32).toString("hex");
  Object.assign(process.env, {
    BOOTSTRAP_FOUNDER_EMAIL: owner,
    BOOTSTRAP_BRAND_NAME: "Recovery proof",
    GOOGLE_TOKEN_ENCRYPTION_KEY: recoveryKey,
  });
  const contactA = randomUUID(),
    contactB = randomUUID(),
    workId = randomUUID(),
    actionId = randomUUID(),
    foreignAction = randomUUID(),
    completedAction = randomUUID(),
    receiptId = randomUUID();
  let backupPoint = 0;
  let receipt: Record<string, unknown> | undefined;
  try {
    phase = "prior-source";
    console.log("Native recovery: Prepare the owned source and prior application migrations.");
    const priorRoot = join(root, "prior");
    await mkdir(priorRoot, { mode: 0o700 });
    const archive = run("git", ["archive", prior, "scripts/lib", "migrations", "supabase"]);
    run("tar", ["-x", "-C", priorRoot], archive);
    const previous = await import(join(priorRoot, "scripts/lib/migration-ledger.mjs"));
    const priorCatalog = previous.migrationCatalog(priorRoot);
    const currentCatalog = migrationCatalog(process.cwd());
    const source = projects[0]!;
    const sourceApi = await start(source);
    const firstUser = await sourceApi.service.auth.admin.createUser({
      email: owner,
      password,
      email_confirm: true,
    });
    const secondUser = await sourceApi.service.auth.admin.createUser({
      email: second,
      password,
      email_confirm: true,
    });
    assert.ok(
      !firstUser.error && firstUser.data.user && !secondUser.error && secondUser.data.user,
      "Native Auth fixture creation must succeed",
    );
    sql(source, migrationProgram(priorCatalog));
    sql(source, bootstrapOwnerMembershipSql(a, firstUser.data.user.id, owner));
    // Lifecycle RPC owns the second tenant and its immutable membership audit.
    const created = JSON.parse(
      sql(
        source,
        `SELECT public.platform_create_tenant('recovery-second','Recovery second',${literal(firstUser.data.user.id)},${literal(owner)});`,
      ),
    );
    const secondTenant = created.id;
    assert.match(secondTenant, /^[a-f0-9-]{36}$/);
    // Use the actual lifecycle-created identity throughout the fixture.
    const tenantB = secondTenant as string;
    sql(
      source,
      `SELECT public.platform_set_tenant_status(${literal(tenantB)},'active',${literal(firstUser.data.user.id)},${literal(owner)}); SELECT public.platform_upsert_tenant_membership(${literal(tenantB)},${literal(secondUser.data.user.id)},${literal(second)},'active',${literal(firstUser.data.user.id)},${literal(owner)});`,
    );
    const envelope = encryptTenantSecret("fictional-provider-credential", a, "stripe", "api_key");
    sql(
      source,
      `INSERT INTO contacts(id,tenant_id,full_name,primary_email) VALUES('${contactA}','${a}','First recovery contact','shared@recovery.test'),('${contactB}','${tenantB}','Second recovery contact','shared@recovery.test');
INSERT INTO opportunities(tenant_id,name,contact_id) VALUES('${a}','Saved recovery deal','${contactA}');
INSERT INTO tasks(tenant_id,title,status,contact_id) VALUES('${a}','Completed recovery task','completed','${contactA}');
INSERT INTO integration_connections(tenant_id,provider,account_email,status,encrypted_credentials,settings,environment_fallback_allowed) VALUES('${a}','stripe','billing@recovery.test','connected',jsonb_build_object('api_key',${literal(envelope)}),'{"sync_cursor":"fictional-cursor"}',false);
INSERT INTO work_items(id,tenant_id,kind,objective,reason,source,status,lease_owner,lease_expires_at,claimed_at,attempt_count) VALUES('${workId}','${a}','recovery-uncertain','Review uncertain outcome','Provider receipt not available','recovery-proof','in_progress','fixture-owner',now()+interval '1 hour',now(),1);
INSERT INTO action_queue(id,tenant_id,action_type,title,status,result,expires_at,updated_at) VALUES('${actionId}','${a}','send_stripe_invoice','Expired uncertain operation','executing','{"providerOutcome":"unknown","idempotencyKey":"fictional-operation"}',now()-interval '1 hour',now()-interval '1 day'),('${completedAction}','${a}','send_email','Already recorded send','executed','{"providerReceipt":"fictional-recorded-effect"}',now()+interval '1 hour',now());
INSERT INTO model_call_receipts(id,tenant_id,module_key,operation_key,cache_key,config_fingerprint,requested_model,state,reserved_usd,input_token_bound,output_token_bound) VALUES('${receiptId}','${a}','recovery-proof','${randomUUID()}','${"a".repeat(64)}','${"b".repeat(64)}','fictional-model','uncertain',0,1,1);
INSERT INTO model_call_events(tenant_id,receipt_id,state,reason) VALUES('${a}','${receiptId}','uncertain','Immutable provider uncertainty evidence');
NOTIFY pgrst,'reload schema';`,
    );
    // Canonical work settlement must quarantine uncertainty before snapshotting.
    const scopedSource = bindTenantDatabase(
      client(sourceApi.origin, sourceApi.serviceKey, a),
      a,
      true,
    );
    const work = await scopedSource.from("work_items").select("*").eq("id", workId).single();
    assert.ok(!work.error && work.data, "Native work fixture must be visible");
    assert.deepEqual(
      await settleWorkItem(
        scopedSource,
        work.data as WorkItem,
        reconcileWork("Provider receipt unknown; reconcile before retry"),
      ),
      [],
    );
    sql(
      source,
      `INSERT INTO action_queue(id,tenant_id,action_type,title,status,expires_at,updated_at) VALUES('${foreignAction}','${tenantB}','send_stripe_invoice','Second tenant interrupted work','executing',now()-interval '1 hour',now()-interval '1 day');`,
    );
    const paths = [`${a}/recovery.txt`, `${tenantB}/nested/recovery.txt`];
    for (const path of paths) {
      const { error } = await sourceApi.service.storage
        .from("workspace-knowledge")
        .upload(path, Buffer.from(`Private fictional file ${path}`), {
          contentType: "text/plain",
          upsert: false,
        });
      assert.equal(error, null, "Native Storage upload must succeed");
      const hash = createHash("sha256").update(`Private fictional file ${path}`).digest("hex");
      sql(
        source,
        `INSERT INTO knowledge_documents(tenant_id,title,mime_type,storage_path,content_hash,owner_email,status,extracted_text) VALUES(${literal(path.split("/")[0]!)},'Recovery knowledge','text/plain',${literal(path)},${literal(hash)},${literal(path.startsWith(a) ? owner : second)},'indexed','Private fictional recovery knowledge');`,
      );
    }
    checks.push(
      "AC01-native-records-auth-encrypted-provider-cursor-work-receipts-and-private-file-inventory",
    );
    phase = "backup";
    console.log("Native recovery: Capture records, Auth identities and actual file bytes.");
    const copy = join(root, "files");
    const fileBackup = await backupStorage(sourceApi.service.storage, source.id, copy, {
      origin: sourceApi.origin,
    });
    assert.equal(fileBackup.files, 2);
    const expected = snapshot(source);
    backupPoint = Date.now();
    const dump = run("docker", [
      "exec",
      `supabase_db_${source.id}`,
      "pg_dump",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "--format=custom",
      "--data-only",
      "--schema=public",
      "--schema=private",
      "--schema=auth",
      "--exclude-table-data=auth.schema_migrations",
    ]);
    await writeFile(join(root, "database.dump"), dump, { mode: 0o600, flag: "wx" });
    sql(
      source,
      `INSERT INTO contacts(tenant_id,full_name) VALUES('${a}','Written after the recovery point');`,
    );
    const postBackupWrite = Date.now();
    stop(source);
    phase = "restore";
    console.log("Native recovery: Start the distinct empty target and restore its private copy.");
    const restoreStarted = Date.now();
    const target = projects[1]!;
    const targetApi = await start(target);
    assert.equal(
      sql(target, "SELECT count(*) FROM auth.users;"),
      "0",
      "Owned target must have no identities",
    );
    assert.equal(
      sql(target, "SELECT count(*) FROM pg_tables WHERE schemaname='public';"),
      "0",
      "Owned target must have no application data",
    );
    sql(target, migrationProgram(priorCatalog));
    // Only this newly-created, verified empty fixture is cleared. Never a product
    // operator path: hosted restoration must follow the provider's managed flow.
    assert.equal(
      sql(target, "SELECT rolsuper FROM pg_roles WHERE rolname=current_user;", "supabase_admin"),
      "t",
      "Native fixture restoration needs its container's bootstrap administrator",
    );
    sql(
      target,
      `DO $$ DECLARE targets text; BEGIN SELECT string_agg(format('%I.%I',schemaname,tablename),',') INTO targets FROM pg_tables WHERE schemaname IN ('public','private','auth') AND NOT(schemaname='auth' AND tablename='schema_migrations'); EXECUTE 'TRUNCATE '||targets||' RESTART IDENTITY CASCADE'; END $$;`,
      "supabase_admin",
    );
    run(
      "docker",
      [
        "exec",
        "-i",
        `supabase_db_${target.id}`,
        "sh",
        "-c",
        'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_restore "$@"',
        "--",
        "-U",
        "supabase_admin",
        "-d",
        "postgres",
        "--data-only",
        "--disable-triggers",
        "--no-owner",
        "--exit-on-error",
      ],
      dump,
    );
    assert.ok(
      isDeepStrictEqual(snapshot(target), expected),
      "Restored identities, ledger, relationships, ciphertext, cursor, work and immutable receipts must match",
    );
    const cli = spawnSync(
      process.execPath,
      ["scripts/workspace-files.mjs", "restore", "--project", target.id, "--directory", copy],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
          ADMIN_EMAIL: owner,
          BOOTSTRAP_BRAND_NAME: "Recovery proof",
          NEXT_PUBLIC_SUPABASE_URL: targetApi.origin,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: targetApi.anon,
          SUPABASE_SERVICE_ROLE_KEY: targetApi.serviceKey,
          SUPABASE_PROJECT_REF: target.id,
          SUPABASE_DB_HOST: "127.0.0.1",
          SUPABASE_DB_PORT: String(target.port + 1),
          SUPABASE_DB_USER: "postgres",
        },
      },
    );
    assert.equal(cli.status, 0, "Operator CLI must produce the read-only native restore plan");
    const plan = JSON.parse(cli.stdout);
    assert.equal(plan.pending, 2);
    const restored = await restoreStorage(targetApi.service.storage, target.id, copy, {
      origin: targetApi.origin,
      apply: true,
    });
    assert.equal(restored.effectsResumeAllowed, false);
    assert.equal(
      (
        await restoreStorage(targetApi.service.storage, target.id, copy, {
          origin: targetApi.origin,
          apply: true,
        })
      ).pending,
      0,
    );
    assert.equal(
      sql(
        target,
        "SELECT count(*) FROM contacts WHERE full_name='Written after the recovery point';",
      ),
      "0",
    );
    assert.equal(
      decryptTenantSecret(envelope, a, "stripe", "api_key"),
      "fictional-provider-credential",
    );
    assert.throws(() => decryptTenantSecret(envelope, tenantB, "stripe", "api_key"));
    delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    assert.throws(() => decryptTenantSecret(envelope, a, "stripe", "api_key"), /not configured/);
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("hex");
    assert.throws(() => decryptTenantSecret(envelope, a, "stripe", "api_key"));
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = recoveryKey;
    checks.push(
      "AC02-distinct-native-target-exact-record-auth-file-ciphertext-and-relationship-restoration",
    );
    phase = "upgrade-permissions";
    console.log(
      "Native recovery: Apply pending migrations and verify login, tenant access and integrity.",
    );
    sql(target, migrationProgram(currentCatalog));
    sql(target, migrationProgram(currentCatalog));
    const upgraded = snapshot(target);
    assert.ok(
      currentCatalog.length > priorCatalog.length,
      "The pinned prior source must exercise pending migrations",
    );
    // The conversational runtime migration adds these columns to older work.
    // Existing fields must match; the new defaults must not invent an agent plan.
    const expectedAfterUpgrade = {
      ...expected,
      work_items: expected.work_items.map((row: Record<string, unknown>) => ({
        ...row,
        agent_plan: null,
        agent_plan_revision: 0,
      })),
    };
    assert.ok(
      isDeepStrictEqual(
        { ...upgraded, accelerate_schema_migrations: expected.accelerate_schema_migrations },
        expectedAfterUpgrade,
      ),
      "Populated business data must survive upgrade and replay",
    );
    assert.equal(upgraded.accelerate_schema_migrations.length, currentCatalog.length);
    for (const entry of currentCatalog)
      assert.ok(
        upgraded.accelerate_schema_migrations.some(
          (row: { file: string; checksum: string }) =>
            row.file === entry.file && row.checksum === entry.checksum,
        ),
        "Upgrade ledger must match actual migration sources",
      );
    const access = async (email: string, tenant: string) => {
      const auth = client(targetApi.origin, targetApi.anon, tenant);
      const login = await auth.auth.signInWithPassword({ email, password });
      assert.ok(!login.error && login.data.user, "Restored native password sign-in must succeed");
      assert.equal(
        login.data.user.id,
        email === owner ? firstUser.data.user.id : secondUser.data.user.id,
        "Password login must preserve the original Auth identity",
      );
      return auth;
    };
    const first = await access(owner, a),
      other = await access(second, tenantB);
    const own = await first.from("contacts").select("id");
    const theirs = await other.from("contacts").select("id");
    assert.deepEqual(
      own.data?.map((row) => row.id),
      [contactA],
    );
    assert.deepEqual(
      theirs.data?.map((row) => row.id),
      [contactB],
    );
    const foreign = await first.from("contacts").select("id").eq("id", contactB);
    assert.deepEqual(foreign.data, []);
    const denied = await client(targetApi.origin, targetApi.anon)
      .storage.from("workspace-knowledge")
      .download(paths[0]!);
    assert.ok(denied.error && !denied.data, "Anonymous private-file access must stay denied");
    const ownFile = await first.storage.from("workspace-knowledge").download(paths[0]!);
    assert.ok(!ownFile.error && ownFile.data, "Restored member must download its private file");
    const foreignFile = await first.storage.from("workspace-knowledge").download(paths[1]!);
    assert.ok(
      foreignFile.error && !foreignFile.data,
      "Second tenant's private file must stay denied",
    );
    const tampered = await access(second, a);
    assert.deepEqual(
      (await tampered.from("contacts").select("id")).data,
      [],
      "A foreign tenant header grants no membership",
    );
    sql(
      target,
      `SELECT public.platform_revoke_tenant_membership((SELECT id FROM tenant_memberships WHERE tenant_id='${tenantB}' AND user_id=${literal(secondUser.data.user.id)}),${literal(firstUser.data.user.id)},${literal(owner)});`,
    );
    assert.deepEqual(
      (await other.from("contacts").select("id")).data,
      [],
      "Revoked member must lose access",
    );
    const nativeFailure = (statement: string, message: RegExp) => {
      const result = spawnSync(
        "docker",
        [
          "exec",
          "-i",
          `supabase_db_${target.id}`,
          "psql",
          "-X",
          "-qAt",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-v",
          "ON_ERROR_STOP=1",
        ],
        { input: statement, encoding: "utf8" },
      );
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, message);
    };
    nativeFailure(
      `INSERT INTO opportunities(tenant_id,name,contact_id) VALUES('${a}','Foreign relation','${contactB}');`,
      /foreign key/i,
    );
    nativeFailure("UPDATE model_call_events SET reason='Rewritten';", /immutable/i);
    nativeFailure("DELETE FROM model_call_events;", /immutable/i);
    checks.push("AC04-populated-prior-source-upgrade-replay-native-RLS-FK-and-immutable-evidence");
    phase = "pending-work";
    console.log(
      "Native recovery: Verify interrupted work, immutable receipts and safe retry boundaries.",
    );
    const scopedTarget = bindTenantDatabase(
      client(targetApi.origin, targetApi.serviceKey, a),
      a,
      true,
    );
    const workClaim = await claimWorkItem(scopedTarget, {
      kind: "recovery-uncertain",
      workItemId: workId,
      leaseOwner: "restored-worker",
    });
    assert.equal(workClaim.claimed, false, "Unknown effects must remain quarantined after restore");
    assert.equal(
      sql(target, `SELECT status FROM action_queue WHERE id='${actionId}';`),
      "executing",
      "Interrupted action checkpoint must survive restoration",
    );
    await assert.rejects(
      claimApprovedAction(scopedTarget, completedAction, owner),
      /already handled|expired/,
    );
    await assert.rejects(retryPluginAction(scopedTarget, actionId, owner), /reconcile/);
    assert.equal(
      sql(target, `SELECT status FROM action_queue WHERE id='${actionId}';`),
      "failed",
      "Canonical stale-claim recovery closes the interrupted action without replay",
    );
    assert.equal(
      sql(target, `SELECT status FROM action_queue WHERE id='${foreignAction}';`),
      "executing",
      "One tenant's recovery must not alter another tenant's interrupted action",
    );
    assert.equal(
      sql(target, `SELECT status FROM action_queue WHERE id='${completedAction}';`),
      "executed",
    );
    assert.equal(
      sql(target, `SELECT result->>'idempotencyKey' FROM action_queue WHERE id='${actionId}';`),
      "fictional-operation",
    );
    assert.equal(sql(target, `SELECT status FROM work_items WHERE id='${workId}';`), "failed");
    assert.equal(
      sql(target, "SELECT count(*) FROM vault.secrets;"),
      "0",
      "Scheduler has no recovered outbound credentials",
    );
    checks.push(
      "AC03-restored-unknown-work-quarantined-terminal-actions-not-replayed-expired-retry-refused",
    );
    const recoveryMs = Date.now() - restoreStarted;
    checks.push(
      "AC05-measured-recovery-point-and-time-provider-config-key-and-hosted-boundaries-explicit",
      "AC06-read-only-file-plan-safe-replay-and-owned-native-recovery-command",
    );
    receipt = {
      status: "passed",
      commit: run("git", ["rev-parse", "HEAD"]).toString().trim(),
      tree: run("git", ["rev-parse", "HEAD^{tree}"]).toString().trim(),
      priorSourceCommit: prior,
      checks,
      proof: "native-local-supabase",
      inventory: {
        tables: tables.map((table) => ({ table, rows: expected[table].length })),
        authUsers: expected.auth_users.length,
        files: fileBackup.files,
        bytes: fileBackup.bytes,
        migrations: currentCatalog.length,
      },
      timing: {
        backupPoint: new Date(backupPoint).toISOString(),
        postBackupWrite: new Date(postBackupWrite).toISOString(),
        recoveryMs,
        observedLossWindowMs: postBackupWrite - backupPoint,
        totalMs: Date.now() - began,
      },
      upgrade: {
        priorMigrations: priorCatalog.length,
        currentMigrations: currentCatalog.length,
        applicationSchemaChange: priorCatalog.length !== currentCatalog.length,
      },
      effectsResumeAllowed: false,
      exclusions: [
        "Hosted provider restore",
        "real provider authorization or sends",
        "Vault secrets and scheduler activation",
        "human recovery and production promotion",
        "stable tagged release, which is not yet published",
      ],
    };
  } catch (error) {
    await writeFile(
      join(output, "failure.json"),
      JSON.stringify(
        {
          status: "failed",
          phase,
          checks,
          elapsedMs: Date.now() - began,
          message: safe(error instanceof Error ? error.message : "Recovery failed"),
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    throw error;
  } finally {
    let cleanupFailed = false;
    for (const project of projects) {
      try {
        stop(project);
      } catch {
        cleanupFailed = true;
        console.error(
          `Owned ${project.id.endsWith("source") ? "source" : "target"} cleanup did not complete; no other project was stopped.`,
        );
      }
    }
    await rm(root, { recursive: true, force: true });
    if (cleanupFailed) {
      await writeFile(
        join(output, "cleanup-failure.json"),
        JSON.stringify({
          status: "failed",
          phase: "cleanup",
          message:
            "Owned native project cleanup did not complete; no successful receipt was issued.",
        }),
        { mode: 0o600 },
      );
      throw new Error("Owned native project cleanup did not complete");
    }
  }
  assert.ok(receipt, "Every acceptance proof must finish before the recovery receipt");
  await writeFile(
    join(output, "receipt.json"),
    JSON.stringify({ ...receipt, ownedProjectsCleaned: true }, null, 2) + "\n",
    { mode: 0o600 },
  );
  console.log(
    `PASS: native recovery and prior-source upgrade (${checks.length} acceptance proofs). External effects remain disabled; owned fixtures are cleaned.`,
  );
}

void main().catch((error) => {
  console.error(safe(error instanceof Error ? error.message : "Native recovery failed"));
  console.error(
    "Native recovery did not pass. Inspect the stage receipt and safe command diagnostic; keep effects disabled.",
  );
  process.exitCode = 1;
});
