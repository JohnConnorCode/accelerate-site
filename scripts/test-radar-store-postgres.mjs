import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  runPsql,
  psqlArgs,
  readDatabasePassword,
  POOLER_HOST,
} from "./lib/accelerate-database.mjs";
assert.ok(
  ["localhost", "127.0.0.1"].includes(POOLER_HOST),
  "Radar proof must use the isolated local fixture",
);
const a = "acce1e8e-0000-4000-8000-000000000001",
  b = "22222222-2222-4222-8222-222222222222";
const literal = (value) => "'" + String(value).replaceAll("'", "''") + "'";
const json = (value) => literal(JSON.stringify(value)) + "::jsonb";
function sql(input) {
  const result = runPsql(["-qAt"], { input });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function fail(input) {
  const result = runPsql(["-qAt"], { input });
  assert.notEqual(result.status, 0, "Expected refusal");
  return result.stderr;
}
const context = (tenant) =>
  `SET request.headers='{"x-tenant-id":"${tenant}"}'; SET request.jwt.claim.role='service_role'; SET ROLE service_role;`;
const config = { modules: { "opportunity-radar": true } };
sql(`UPDATE tenants SET config=${json(config)},status='active' WHERE id IN ('${a}','${b}');`);
const command = (tenant, operationId, change, expectedSources = [], expectedConfig = config) =>
  context(tenant) +
  `SELECT execute_radar_store_command('${operationId}',${json(change)},${json(expectedConfig)},${json(expectedSources)},'owner@example.test');`;
const execute = (change, tenant = a, operationId = randomUUID(), sources = []) =>
  JSON.parse(sql(command(tenant, operationId, change, sources)));
const ingest = {
  operation: "ingest_source",
  url: "https://example.test/workshop",
  title: "Workshop announcement",
  bodyText: "Fictional workshop announced. This text is supplied, not externally verified.",
  publishedAt: null,
};
const key = randomUUID();
function concurrent(input) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", [...psqlArgs(), "-qAt"], {
      env: { ...process.env, PGPASSWORD: readDatabasePassword() },
    });
    let out = "",
      err = "";
    child.stdout.on("data", (data) => (out += data));
    child.stderr.on("data", (data) => (err += data));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err))));
    child.stdin.end(input);
  });
}
const raced = await Promise.all([1, 2].map(() => concurrent(command(a, key, ingest))));
const receipts = raced.map((value) => JSON.parse(value));
assert.deepEqual(receipts.map((value) => value.replayed).sort(), [false, true]);
const sourceVersion = receipts[0].receipt.entity_id;
assert.equal(sql(`SELECT count(*) FROM radar_source_versions WHERE tenant_id='${a}'`), "1");
assert.equal(sql(`SELECT count(*) FROM radar_discoveries WHERE tenant_id='${a}'`), "1");
assert.match(fail(command(a, key, { ...ingest, title: "Changed identity" })), /identity conflict/);
assert.equal(
  execute(ingest).receipt.entity_id,
  sourceVersion,
  "content dedupe survives a different request key",
);
const updated = execute({ ...ingest, bodyText: "Corrected fictional workshop details." }).receipt
  .entity_id;
assert.notEqual(updated, sourceVersion);
assert.equal(
  sql(
    `SELECT string_agg(version::text,',' ORDER BY version) FROM radar_source_versions WHERE tenant_id='${a}'`,
  ),
  "1,2",
);
assert.equal(
  sql(`SELECT verification FROM radar_source_versions WHERE id='${updated}'`),
  "supplied",
);
const foreignVersion = execute(ingest, b).receipt.entity_id;
assert.notEqual(foreignVersion, sourceVersion);
assert.match(
  fail(`UPDATE radar_source_versions SET body_text='edited' WHERE id='${sourceVersion}'`),
  /new version/,
);
assert.match(fail(`DELETE FROM radar_source_versions WHERE id='${sourceVersion}'`), /immutable/);
const contactA = sql(`SELECT id FROM contacts WHERE tenant_id='${a}' LIMIT 1`),
  contactB = sql(`SELECT id FROM contacts WHERE tenant_id='${b}' LIMIT 1`);
const evidence = sql(
  context(a) +
    `SELECT evidence_id FROM record_evidence('contact','${contactA}','fixture_note','Unverified test note','fixture','Controlled source text','model_inference');`,
);
const create = {
  operation: "create_opportunity",
  title: "Explore a workshop partnership",
  summary: "A supplied announcement suggests a workshop.",
  recommendedAction: "Review whether a workshop collaboration is useful",
  kind: "partnership",
  contactId: contactA,
  citations: [
    {
      sourceVersionId: sourceVersion,
      observation: "Workshop mentioned in supplied text",
      evidenceId: evidence,
    },
  ],
};
const opportunity = execute(create).receipt.entity_id;
assert.equal(
  sql(`SELECT evidence_id FROM radar_evidence_links WHERE opportunity_id='${opportunity}'`),
  evidence,
);
assert.equal(
  sql(`SELECT review_lane FROM radar_opportunities WHERE id='${opportunity}'`),
  "neutral_review",
);
const beforeCount = sql("SELECT count(*) FROM radar_opportunities");
assert.match(fail(command(a, randomUUID(), { ...create, contactId: contactB })), /foreign key/);
assert.match(
  fail(
    command(a, randomUUID(), {
      ...create,
      citations: [{ sourceVersionId: foreignVersion, observation: "Foreign" }],
    }),
  ),
  /unavailable/,
);
assert.match(
  fail(
    command(a, randomUUID(), {
      ...create,
      citations: [
        create.citations[0],
        { sourceVersionId: randomUUID(), observation: "Missing second source" },
      ],
    }),
  ),
  /unavailable/,
);
assert.equal(
  sql("SELECT count(*) FROM radar_opportunities"),
  beforeCount,
  "partial citation failure must roll back opportunity creation",
);
const transition = (state, revision) => ({
  operation: "transition_opportunity",
  opportunityId: opportunity,
  expectedRevision: revision,
  state,
  reason: "Controlled lifecycle proof",
});
assert.match(fail(command(a, randomUUID(), transition("completed", 1))), /Invalid Radar lifecycle/);
execute(transition("needs_review", 1));
assert.match(fail(command(a, randomUUID(), transition("approved", 2))), /Review every source/);
execute({
  operation: "review_source",
  sourceVersionId: sourceVersion,
  expectedRevision: 1,
  verification: "verified",
  reason: "Controlled human source verification; this does not verify independent recognition",
});
assert.match(
  fail(
    command(a, randomUUID(), transition("approved", 2), [
      { id: sourceVersion, revision: 1, verification: "supplied" },
    ]),
  ),
  /Source review changed/,
);
execute(transition("approved", 2), a, randomUUID(), [
  { id: sourceVersion, revision: 2, verification: "verified" },
]);
assert.match(fail(command(a, randomUUID(), transition("in_progress", 2))), /Stale opportunity/);
execute(transition("in_progress", 3));
const asset = execute({
  operation: "add_asset",
  opportunityId: opportunity,
  expectedRevision: 4,
  kind: "brief",
  title: "Workshop brief",
  bodyText: "A draft, not a sent message.",
  sourceVersionIds: [sourceVersion],
}).receipt.after_state.created_record_id;
assert.equal(sql(`SELECT state FROM radar_assets WHERE id='${asset}'`), "draft");
const outcome = execute({
  operation: "record_outcome",
  opportunityId: opportunity,
  expectedRevision: 5,
  kind: "partnership",
  description: "Operator reports a discussion; independent validation remains pending.",
  sourceVersionId: updated,
}).receipt.after_state.created_record_id;
assert.equal(sql(`SELECT verification FROM radar_outcomes WHERE id='${outcome}'`), "reported");
execute({
  operation: "review_source",
  sourceVersionId: sourceVersion,
  expectedRevision: 2,
  verification: "retracted",
  reason: "Source corrected",
});
assert.match(fail(command(a, randomUUID(), transition("completed", 6))), /Review every source/);
execute({
  operation: "replace_citations",
  opportunityId: opportunity,
  expectedRevision: 6,
  citations: [{ sourceVersionId: updated, observation: "Corrected source statement" }],
  reason: "Retain old citations and use corrected source",
});
assert.equal(
  sql(`SELECT state||':'||evidence_revision FROM radar_opportunities WHERE id='${opportunity}'`),
  "needs_review:7",
);
assert.equal(
  sql(`SELECT count(*) FROM radar_evidence_links WHERE opportunity_id='${opportunity}'`),
  "2",
);
assert.equal(
  sql(`SELECT source_version_id FROM radar_asset_sources WHERE asset_id='${asset}'`),
  sourceVersion,
  "historical draft citations stay intact",
);
assert.match(
  fail(
    `UPDATE radar_evidence_links SET observation='rewrite history' WHERE opportunity_id='${opportunity}'`,
  ),
  /immutable/,
);
assert.match(
  fail(`UPDATE radar_store_receipts SET after_state='{}' WHERE tenant_id='${a}'`),
  /immutable/,
);
// A failure after inserting every business record must still roll back the whole command.
sql(
  `CREATE FUNCTION public.radar_proof_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='radar.store.receipted' THEN RAISE EXCEPTION 'controlled audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER radar_proof_audit_failure BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION public.radar_proof_audit_failure();`,
);
const failedKey = randomUUID(),
  failedSource = { ...ingest, url: "https://example.test/rollback" };
assert.match(fail(command(a, failedKey, failedSource)), /controlled audit failure/);
assert.equal(
  sql("SELECT count(*) FROM radar_sources WHERE canonical_url='https://example.test/rollback'"),
  "0",
);
assert.equal(
  sql(`SELECT count(*) FROM radar_store_receipts WHERE operation_key='${failedKey}'`),
  "0",
);
sql(
  "DROP TRIGGER radar_proof_audit_failure ON audit_log; DROP FUNCTION public.radar_proof_audit_failure();",
);
assert.equal(execute(failedSource, a, failedKey).replayed, false);
sql(`UPDATE tenants SET config='{}' WHERE id='${a}'`);
assert.match(fail(command(a, randomUUID(), ingest)), /disabled/);
assert.equal(
  JSON.parse(sql(command(a, key, ingest))).replayed,
  true,
  "disabled replay returns the retained receipt without a new write",
);
sql(`UPDATE tenants SET status='suspended' WHERE id='${a}'`);
assert.match(fail(command(a, randomUUID(), ingest)), /unavailable/);
sql(`UPDATE tenants SET status='active',config=${json(config)} WHERE id='${a}'`);
assert.match(
  fail(
    `SET request.headers='{"x-tenant-id":"${a}"}'; SET request.jwt.claim.role='authenticated'; SET ROLE authenticated; SELECT execute_radar_store_command('${randomUUID()}',${json(ingest)},${json(config)},'[]','owner@example.test');`,
  ),
  /permission denied/,
);
assert.equal(
  sql(
    `SET request.headers='{"x-tenant-id":"${a}"}'; SET request.jwt.claim.sub='11111111-1111-4111-8111-111111111111'; SET request.jwt.claim.role='authenticated'; SET ROLE authenticated; SELECT count(*) FROM radar_sources WHERE tenant_id='${b}';`,
  ),
  "0",
);
assert.equal(
  sql(`SELECT count(*) FROM contacts WHERE tenant_id='${a}'`),
  "1",
  "no duplicate CRM people",
);
console.log(
  "PASS: Radar native PostgreSQL source versioning, concurrent replay, tenant-composite CRM/evidence links, lifecycle/OCC, source freshness, draft/reported distinctions, immutable citation history, audit rollback and disabled/suspended refusal.",
);
