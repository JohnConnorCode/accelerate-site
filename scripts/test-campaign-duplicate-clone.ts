import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { duplicateCampaign } from "../src/lib/revenue-os/campaigns";
import { campaignDraftCopy } from "../src/lib/revenue-os/campaign-duplicate-contract";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
async function main() {
  const source = {
    id: randomUUID(),
    name: "Campaign",
    version: 3,
    status: "active",
    approved_version: 3,
    channel: "email",
    sender_name: "Owner",
    sender_email: "owner@example.test",
    audience_definition: { filter: "reviewed" },
    policy: { daily_limit: 25, stop_on_reply: true },
    campaign_members: [{ id: "must-not-copy" }],
    campaign_steps: [
      {
        step_order: 1,
        delay_days: 0,
        subject_template: "Subject",
        body_template: "Body",
        active: false,
      },
    ],
  };
  const copy = campaignDraftCopy(source, randomUUID());
  assert.equal(copy.status, "draft");
  assert.equal(copy.version, 1);
  assert.equal(copy.approved_version, null);
  assert.deepEqual(copy.campaign_members, []);
  assert.deepEqual(copy.policy, source.policy);
  assert.deepEqual(copy.audience_definition, source.audience_definition);
  assert.equal(copy.campaign_steps[0]!.active, false);
  assert.equal(copy.stats.duplicated_from, source.id);
  assert.equal(copy.stats.duplicated_from_version, 3);
  const mem = new MemorySupabase();
  const db = bindTenantDatabaseForTest(mem.client as never, randomUUID());
  const requestId = randomUUID();
  let calls = 0;
  mem.rpc("duplicate_campaign_draft", (args) => {
    calls++;
    assert.deepEqual(args, {
      p_source: source.id,
      p_expected_version: 3,
      p_request: requestId,
      p_name: "Reviewed copy",
      p_actor: "owner@example.test",
    });
    return copy;
  });
  const result = await duplicateCampaign(db, source.id, "owner@example.test", {
    expectedVersion: 3,
    requestId,
    name: "  Reviewed copy ",
  });
  assert.equal(result.id, copy.id);
  await assert.rejects(
    () =>
      duplicateCampaign(mem.client as never, source.id, "owner@example.test", {
        expectedVersion: 3,
        requestId,
      }),
    /tenant-bound/,
  );
  await assert.rejects(() =>
    duplicateCampaign(db, source.id, "owner@example.test", { requestId, expectedVersion: 0 }),
  );
  await assert.rejects(() =>
    duplicateCampaign(db, source.id, "owner@example.test", {
      requestId: "invalid",
      expectedVersion: 3,
    }),
  );
  assert.equal(calls, 1);
  mem.rpc("duplicate_campaign_draft", () => ({
    error: { message: "Campaign source version changed" },
  }));
  await assert.rejects(
    () => duplicateCampaign(db, source.id, "owner@example.test", { requestId, expectedVersion: 3 }),
    /version changed/,
  );
  console.log(
    "PASS: draft-only field allowlist, provenance, exact source version, stable request identity, bound host dispatch and stale refusal.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
