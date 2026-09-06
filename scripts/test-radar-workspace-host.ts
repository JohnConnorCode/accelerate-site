import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import {
  readRadarWorkspace,
  dispatchRadarWorkspaceCommand,
  prepareRadarOpportunityBrief,
} from "../src/lib/revenue-os/radar-workspace";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";
import { seedRadar } from "../src/lib/admin/demo/radar-fixtures";
const tenant = randomUUID(),
  foreign = randomUUID();
async function main() {
  for (const name of ["superdebate", "northline-roofing"] as const) {
    const seed = seedRadar(DEMO_SCENARIOS[name]);
    const config = { modules: { "opportunity-radar": true }, moduleSettings: {} };
    const owned = (v: object) => ({ ...v, tenant_id: tenant });
    const mem = new AuthorizedMemorySupabase({
      tenants: [{ id: tenant, name, status: "active", config }],
      radar_sources: seed.sources.map((v) =>
        owned({ id: v.source_id, canonical_url: v.canonicalUrl }),
      ),
      radar_source_versions: seed.sources.map(owned),
      radar_opportunities: seed.opportunities.map(owned),
      radar_evidence_links: seed.opportunities.flatMap((o) =>
        seed.citations[o.id]!.flatMap((c) =>
          c.links.map((l) =>
            owned({ ...l, opportunity_id: o.id, opportunity_revision: c.revision }),
          ),
        ),
      ),
      radar_current_assessments: seed.assessments.map(owned),
      radar_assets: [],
      radar_outcomes: [],
      radar_store_receipts: [],
      contacts: DEMO_SCENARIOS[name].people.map((p) =>
        owned({ id: p.id, full_name: p.name, communication_status: "suppressed" }),
      ),
      model_call_receipts: [],
      model_registrations: [],
    });
    const db = bindTenantDatabase(mem.client, tenant, true),
      first = seed.opportunities[0]!;
    let r = await readRadarWorkspace(db, { opportunityId: first.id });
    assert.equal(r.packet?.opportunity.id, first.id);
    assert.equal(r.packet?.contact?.communicationStatus, "suppressed");
    assert.equal(r.model.available, false);
    assert.equal(r.packet?.assessmentCurrent, true);
    mem.tables.radar_source_versions![0]!.revision = 99;
    r = await readRadarWorkspace(db, { opportunityId: first.id });
    assert.equal(r.packet?.assessmentCurrent, false);
    assert.match(r.packet!.assessmentReason!, /Evidence/);
    await assert.rejects(
      () =>
        readRadarWorkspace(bindTenantDatabase(mem.client, foreign, true), {
          opportunityId: first.id,
        }),
      /workspace unavailable/,
    );
    await assert.rejects(
      () =>
        dispatchRadarWorkspaceCommand(
          db,
          {
            kind: "store_preview",
            input: {
              operationId: randomUUID(),
              change: {
                operation: "update_opportunity",
                opportunityId: first.id,
                expectedRevision: 999,
                patch: { title: "Changed" },
                reason: "Review",
              },
            },
          },
          "operator@example.test",
        ),
      /Stale/,
    );
    await assert.rejects(
      () =>
        prepareRadarOpportunityBrief(db, {
          operationId: randomUUID(),
          opportunityId: first.id,
          expectedRevision: first.revision,
          sourceVersionIds: [randomUUID()],
        }),
      /current/,
    );
    mem.tables.tenants![0]!.config = {
      modules: { "opportunity-radar": false },
      moduleSettings: {},
    };
    r = await readRadarWorkspace(db, { opportunityId: first.id });
    assert.equal(r.enabled, false);
    assert.ok(r.packet);
    await assert.rejects(
      () =>
        dispatchRadarWorkspaceCommand(
          db,
          {
            kind: "store_preview",
            input: {
              operationId: randomUUID(),
              change: {
                operation: "ingest_source",
                url: "https://example.test/source",
                title: "Source",
                bodyText: "Supplied material",
              },
            },
          },
          "operator@example.test",
        ),
      /disabled/,
    );
    await assert.rejects(() =>
      dispatchRadarWorkspaceCommand(
        db,
        { kind: "execute_sql", input: {} },
        "operator@example.test",
      ),
    );
    console.log(
      `${name}: live workspace preserves source/contact context, tenant boundaries, disabled history and exact command validation`,
    );
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
