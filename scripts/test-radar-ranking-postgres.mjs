import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  runPsql,
  psqlArgs,
  readDatabasePassword,
  POOLER_HOST,
} from "./lib/accelerate-database.mjs";
assert.ok(["localhost", "127.0.0.1"].includes(POOLER_HOST));
const tenant = "acce1e8e-0000-4000-8000-000000000001";
const json = (v) => "'" + JSON.stringify(v).replaceAll("'", "''") + "'::jsonb";
const config = { modules: { "opportunity-radar": true } };
const context = `SET request.headers='{"x-tenant-id":"${tenant}"}'; SET request.jwt.claim.role='service_role'; SET ROLE service_role;`;
function sql(input) {
  const r = runPsql(["-qAt"], { input });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function fail(input) {
  const r = runPsql(["-qAt"], { input });
  assert.notEqual(r.status, 0, "Expected refusal");
  return r.stderr;
}
const store = (change, workspace = tenant) =>
  JSON.parse(
    sql(
      context.replace(tenant, workspace) +
        `SELECT execute_radar_store_command('${randomUUID()}',${json(change)},${json(config)},'[]','owner@example.test');`,
    ),
  ).receipt;
sql(`UPDATE tenants SET status='active',config=${json(config)} WHERE id='${tenant}'`);
const source = store({
  operation: "ingest_source",
  url: "https://example.test/ranking",
  title: "Equipment training",
  bodyText: "Equipment supplier offers a workshop",
}).entity_id;
store({
  operation: "review_source",
  sourceVersionId: source,
  expectedRevision: 1,
  verification: "verified",
  reason: "Controlled source review",
});
const opp = store({
  operation: "create_opportunity",
  title: "Training partnership",
  summary: "Supplier workshop collaboration",
  recommendedAction: "Review a training format",
  kind: "partnership",
  citations: [{ sourceVersionId: source, observation: "Workshop offered" }],
}).entity_id;
const assessment = {
  classification: "business",
  classificationReason: "Equipment training partnership",
  topicKey: "training",
  estimates: Object.fromEntries(
    [
      "relevance",
      "authority",
      "timeliness",
      "reachability",
      "recognition",
      "differentiation",
      "compounding",
    ].map((k) => [
      k,
      {
        value: 80,
        confidence: "medium",
        rationale: "Operator estimate from supplied workshop details",
        sourceVersionIds: [source],
      },
    ]),
  ),
  effort: 2,
  timeToValue: "week",
  nextAction: "Discuss workshop format",
  alternatives: ["Prepare an outline"],
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
};
const snapshots = [{ id: source, revision: 2, verification: "verified" }];
const command = (
  key,
  data = assessment,
  previous = null,
  versions = snapshots,
  opportunity = opp,
) =>
  context +
  `SELECT review_radar_assessment('${key}','${opportunity}',1,${previous ? "'" + previous + "'" : "NULL"},${json(data)},${json(versions)},${json(config)},'owner@example.test');`;
function concurrent(input) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", [...psqlArgs(), "-qAt"], {
      env: { ...process.env, PGPASSWORD: readDatabasePassword() },
    });
    let out = "",
      err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve(JSON.parse(out.trim())) : reject(new Error(err)),
    );
    child.stdin.end(input);
  });
}
const key = randomUUID();
const raced = await Promise.all([concurrent(command(key)), concurrent(command(key))]);
assert.deepEqual(raced.map((x) => x.replayed).sort(), [false, true]);
const id = raced[0].assessment.id;
assert.equal(sql(`SELECT count(*) FROM radar_assessments WHERE opportunity_id='${opp}'`), "1");
assert.match(fail(command(key, { ...assessment, effort: 3 })), /identity conflict/);
assert.match(fail(command(randomUUID())), /assessment changed/);
assert.match(
  fail(command(randomUUID(), { ...assessment, nextAction: "Pitch a senator" }, id)),
  /neutral review/,
);
assert.match(fail(command(randomUUID(), { ...assessment, estimates: {} }, id)), /Seven explicit/);
assert.match(
  fail(
    command(
      randomUUID(),
      { ...assessment, expiresAt: new Date(Date.now() - 1000).toISOString() },
      id,
    ),
  ),
  /expiry/,
);
assert.match(fail(command(randomUUID(), assessment, null, snapshots, randomUUID())), /unavailable/);
const foreignTenant = "22222222-2222-4222-8222-222222222222";
const foreignSource = store(
  {
    operation: "ingest_source",
    url: "https://example.test/foreign-ranking",
    title: "Foreign workshop",
    bodyText: "A different workspace",
  },
  foreignTenant,
).entity_id;
const foreignOpp = store(
  {
    operation: "create_opportunity",
    title: "Foreign workshop",
    summary: "Other workspace",
    recommendedAction: "Review",
    kind: "partnership",
    citations: [{ sourceVersionId: foreignSource, observation: "Other workspace" }],
  },
  foreignTenant,
).entity_id;
assert.match(fail(command(randomUUID(), assessment, null, snapshots, foreignOpp)), /unavailable/);
assert.match(fail(`UPDATE radar_assessments SET assessment='{}' WHERE id='${id}'`), /immutable/);
assert.match(
  fail(
    `SET ROLE authenticated; SELECT review_radar_assessment('${randomUUID()}','${opp}',1,NULL,${json(assessment)},${json(snapshots)},${json(config)},'owner@example.test')`,
  ),
  /permission denied/,
);
store({
  operation: "review_source",
  sourceVersionId: source,
  expectedRevision: 2,
  verification: "retracted",
  reason: "Source corrected",
});
assert.match(fail(command(randomUUID(), assessment, id)), /evidence changed/);
const current = [{ id: source, revision: 3, verification: "retracted" }];
assert.match(fail(command(randomUUID(), assessment, id, current)), /reviewed sources/);
const neutral = JSON.parse(
  sql(command(randomUUID(), { ...assessment, classification: "unknown" }, id, current)),
);
assert.equal(neutral.assessment.assessment.classification, "unknown");
assert.equal(
  sql(`SELECT id FROM radar_current_assessments WHERE opportunity_id='${opp}'`),
  neutral.assessment.id,
);
sql(`UPDATE tenants SET config='{}' WHERE id='${tenant}'`);
assert.equal(JSON.parse(sql(command(key))).replayed, true);
assert.match(fail(command(randomUUID(), assessment, neutral.assessment.id, current)), /disabled/);
sql(`UPDATE tenants SET config=${json(config)} WHERE id='${tenant}'`);
console.log(
  "PASS: Radar assessment native PostgreSQL concurrent replay, immutable judgments, subject/source/schema checks, freshness, neutral reassessment, authenticated refusal and disabled replay.",
);
