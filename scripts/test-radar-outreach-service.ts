import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { createCollectionsFixture } from "./lib/collections-fixture";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";
import { seedRadar, demoRadarProfile } from "../src/lib/admin/demo/radar-fixtures";
import {
  previewRadarOutreach,
  proposeRadarOutreach,
  executeRadarOutreach,
  reconcileRadarOutreach,
  readRadarOutreach,
} from "../src/lib/revenue-os/radar-outreach";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import { bindTenantDatabase } from "../src/lib/supabase/server";
function fixture(name: "superdebate" | "northline-roofing") {
  const f = createCollectionsFixture({ allowSends: true }),
    seed = seedRadar(DEMO_SCENARIOS[name]),
    owned = (v: object) => ({ ...v, tenant_id: f.tenant });
  const opportunity = seed.opportunities[0]!;
  opportunity.contact_id = f.contact;
  const profile = {
    ...demoRadarProfile(DEMO_SCENARIOS[name]),
    outreachMode: "approval-required" as const,
  };
  const cfg = {
    modules: { "opportunity-radar": true },
    moduleSettings: { "opportunity-radar": profile },
  };
  f.table("tenants")[0]!.config = cfg;
  Object.assign(f.mem.tables, {
    radar_sources: seed.sources.map((v) =>
      owned({ id: v.source_id, canonical_url: v.canonicalUrl }),
    ),
    radar_source_versions: seed.sources.map(owned),
    radar_opportunities: seed.opportunities.map(owned),
    radar_evidence_links: seed.opportunities.flatMap((o) =>
      seed.citations[o.id]!.flatMap((c) =>
        c.links.map((l) => owned({ ...l, opportunity_id: o.id, opportunity_revision: c.revision })),
      ),
    ),
    radar_assets: [
      owned({
        id: seed.assets[0]!.id,
        opportunity_id: opportunity.id,
        kind: "outreach_draft",
        state: "draft",
        title: "A useful workshop outline",
        body_text: "We can offer a practical workshop outline. Would you like to review it?",
      }),
    ],
    radar_asset_sources: [
      owned({ asset_id: seed.assets[0]!.id, source_version_id: seed.sources[0]!.id }),
    ],
    radar_current_relationships: [],
    entity_types: [],
    entity_links: [],
    conversations: [],
    message_evidence_context: [],
    claims: [],
    radar_outreach_attempts: [],
  });
  let afterReserve = () => {};
  f.mem.rpc("reserve_radar_outreach", ({ p_action }) => {
    const prior = f.table("radar_outreach_attempts").find((a) => a.action_id === p_action);
    if (prior) return { reserved: false };
    f.table("radar_outreach_attempts").push(
      owned({ action_id: p_action, opportunity_id: opportunity.id, state: "dispatching" }),
    );
    afterReserve();
    return { reserved: true, state: "dispatching" };
  });
  f.mem.rpc("reconcile_radar_outreach", ({ p_action }) => {
    const a = f.table("radar_outreach_attempts").find((a) => a.action_id === p_action)!;
    const m = f.table("messages").find((m) => m.idempotency_key === `action:${p_action}`);
    const metadata = m?.metadata as Record<string, unknown> | undefined;
    a.state =
      m?.provider_id && m.sent_at
        ? "sent"
        : m?.status === "failed" && metadata?.dispatch_attempted === false
          ? "not_sent"
          : "uncertain";
    return a;
  });
  const input = {
    assetId: seed.assets[0]!.id,
    purpose: "partnership",
    reason: "The supplied professional workshop request matches our practical contribution",
  };
  async function propose() {
    const preview = await previewRadarOutreach(f.db, input);
    const a = await proposeRadarOutreach(
      f.db,
      { input, digest: preview.digest },
      "owner@example.test",
    );
    const row = f.table("action_queue").find((r) => r.id === a.id)!;
    Object.assign(row, {
      status: "executing",
      approved_by: "owner@example.test",
      approved_at: new Date().toISOString(),
    });
    return String(a.id);
  }
  return {
    ...f,
    profile,
    input,
    propose,
    onReserve: (fn: () => void) => {
      afterReserve = fn;
    },
  };
}
async function main() {
  for (const name of ["superdebate", "northline-roofing"] as const) {
    let f = fixture(name);
    try {
      const a = await f.propose();
      assert.equal((await executeRadarOutreach(f.db, a, "owner@example.test")).state, "sent");
      assert.equal(f.state.sends, 1);
      await executeRadarOutreach(f.db, a, "owner@example.test");
      assert.equal(f.state.sends, 1, "repeated execution only reconciles");
      f.table("tenants")[0]!.config = { modules: { "opportunity-radar": false } };
      assert.equal((await reconcileRadarOutreach(f.db, a)).state, "sent");
      assert.equal((await readRadarOutreach(f.db, {})).attempts?.length, 1);
      assert.equal(
        (await readRadarOutreach(bindTenantDatabase(f.mem.client, randomUUID(), true), {})).attempts
          ?.length,
        0,
      );
    } finally {
      f.restore();
    }
    f = fixture(name);
    try {
      const a = await f.propose();
      f.table("radar_source_versions")[0]!.verification = "retracted";
      await assert.rejects(
        () => executeRadarOutreach(f.db, a, "owner@example.test"),
        /verification/,
      );
      assert.equal(f.state.sends, 0);
    } finally {
      f.restore();
    }
    f = fixture(name);
    try {
      const a = await f.propose();
      f.onReserve(() => {
        f.table("radar_source_versions")[0]!.verification = "retracted";
      });
      await assert.rejects(() => executeRadarOutreach(f.db, a, "owner@example.test"), /not sent/);
      assert.equal(f.state.sends, 0);
      assert.equal((await reconcileRadarOutreach(f.db, a)).state, "not_sent");
    } finally {
      f.restore();
    }
    f = fixture(name);
    try {
      const a = await f.propose();
      f.state.timeout = true;
      await assert.rejects(() => executeRadarOutreach(f.db, a, "owner@example.test"), /uncertain/);
      await assert.rejects(
        () => executeRadarOutreach(f.db, a, "owner@example.test"),
        /cannot send again/,
      );
      assert.equal(f.state.sends, 1);
    } finally {
      f.restore();
    }
    f = fixture(name);
    try {
      f.table("contacts")[0]!.communication_status = "unsubscribed";
      await assert.rejects(() => previewRadarOutreach(f.db, f.input), /suppressed/);
      assert.equal(f.state.sends, 0);
    } finally {
      f.restore();
    }
    f = fixture(name);
    try {
      const p = await previewRadarOutreach(f.db, f.input);
      const a = await proposeRadarOutreach(
        f.db,
        { input: f.input, digest: p.digest },
        "owner@example.test",
      );
      Object.assign(
        f.table("action_queue").find((r) => r.id === a.id)!,
        { status: "pending" },
      );
      f.mem.rpc("check_autonomy", () => ({
        allowed: true,
        level: "standing_permission",
        hard_floor: false,
        requires_approval: false,
        reason: "Controlled standing policy",
      }));
      await assert.rejects(
        () =>
          approveAndExecuteAction(f.db, String(a.id), "owner@example.test", { mode: "autonomous" }),
        /irreversible|human approval/,
      );
      assert.equal(f.state.sends, 0);
    } finally {
      f.restore();
    }
    f = fixture(name);
    try {
      const primary = f.table("contacts")[0]!;
      const second = {
        ...primary,
        id: randomUUID(),
        email: "second@example.test",
        primary_email: "second@example.test",
      };
      f.table("contacts").push(second);
      const consents = [primary, second].map((person) => {
        const conversationId = randomUUID(),
          messageId = randomUUID();
        const quotation = "Yes, please introduce me to the other workshop participant.";
        f.table("conversations").push({
          id: conversationId,
          tenant_id: f.tenant,
          contact_id: person.id,
          subject: "Specific introduction",
        });
        f.table("message_evidence_context").push({
          id: messageId,
          tenant_id: f.tenant,
          conversation_id: conversationId,
          direction: "inbound",
          status: "received",
          sender_email: person.primary_email ?? person.email,
          body_excerpt: quotation,
          body_hash: createHash("sha256").update(quotation).digest("hex"),
          created_at: new Date().toISOString(),
        });
        return {
          contactId: person.id,
          messageId,
          quotation,
          validUntil: new Date(Date.now() + 86400000).toISOString(),
        };
      });
      const input = {
        ...f.input,
        purpose: "introduction",
        introductionContactId: second.id,
        consents,
      };
      const preview = await previewRadarOutreach(f.db, input);
      assert.equal(preview.recipients.length, 2);
      const action = await proposeRadarOutreach(
        f.db,
        { input, digest: preview.digest },
        "owner@example.test",
      );
      Object.assign(
        f.table("action_queue").find((r) => r.id === action.id)!,
        {
          status: "executing",
          approved_by: "owner@example.test",
          approved_at: new Date().toISOString(),
        },
      );
      assert.equal(
        (await executeRadarOutreach(f.db, String(action.id), "owner@example.test")).state,
        "sent",
      );
      assert.equal(f.state.sends, 1);
      await executeRadarOutreach(f.db, String(action.id), "owner@example.test");
      assert.equal(f.state.sends, 1);
    } finally {
      f.restore();
    }
    console.log(
      `PASS: ${name} controlled sender, exact proposal, replay, stale evidence before and after reservation, confirmed non-send, uncertainty hold, suppression, disabled/cross-tenant history and human approval floor.`,
    );
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
