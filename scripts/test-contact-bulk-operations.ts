import { getRevenueAiTools } from "../src/lib/revenue-os/ai-tools";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  bulkTagContacts,
  bulkEnrollContacts,
  bulkSuppressContacts,
} from "../src/lib/revenue-os/contact-bulk";
import { stageCampaignMembers } from "../src/lib/revenue-os/campaigns";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
async function main() {
  const id = randomUUID(),
    campaign = randomUUID();
  const mem = new MemorySupabase({
    contacts: [{ id, communication_status: "active" }],
    campaign_members: [{ id: randomUUID(), contact_id: id, status: "queued" }],
  });
  const db = bindTenantDatabaseForTest(mem.client as never, randomUUID());
  const outcome = { contactId: id, status: "applied", reason: "saved" };
  mem.rpc("bulk_tag_contacts", (args) => {
    assert.deepEqual(args.p_contacts, [id]);
    assert.deepEqual(args.p_add, ["alpha"]);
    return [outcome];
  });
  assert.equal(
    (
      await bulkTagContacts(db, {
        contactIds: [id, id],
        add: [" Alpha "],
        actorEmail: "owner@example.test",
      })
    ).applied,
    1,
  );
  const tools = getRevenueAiTools("outreach");
  for (const name of [
    "propose_bulk_tag_contacts",
    "propose_bulk_suppress_contacts",
    "propose_bulk_enroll_contacts",
  ])
    assert.ok(tools.some((tool) => tool.name === name));
  const tagging = tools.find((tool) => tool.name === "propose_bulk_tag_contacts")!;
  const toolContext = { supabase: db, actorEmail: "owner@example.test" };
  await tagging.execute(toolContext, {
    contactIds: [id],
    add: ["alpha"],
    reasoning: "Review first",
  });
  await tagging.execute(toolContext, {
    contactIds: [id],
    add: ["beta"],
    reasoning: "Review second",
  });
  assert.equal(
    mem.tables.action_queue!.length,
    2,
    "different tag intents must not share a dedupe receipt",
  );
  assert.ok(mem.tables.action_queue!.every((action) => action.status === "pending"));
  const before = mem.rpcCalls.length;
  await assert.rejects(() =>
    bulkTagContacts(db, {
      contactIds: [id],
      add: ["invalid tag"],
      actorEmail: "owner@example.test",
    }),
  );
  await assert.rejects(() =>
    bulkTagContacts(db, {
      contactIds: ["invalid"],
      add: ["alpha"],
      actorEmail: "owner@example.test",
    }),
  );
  assert.equal(mem.rpcCalls.length, before);
  await assert.rejects(
    () =>
      bulkTagContacts(mem.client as never, {
        contactIds: [id],
        add: ["alpha"],
        actorEmail: "owner@example.test",
      }),
    /tenant-bound/,
  );
  mem.rpc("stage_campaign_members", (args) => {
    assert.equal(args.p_draft_only, true);
    assert.equal(args.p_campaign, campaign);
    assert.deepEqual(args.p_members, [{ contactId: id }]);
    return [outcome];
  });
  assert.equal(
    (
      await bulkEnrollContacts(db, {
        campaignId: campaign,
        contactIds: [id],
        actorEmail: "owner@example.test",
      })
    ).applied,
    1,
  );
  mem.rpc("stage_campaign_members", (args) => {
    assert.equal(args.p_draft_only, false);
    return [{ ...outcome, email: "a@example.test", memberId: randomUUID() }];
  });
  assert.equal(
    (
      await stageCampaignMembers(
        db,
        campaign,
        [{ contactId: id, email: "a@example.test" }],
        "owner@example.test",
      )
    ).length,
    1,
  );
  mem.rpc("stop_campaign_memberships", () => ({ error: { message: "stop unavailable" } }));
  const partial = await bulkSuppressContacts(db, {
    contactIds: [id],
    actorEmail: "owner@example.test",
  });
  assert.equal(partial.failed, 1);
  assert.equal(mem.tables.contacts![0]!.communication_status, "suppressed");
  assert.match(partial.outcomes[0]!.reason, /partially applied/);
  mem.rpc("stop_campaign_memberships", () => {
    mem.tables.campaign_members![0]!.status = "stopped";
    return [{ member_id: mem.tables.campaign_members![0]!.id, campaign_id: campaign }];
  });
  assert.equal(
    (await bulkSuppressContacts(db, { contactIds: [id], actorEmail: "owner@example.test" }))
      .applied,
    1,
  );
  assert.equal(mem.tables.campaign_members![0]!.status, "stopped");
  mem.tables.contacts![0]!.communication_status = "unsubscribed";
  assert.equal(
    (await bulkSuppressContacts(db, { contactIds: [id], actorEmail: "owner@example.test" }))
      .applied,
    1,
  );
  assert.equal(mem.tables.contacts![0]!.communication_status, "unsubscribed");
  assert.equal(
    (
      await bulkSuppressContacts(db, {
        contactIds: [randomUUID()],
        actorEmail: "owner@example.test",
      })
    ).skipped,
    1,
  );
  console.log(
    "PASS: validated bounded IDs/tags, tenant-bound host writes, draft-only bulk admission, shared single staging, and partial suppression recovery without restoring unsubscribed contacts.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
