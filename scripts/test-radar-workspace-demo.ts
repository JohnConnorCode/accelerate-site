import assert from "node:assert/strict";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";
import {
  createDemoBusinessState,
  handleDemoBusinessRequest,
  DEMO_BUSINESS_MODULES,
} from "../src/lib/admin/demo/business-runtime";
import type { RadarWorkspaceData } from "../src/lib/revenue-os/radar-workspace-contract";

async function main() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Demo attempted an external request");
  };
  try {
    for (const pack of Object.values(DEMO_SCENARIOS)) {
      const state = createDemoBusinessState(pack),
        modules: Record<string, boolean> = { ...DEMO_BUSINESS_MODULES };
      let saves = 0;
      const call = async (path: string, method = "GET", body: Record<string, unknown> = {}) => {
        const r = await handleDemoBusinessRequest(
          pack,
          state,
          modules,
          new URL(path, "https://demo.example"),
          method,
          body,
          () => saves++,
        );
        assert.ok(r);
        return { status: r.status, data: await r.json() };
      };
      const command = (kind: string, input: unknown) =>
        call("/api/admin/radar/commands", "POST", { kind, input });
      const workspace = async (id?: string) => {
        const r = await call("/api/admin/radar/workspace" + (id ? `?opportunityId=${id}` : ""));
        assert.equal(r.status, 200);
        return r.data as RadarWorkspaceData;
      };
      const w = await workspace();
      assert.equal(w.selection?.selected.length, 5);
      assert.ok(w.selection?.unranked.length);
      assert.ok(
        w.selection?.deferred.some((v) => v.reason.includes("topic") || v.reason.includes("limit")),
      );
      assert.ok(w.selection?.deferred.some((v) => v.reason.includes("Evidence")));
      const first = w.opportunities[0]!,
        source = w.sources[0]!;
      assert.equal(
        (await command("read_record", { sourceVersionId: source.id })).data.text.length,
        2000,
      );
      assert.equal(
        (await command("read_record", { sourceVersionId: w.sources[8]!.id })).status,
        409,
      );
      const packet = (await workspace(first.id)).packet!;
      assert.ok(packet.assessmentCurrent);
      assert.equal(
        (await workspace(w.opportunities[9]!.id)).packet?.contact?.communicationStatus,
        "suppressed",
      );
      async function queue(kind: "store" | "assessment", input: Record<string, unknown>) {
        const p = await command(`${kind}_preview`, input);
        assert.equal(p.status, 200, JSON.stringify(p.data));
        const q = await command(`${kind}_propose`, { ...input, digest: p.data.digest });
        assert.equal(q.status, 200, JSON.stringify(q.data));
        return q.data;
      }
      const approve = (id: string) =>
        call("/api/admin/revenue-os/actions", "PATCH", { id, decision: "approve" });
      const input = {
        operationId: crypto.randomUUID(),
        change: {
          operation: "update_opportunity",
          opportunityId: first.id,
          expectedRevision: first.revision,
          patch: { title: "Reviewed practical workshop" },
          reason: "Confirm concrete scope",
        },
      };
      const q = await queue("store", input);
      assert.equal(
        (await workspace(first.id)).packet?.opportunity.title,
        first.title,
        "Proposal must not mutate domain state",
      );
      assert.equal((await approve(q.id)).status, 200);
      assert.equal((await approve(q.id)).status, 200, "Exact action replay is safe");
      assert.equal((await workspace(first.id)).packet?.opportunity.revision, first.revision + 1);
      assert.equal((await workspace(first.id)).packet?.assessmentCurrent, false);
      assert.equal((await command("store_preview", input)).status, 409, "Stale revisions fail");
      const changed = (await workspace(first.id)).packet!;
      const assessment = await queue("assessment", {
        operationId: crypto.randomUUID(),
        opportunityId: first.id,
        expectedRevision: changed.opportunity.revision,
        assessment: packet.assessment,
      });
      assert.equal((await approve(assessment.id)).status, 200);
      assert.equal((await workspace(first.id)).packet?.assessmentCurrent, true);
      const briefInput = {
        operationId: crypto.randomUUID(),
        opportunityId: first.id,
        expectedRevision: changed.opportunity.revision,
        sourceVersionIds: [source.id],
      };
      const brief = await command("prepare_brief", briefInput);
      assert.equal(brief.status, 200);
      assert.match(brief.data.bodyText, /Fictional demo brief/);
      assert.equal((await command("prepare_brief", briefInput)).data.bodyText, brief.data.bodyText);
      const draft = await queue("store", {
        operationId: crypto.randomUUID(),
        change: {
          operation: "add_asset",
          opportunityId: first.id,
          expectedRevision: changed.opportunity.revision,
          kind: "brief",
          title: "Reviewed draft",
          bodyText: brief.data.bodyText,
          sourceVersionIds: [source.id],
        },
      });
      modules["opportunity-radar"] = false;
      assert.equal((await approve(draft.id)).status, 409);
      assert.equal((await workspace(first.id)).enabled, false);
      assert.ok((await workspace(first.id)).packet?.history.length);
      assert.equal(
        (await command("prepare_brief", { ...briefInput, operationId: crypto.randomUUID() }))
          .status,
        409,
      );
      modules["opportunity-radar"] = true;
      assert.equal((await approve(draft.id)).status, 200);
      assert.ok(
        (await workspace(first.id)).packet?.assets.some((a) => a.title === "Reviewed draft"),
      );
      const retraction = await queue("store", {
        operationId: crypto.randomUUID(),
        change: {
          operation: "review_source",
          sourceVersionId: source.id,
          expectedRevision: source.revision,
          verification: "retracted",
          reason: "Source corrected",
        },
      });
      assert.equal((await approve(retraction.id)).status, 200);
      assert.equal((await workspace(first.id)).packet?.assessmentCurrent, false);
      const op = crypto.randomUUID(),
        ingest = {
          operation: "ingest_source",
          url: "https://source.example/item#section",
          title: "Workshop announcement",
          bodyText: "A professional workshop seeks a practical contribution.",
        };
      const imported = await queue("store", { operationId: op, change: ingest });
      assert.equal((await approve(imported.id)).status, 200);
      const count = state.radar!.sources.length;
      const duplicate = await queue("store", { operationId: crypto.randomUUID(), change: ingest });
      assert.equal((await approve(duplicate.id)).status, 200);
      assert.equal(state.radar!.sources.length, count);
      const supplied = state.radar!.sources[0]!;
      const created = await queue("store", {
        operationId: crypto.randomUUID(),
        change: {
          operation: "create_opportunity",
          title: "New collaboration",
          summary: "Review a practical workshop request",
          recommendedAction: "Review source and scope",
          kind: "partnership",
          citations: [
            { sourceVersionId: supplied.id, observation: "Source requests a workshop outline" },
          ],
        },
      });
      assert.equal((await approve(created.id)).status, 200);
      assert.ok((await workspace()).opportunities.some((o) => o.title === "New collaboration"));
      assert.ok(saves > 5);
      const clean = createDemoBusinessState(pack);
      assert.equal(clean.radar, undefined, "Reset gets fresh session-owned data");
      console.log(
        `${pack.id}: approved flow, source pagination, stale evidence, disabled history, replay and isolation passed`,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
