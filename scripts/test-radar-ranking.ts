import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import {
  previewRadarAssessment,
  proposeRadarAssessment,
  executeRadarAssessment,
  getRadarSelection,
} from "../src/lib/revenue-os/radar-ranking";
import {
  RADAR_FACTORS,
  RADAR_DEFAULT_WEIGHTS,
  radarAssessmentSchema,
  scoreRadarAssessment,
  selectRadarCandidates,
  type RadarAssessment,
} from "../src/lib/revenue-os/radar-ranking-contract";
const now = new Date("2026-09-06T12:00:00Z"),
  tenant = randomUUID(),
  opp = randomUUID(),
  source = randomUUID(),
  version = randomUUID();
function assessment(): RadarAssessment {
  return radarAssessmentSchema.parse({
    classification: "business",
    classificationReason: "An equipment workshop collaboration",
    topicKey: "equipment-workshop",
    estimates: Object.fromEntries(
      RADAR_FACTORS.map((key) => [
        key,
        {
          value: 80,
          confidence: "medium",
          rationale: "Operator judgment from the workshop announcement",
          sourceVersionIds: [version],
        },
      ]),
    ),
    effort: 2,
    timeToValue: "day",
    nextAction: "Review workshop format with the training company",
    alternatives: ["Prepare a workshop outline"],
    expiresAt: "2026-09-20T12:00:00Z",
  });
}
function fixture() {
  const mem = new AuthorizedMemorySupabase({
    tenants: [
      {
        id: tenant,
        status: "active",
        config: {
          modules: { "opportunity-radar": true },
          moduleSettings: { "opportunity-radar": { dailyShortlist: 3 } },
        },
      },
    ],
    radar_opportunities: [
      {
        id: opp,
        tenant_id: tenant,
        title: "Workshop",
        summary: "Equipment training",
        recommended_action: "Discuss workshop format",
        kind: "partnership",
        state: "needs_review",
        revision: 1,
        evidence_revision: 1,
        updated_at: now.toISOString(),
      },
    ],
    radar_source_versions: [
      {
        id: version,
        tenant_id: tenant,
        source_id: source,
        title: "Workshop",
        body_text: "Equipment supplier offers training",
        revision: 1,
        verification: "verified",
      },
    ],
    radar_sources: [
      { id: source, tenant_id: tenant, canonical_url: "https://example.test/training" },
    ],
    radar_evidence_links: [
      {
        id: randomUUID(),
        tenant_id: tenant,
        opportunity_id: opp,
        opportunity_revision: 1,
        source_version_id: version,
        observation: "Training offered",
      },
    ],
    radar_current_evidence_links: [],
    radar_assessments: [],
    radar_current_assessments: [],
    radar_assets: [],
    radar_outcomes: [],
    radar_store_receipts: [],
    action_queue: [],
    audit_log: [],
  });
  mem.tables.radar_current_evidence_links = mem.tables.radar_evidence_links!;
  mem.idFactory = () => randomUUID();
  let calls = 0;
  mem.rpc("review_radar_assessment", () => {
    calls++;
    return { replayed: false, assessment: { id: randomUUID() } };
  });
  return { mem, db: bindTenantDatabase(mem.client, tenant, true), calls: () => calls };
}
async function main() {
  const a = assessment();
  assert.equal(scoreRadarAssessment(a, RADAR_DEFAULT_WEIGHTS)?.score, 80);
  const varied = assessment();
  varied.estimates.relevance.value = 100;
  varied.estimates.authority.value = 0;
  assert.equal(scoreRadarAssessment(varied, RADAR_DEFAULT_WEIGHTS)?.score, 72);
  assert.throws(() => scoreRadarAssessment(a, { ...RADAR_DEFAULT_WEIGHTS, relevance: 21 }), /sum/);
  const unknown = assessment();
  unknown.estimates.authority.value = null;
  assert.equal(scoreRadarAssessment(unknown, RADAR_DEFAULT_WEIGHTS), null);
  const zero = assessment();
  for (const key of RADAR_FACTORS) zero.estimates[key].value = 0;
  assert.equal(scoreRadarAssessment(zero, RADAR_DEFAULT_WEIGHTS)?.score, 0);
  assert.equal(
    scoreRadarAssessment({ ...a, classification: "public_affairs" }, RADAR_DEFAULT_WEIGHTS),
    null,
  );
  assert.equal(
    scoreRadarAssessment({ ...a, nextAction: "Pitch a political party" }, RADAR_DEFAULT_WEIGHTS),
    null,
  );
  const candidate = (id: string, value = a) => ({
    id,
    assessment: value,
    reviewedAt: now.toISOString(),
    deferral: null,
  });
  const selection = selectRadarCandidates(
    [
      candidate("one"),
      candidate("two"),
      candidate("unknown", unknown),
      candidate("neutral", { ...a, classification: "unknown" }),
      candidate("expired", { ...a, expiresAt: "2026-09-05T00:00:00Z" }),
    ],
    {},
    5,
    now,
  );
  assert.equal(selection.selected.length, 1);
  assert.equal(selection.unranked.length, 2);
  assert.ok(selection.deferred.some((x) => x.reason.includes("topic")));
  assert.ok(selection.deferred.some((x) => x.reason.includes("expired")));
  const fresh = selectRadarCandidates([candidate("one")], {}, 5, now).selected[0]!;
  const older = selectRadarCandidates(
    [{ ...candidate("one"), reviewedAt: "2026-08-30T12:00:00Z" }],
    {},
    5,
    now,
  ).selected[0]!;
  assert.equal(older.decay, 0.5);
  assert.ok(Math.abs(older.priority * 2 - fresh.priority) <= 0.01);
  assert.equal(
    selectRadarCandidates([candidate("one")], { maxTotalEffort: 1 }, 5, now).selected.length,
    0,
  );
  assert.equal(selectRadarCandidates([candidate("one")], {}, 5, now).modelCalls, 0);
  {
    const f = fixture();
    const operationId = randomUUID();
    const request = {
      operationId,
      opportunityId: opp,
      expectedRevision: 1,
      assessment: { ...assessment(), expiresAt: new Date(Date.now() + 86400000).toISOString() },
    };
    const preview = await previewRadarAssessment(f.db, request);
    assert.equal(f.calls(), 0);
    const proposal = await proposeRadarAssessment(
      f.db,
      { ...request, digest: preview.digest },
      "owner@example.test",
    );
    assert.equal(f.calls(), 0);
    assert.ok(proposal.id);
    await approveAndExecuteAction(f.db, proposal.id, "owner@example.test");
    assert.equal(f.mem.rows("action_queue")[0]!.status, "executed");
    assert.equal(f.calls(), 1);
    await assert.rejects(() => approveAndExecuteAction(f.db, proposal.id, "owner@example.test"));
  }
  {
    const f = fixture();
    const request = {
      operationId: randomUUID(),
      opportunityId: opp,
      expectedRevision: 1,
      assessment: { ...assessment(), expiresAt: new Date(Date.now() + 86400000).toISOString() },
    };
    const preview = await previewRadarAssessment(f.db, request);
    const { requiresHumanApproval, interpretation, ...payload } = preview;
    assert.ok(requiresHumanApproval && interpretation);
    f.mem.tables.radar_source_versions![0]!.revision = 2;
    await assert.rejects(
      () => executeRadarAssessment(f.db, payload, "owner@example.test"),
      /changed/,
    );
    assert.equal(f.calls(), 0);
    f.mem.tables.radar_source_versions![0]!.revision = 1;
    f.mem.tables.radar_source_versions![0]!.body_text = "A senator proposes public policy";
    await assert.rejects(() => previewRadarAssessment(f.db, request), /neutral manual/);
    f.mem.tables.radar_source_versions![0]!.body_text = "Equipment workshop";
    f.mem.tables.radar_source_versions![0]!.verification = "supplied";
    await assert.rejects(() => previewRadarAssessment(f.db, request), /Review every source/);
    await previewRadarAssessment(f.db, {
      ...request,
      assessment: { ...request.assessment, classification: "unknown" },
    });
  }
  {
    const f = fixture();
    const request = {
      operationId: randomUUID(),
      opportunityId: opp,
      expectedRevision: 1,
      assessment: { ...assessment(), expiresAt: new Date(Date.now() + 86400000).toISOString() },
    };
    request.assessment.estimates.authority.sourceVersionIds = [randomUUID()];
    await assert.rejects(() => previewRadarAssessment(f.db, request), /current opportunity/);
    await assert.rejects(
      () => previewRadarAssessment(f.db, { ...request, opportunityId: randomUUID() }),
      /unavailable/,
    );
  }
  {
    const f = fixture();
    f.mem.tables.radar_current_assessments!.push({
      id: randomUUID(),
      tenant_id: tenant,
      opportunity_id: opp,
      opportunity_revision: 1,
      assessment: a,
      source_snapshots: [{ id: version, revision: 1, verification: "verified" }],
      created_at: now.toISOString(),
    });
    for (const preset of ["superdebate", "service-business"]) {
      f.mem.tables.tenants![0]!.config = {
        modules: { "opportunity-radar": true },
        moduleSettings: {
          "opportunity-radar": JSON.parse(
            readFileSync(`plugins/opportunity-radar/presets/${preset}.json`, "utf8"),
          ),
        },
      };
      assert.equal((await getRadarSelection(f.db, {}, now)).selected.length, 1);
    }
    const result = await getRadarSelection(f.db, {}, now);
    assert.equal(result.selected.length, 1);
    assert.equal(result.selected[0]!.score, 80);
    f.mem.tables.radar_source_versions![0]!.revision = 2;
    const stale = await getRadarSelection(f.db, {}, now);
    assert.equal(stale.selected.length, 0);
    assert.match(stale.deferred[0]!.reason, /Evidence changed/);
    f.mem.tables.tenants![0]!.config = { modules: { "opportunity-radar": false } };
    await assert.rejects(() => getRadarSelection(f.db, {}, now), /disabled/);
  }
  console.log(
    "PASS: Radar weighted estimates, unknown/zero distinction, neutral routing, decay, diversity, effort cap, approval-only execution, source freshness, foreign evidence and disabled selection.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
