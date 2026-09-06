import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RADAR_PROFILE_DEFAULTS } from "../src/lib/revenue-os/radar-profile-contract";
import { randomUUID } from "node:crypto";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import {
  previewRadarStoreChange,
  proposeRadarStoreChange,
  executeRadarStoreChange,
  readRadarStore,
} from "../src/lib/revenue-os/radar-store";
import { executeRegisteredRevenueTool } from "../src/lib/revenue-os/ai-tools";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
const a = randomUUID(),
  b = randomUUID(),
  source = randomUUID(),
  version = randomUUID(),
  opp = randomUUID(),
  contact = randomUUID();
function fixture() {
  const config = { modules: { "opportunity-radar": true } };
  const mem = new AuthorizedMemorySupabase({
    tenants: [
      { id: a, status: "active", config },
      { id: b, status: "active", config },
    ],
    radar_sources: [{ id: source, tenant_id: a, canonical_url: "https://example.test/workshop" }],
    radar_source_versions: [
      {
        id: version,
        tenant_id: a,
        source_id: source,
        title: "Workshop",
        version: 1,
        revision: 1,
        verification: "supplied",
        version_hash: "a".repeat(64),
        content_hash: "b".repeat(64),
        body_text: "Evidence ".repeat(500),
        created_at: "2026-09-06T00:00:00Z",
      },
    ],
    radar_opportunities: [
      {
        id: opp,
        tenant_id: a,
        title: "Workshop partnership",
        summary: "A potential maintenance workshop",
        recommended_action: "Review a workshop proposal",
        kind: "partnership",
        state: "needs_review",
        review_lane: "neutral_review",
        contact_id: contact,
        company_id: null,
        revision: 1,
        evidence_revision: 1,
        created_at: "2026-09-06T00:00:00Z",
        updated_at: "2026-09-06T00:00:00Z",
      },
    ],
    radar_evidence_links: [
      {
        id: randomUUID(),
        tenant_id: a,
        opportunity_id: opp,
        opportunity_revision: 1,
        source_version_id: version,
        evidence_id: null,
        observation: "The supplied workshop announcement",
      },
    ],
    contacts: [{ id: contact, tenant_id: a }],
    companies: [],
    evidence: [],
    entity_types: [],
    radar_store_receipts: [],
    radar_assets: [],
    radar_outcomes: [],
    audit_log: [],
    action_queue: [],
  });
  mem.idFactory = () => randomUUID();
  const db = bindTenantDatabase(mem.client, a, true);
  const receiptId = randomUUID();
  mem.rpc("execute_radar_store_command", (args) => {
    const prior = mem
      .rows("radar_store_receipts")
      .find((row) => row.operation_key === args.p_operation_key);
    if (prior) return { replayed: true, receipt: prior };
    const receipt = {
      id: receiptId,
      tenant_id: a,
      operation_key: args.p_operation_key,
      operation: "ingest_source",
      entity_id: version,
      after_state: { id: version },
    };
    mem.tables.radar_store_receipts!.push(receipt);
    return { replayed: false, receipt };
  });
  return { mem, db, config };
}
const ingest = {
  operation: "ingest_source",
  url: "https://example.test/source#section",
  title: "Fictional workshop",
  bodyText: "A fictional studio announced a workshop.",
};
const checks: string[] = [];
async function scenario(name: string, run: () => Promise<void>) {
  await run();
  checks.push(name);
}
async function main() {
  await scenario(
    "preview and proposal have no store effect; approved executor uses the narrow host",
    async () => {
      const f = fixture(),
        operationId = randomUUID();
      const preview = await previewRadarStoreChange(f.db, { operationId, change: ingest });
      assert.equal(preview.change.operation, "ingest_source");
      assert.equal((preview.change as { url: string }).url, "https://example.test/source");
      const context = {
        supabase: f.db,
        actorEmail: "owner@example.test",
        tenantConfig: f.config,
        toolPack: "core" as const,
      };
      const proposed = await executeRegisteredRevenueTool(context, "propose_radar_store_change", {
        operationId,
        change: ingest,
        digest: preview.digest,
      });
      const action = proposed.output as { id: string };
      assert.equal(
        f.mem.rpcCalls.filter((call) => call.name === "execute_radar_store_command").length,
        0,
      );
      await approveAndExecuteAction(f.db, action.id, context.actorEmail);
      assert.equal(f.mem.rows("action_queue")[0]!.status, "executed");
      assert.equal(f.mem.rows("radar_store_receipts").length, 1);
      assert.equal(f.mem.rows("entity_types").length, 4);
      assert.equal(
        f.mem.rpcCalls.find((call) => call.name === "execute_radar_store_command")!.args
          .p_operation_key,
        operationId,
      );
      await assert.rejects(
        () => approveAndExecuteAction(f.db, action.id, context.actorEmail),
        /already handled/,
      );
    },
  );
  await scenario(
    "stale profile, source revision and missing foreign references refuse before execution",
    async () => {
      const f = fixture(),
        operationId = randomUUID();
      const preview = await previewRadarStoreChange(f.db, { operationId, change: ingest });
      const proposed = await proposeRadarStoreChange(
        f.db,
        { operationId, change: ingest, digest: preview.digest },
        "owner@example.test",
      );
      f.mem.tables.tenants![0]!.config = { modules: { "opportunity-radar": false } };
      await assert.rejects(
        () => approveAndExecuteAction(f.db, proposed.id, "owner@example.test"),
        /disabled/,
      );
      assert.equal(f.mem.rows("radar_store_receipts").length, 0);
      f.mem.tables.tenants![0]!.config = f.config;
      await assert.rejects(
        () =>
          previewRadarStoreChange(f.db, {
            operationId,
            change: {
              operation: "review_source",
              sourceVersionId: version,
              expectedRevision: 9,
              verification: "verified",
              reason: "Compared with the source",
            },
          }),
        /Stale/,
      );
      const other = bindTenantDatabase(f.mem.client, b, true);
      await assert.rejects(
        () =>
          previewRadarStoreChange(other, {
            operationId,
            change: {
              operation: "review_source",
              sourceVersionId: version,
              expectedRevision: 1,
              verification: "verified",
              reason: "Foreign source",
            },
          }),
        /missing|another workspace/,
      );
      await assert.rejects(
        () =>
          previewRadarStoreChange(f.db, {
            operationId,
            change: {
              operation: "create_opportunity",
              title: "Workshop",
              summary: "Observed",
              recommendedAction: "Review",
              kind: "partnership",
              contactId: randomUUID(),
              citations: [{ sourceVersionId: version, observation: "Workshop notice" }],
            },
          }),
        /CRM reference/,
      );
    },
  );
  await scenario(
    "source review and lifecycle gates cannot turn a supplied draft into approved facts",
    async () => {
      const f = fixture(),
        operationId = randomUUID();
      const change = {
        operation: "transition_opportunity",
        opportunityId: opp,
        expectedRevision: 1,
        state: "approved",
        reason: "Review complete",
      };
      await assert.rejects(
        () => previewRadarStoreChange(f.db, { operationId, change }),
        /Review every source/,
      );
      f.mem.tables.radar_source_versions![0]!.verification = "verified";
      const preview = await previewRadarStoreChange(f.db, { operationId, change });
      const proposed = await proposeRadarStoreChange(
        f.db,
        { operationId, change, digest: preview.digest },
        "owner@example.test",
      );
      f.mem.tables.radar_source_versions![0]!.revision = 2;
      await assert.rejects(
        () => approveAndExecuteAction(f.db, proposed.id, "owner@example.test"),
        /facts changed/,
      );
      await assert.rejects(
        () =>
          previewRadarStoreChange(f.db, { operationId, change: { ...change, state: "completed" } }),
        /lifecycle/,
      );
    },
  );
  await scenario(
    "citation correction can replace retracted material while keeping the old snapshot",
    async () => {
      const f = fixture(),
        replacement = randomUUID();
      f.mem.tables.radar_source_versions![0]!.verification = "retracted";
      f.mem.tables.radar_source_versions!.push({
        ...f.mem.tables.radar_source_versions![0]!,
        id: replacement,
        verification: "supplied",
        version: 2,
      });
      const preview = await previewRadarStoreChange(f.db, {
        operationId: randomUUID(),
        change: {
          operation: "replace_citations",
          opportunityId: opp,
          expectedRevision: 1,
          citations: [{ sourceVersionId: replacement, observation: "Corrected source" }],
          reason: "Original source corrected",
        },
      });
      assert.equal(preview.sources.length, 2);
      await previewRadarStoreChange(f.db, {
        operationId: randomUUID(),
        change: {
          operation: "transition_opportunity",
          opportunityId: opp,
          expectedRevision: 1,
          state: "dismissed",
          reason: "Evidence was retracted",
        },
      });
      assert.equal(f.mem.rows("radar_evidence_links")[0]!.source_version_id, version);
    },
  );
  await scenario(
    "bounded source reading and receipt replay remain available without another mutation",
    async () => {
      const f = fixture(),
        operationId = randomUUID();
      const sourcePage = await readRadarStore(f.db, { sourceVersionId: version });
      assert.equal(sourcePage.text?.length, 2000);
      assert.equal(sourcePage.truncated, true);
      assert.equal(sourcePage.nextOffset, 2000);
      await assert.rejects(() =>
        readRadarStore(f.db, { sourceVersionId: version, opportunityId: opp }),
      );
      const preview = await previewRadarStoreChange(f.db, { operationId, change: ingest });
      const { requiresHumanApproval: _approval, consequences: _consequences, ...payload } = preview;
      void _approval;
      void _consequences;
      await executeRadarStoreChange(f.db, payload, "owner@example.test");
      f.mem.tables.tenants![0]!.config = { modules: {} };
      assert.equal(
        (await executeRadarStoreChange(f.db, payload, "owner@example.test")).replayed,
        true,
      );
      const read = await readRadarStore(f.db, { operationId });
      assert.equal(read.receipt?.id, f.mem.rows("radar_store_receipts")[0]!.id);
      assert.equal(f.mem.rows("radar_store_receipts").length, 1);
    },
  );
  await scenario("invalid input, unknown patches and autonomy cannot bypass review", async () => {
    const f = fixture(),
      operationId = randomUUID();
    for (const change of [
      { ...ingest, url: "https://user:password@example.test" },
      { ...ingest, bodyText: "x".repeat(20001) },
      {
        operation: "update_opportunity",
        opportunityId: opp,
        expectedRevision: 1,
        patch: { state: "approved" },
        reason: "Bypass",
      },
    ])
      await assert.rejects(() => previewRadarStoreChange(f.db, { operationId, change }));
    const preview = await previewRadarStoreChange(f.db, { operationId, change: ingest });
    const proposed = await proposeRadarStoreChange(
      f.db,
      { operationId, change: ingest, digest: preview.digest },
      "owner@example.test",
    );
    await assert.rejects(
      () =>
        approveAndExecuteAction(f.db, proposed.id, "owner@example.test", { mode: "autonomous" }),
      /denied|approval/,
    );
    assert.equal(f.mem.rows("radar_store_receipts").length, 0);
  });
  await scenario(
    "SuperDebate and an unrelated business use identical approval and storage services",
    async () => {
      for (const preset of ["superdebate", "service-business"]) {
        const f = fixture();
        const publicProfile = {
          ...RADAR_PROFILE_DEFAULTS,
          ...JSON.parse(readFileSync(`plugins/opportunity-radar/presets/${preset}.json`, "utf8")),
        };
        f.mem.tables.tenants![0]!.config = {
          ...f.config,
          moduleSettings: { "opportunity-radar": publicProfile },
        };
        const operationId = randomUUID(),
          change = { ...ingest, title: `Fictional example for ${publicProfile.organization}` };
        const preview = await previewRadarStoreChange(f.db, { operationId, change });
        const proposed = await proposeRadarStoreChange(
          f.db,
          { operationId, change, digest: preview.digest },
          "owner@example.test",
        );
        await approveAndExecuteAction(f.db, proposed.id, "owner@example.test");
        assert.ok((await readRadarStore(f.db, { operationId })).receipt);
      }
    },
  );
  console.log(JSON.stringify({ result: "passed", checks }, null, 2));
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
