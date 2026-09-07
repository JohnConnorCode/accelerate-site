import assert from "node:assert/strict";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";
import {
  createDemoBusinessState,
  DEMO_BUSINESS_MODULES,
} from "../src/lib/admin/demo/business-runtime";
import { demoRadarProfile, seedRadar } from "../src/lib/admin/demo/radar-fixtures";
import { handleDemoRadar } from "../src/lib/admin/demo/radar-runtime";
async function main() {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("No provider access allowed");
  };
  try {
    for (const name of ["superdebate", "northline-roofing"] as const) {
      const pack = DEMO_SCENARIOS[name],
        state = createDemoBusinessState(pack),
        modules = { ...DEMO_BUSINESS_MODULES },
        profile = { ...demoRadarProfile(pack) },
        settings = { "opportunity-radar": profile };
      state.radar = seedRadar(pack);
      const call = async (kind: string, input: unknown) => {
        const r = await handleDemoRadar(
          pack,
          state,
          modules,
          new URL("https://demo.test/api/admin/radar/commands"),
          "POST",
          { kind, input },
          () => {},
          settings,
        );
        assert.ok(r);
        return { status: r.status, data: await r.json() };
      };
      const opportunity = state.radar.opportunities[0]!,
        asset = state.radar.assets[0]!;
      asset.kind = "outreach_draft";
      asset.body_text = "We can offer a practical workshop outline. Would you like to review it?";
      const input = {
        assetId: asset.id,
        purpose: "partnership",
        reason: "Relevant current workshop evidence",
      };
      assert.equal((await call("outreach_preview", input)).status, 409);
      profile.outreachMode = "approval-required";
      const preview = await call("outreach_preview", input);
      assert.equal(preview.status, 200, JSON.stringify(preview.data));
      const a = await call("outreach_propose", { input, digest: preview.data.digest });
      assert.equal(a.status, 200);
      const approve = async () => {
        const r = await handleDemoRadar(
          pack,
          state,
          modules,
          new URL("https://demo.test/api/admin/revenue-os/actions"),
          "PATCH",
          { id: a.data.id, decision: "approve" },
          () => {},
          settings,
        );
        return { status: r!.status, data: await r!.json() };
      };
      asset.body_text += " Changed.";
      assert.equal((await approve()).status, 409);
      asset.body_text = preview.data.text;
      assert.equal((await approve()).status, 200);
      assert.equal((await approve()).status, 200);
      assert.equal(state.radar.outreachAttempts!.length, 1);
      assert.equal(
        (await call("outreach_preview", input)).status,
        409,
        "cooldown must prevent a new send",
      );
      modules["opportunity-radar"] = false;
      assert.equal(
        (await call("outreach_history", { opportunityId: opportunity.id })).data.attempts.length,
        1,
      );
      assert.equal((await call("outreach_reconcile", { actionId: a.data.id })).data.state, "sent");
      const other = createDemoBusinessState(pack);
      assert.equal(other.radar?.outreachAttempts?.length ?? 0, 0);
      console.log(
        `PASS: ${name} fictional draft-only/refusal, exact preview, changed-message refusal, approval replay, cooldown, disabled recovery and session isolation.`,
      );
    }
  } finally {
    globalThis.fetch = original;
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
