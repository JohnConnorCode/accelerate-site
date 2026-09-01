#!/usr/bin/env tsx
/**
 * Proves the campaign engine can actually send, which it could not.
 *
 * Every member added through the admin carried a NULL contact_id (the UI posted
 * bare emails) and a NULL next_send_at (only activation backfilled it). The
 * claim function returns without claiming when either is missing, and the
 * executor swallowed the failed claim with a bare `continue`, so the daily cron
 * reported {sent:0, failed:0, stopped:0} and HTTP 200. The outbound engine had
 * never been able to work, and said it was fine.
 *
 * Recipients: sends go to Resend's delivered@resend.dev sink, so the provider
 * round-trip and every receipt are real while nobody receives mail.
 *
 *   --cleanup   remove everything this script creates
 */
import { randomUUID } from "node:crypto";
import {
  activateCampaign,
  executeDueCampaignMembers,
  globalDailySendCap,
} from "../src/lib/revenue-os/campaigns";
import { createServiceRoleClient } from "../src/lib/supabase/server";

const PREFIX = "revenue-os-campaign-verify";
const SINK = "delivered@resend.dev";
const runId = randomUUID().slice(0, 8);
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: unknown) {
  if (!condition)
    failures.push(detail === undefined ? label : `${label} (got: ${JSON.stringify(detail)})`);
}

async function purge(supabase: ReturnType<typeof createServiceRoleClient>) {
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id")
    .like("name", `${PREFIX}%`);
  for (const campaign of campaigns ?? []) {
    const { data: members } = await supabase
      .from("campaign_members")
      .select("id")
      .eq("campaign_id", campaign.id);
    for (const member of members ?? []) {
      const { data: messages } = await supabase
        .from("messages")
        .select("conversation_id")
        .eq("metadata->>campaign_id", campaign.id);
      for (const message of messages ?? []) {
        if (!message.conversation_id) continue;
        await supabase.from("activities").delete().eq("conversation_id", message.conversation_id);
        await supabase.from("messages").delete().eq("conversation_id", message.conversation_id);
        await supabase.from("conversations").delete().eq("id", message.conversation_id);
      }
      await supabase.from("campaign_members").delete().eq("id", member.id);
    }
    await supabase.from("campaign_steps").delete().eq("campaign_id", campaign.id);
    await supabase.from("campaigns").delete().eq("id", campaign.id);
  }
  // Also sweep by subject: a send that failed before its campaign was deleted
  // leaves a message whose campaign_id no longer resolves, so keying cleanup
  // solely off the campaign strands it.
  const { data: strays } = await supabase
    .from("messages")
    .select("id,conversation_id")
    .like("subject", `${PREFIX}%`);
  for (const stray of strays ?? []) {
    if (stray.conversation_id) {
      await supabase.from("activities").delete().eq("conversation_id", stray.conversation_id);
      await supabase.from("messages").delete().eq("conversation_id", stray.conversation_id);
      await supabase.from("conversations").delete().eq("id", stray.conversation_id);
    }
    await supabase.from("messages").delete().eq("id", stray.id);
  }
  await supabase.from("sent_emails").delete().like("subject", `${PREFIX}%`);
  await supabase.from("contacts").delete().like("primary_email", `${PREFIX}%`);
}

async function main() {
  const supabase = createServiceRoleClient();

  if (process.argv.includes("--cleanup")) {
    await purge(supabase);
    const { count } = await supabase
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .like("name", `${PREFIX}%`);
    console.log(
      JSON.stringify(
        {
          mode: "cleanup",
          leftover: count ?? 0,
          result: (count ?? 0) === 0 ? "clean" : "incomplete",
        },
        null,
        2,
      ),
    );
    if (count) process.exit(1);
    return;
  }

  const { data: existing } = await supabase
    .from("campaigns")
    .select("id")
    .like("name", `${PREFIX}%`);
  if (existing?.length)
    throw new Error(
      `${existing.length} verification campaign(s) already present. Run with --cleanup first.`,
    );

  // A real canonical contact, because a member without one can never be claimed.
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .insert({
      full_name: `Campaign Verify ${runId}`,
      primary_email: `${PREFIX}+${runId}@example.invalid`,
      communication_status: "active",
      source: "verification",
    })
    .select("id")
    .single();
  if (contactError) throw new Error(`contact: ${contactError.message}`);

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({ name: `${PREFIX} ${runId}`, status: "draft", policy: { daily_limit: 5 } })
    .select("id")
    .single();
  if (campaignError) throw new Error(`campaign: ${campaignError.message}`);

  const { error: stepError } = await supabase.from("campaign_steps").insert({
    campaign_id: campaign.id,
    step_order: 0,
    delay_days: 0,
    subject_template: `${PREFIX} step one for {{first_name}}`,
    body_template:
      "Hello {{first_name}}, this is an automated verification message. No action is needed.",
    active: true,
  });
  if (stepError) throw new Error(`step: ${stepError.message}`);

  // Member added BEFORE activation, the path activateCampaign backfills.
  const { error: memberError } = await supabase.from("campaign_members").insert({
    campaign_id: campaign.id,
    contact_id: contact.id,
    email: SINK,
    status: "queued",
  });
  if (memberError) throw new Error(`member: ${memberError.message}`);

  await activateCampaign(supabase, campaign.id, "verification@local");

  const { data: activated } = await supabase
    .from("campaign_members")
    .select("next_send_at,contact_id")
    .eq("campaign_id", campaign.id)
    .single();
  check(
    "activation makes an existing member due",
    Boolean(activated?.next_send_at),
    activated?.next_send_at,
  );
  check(
    "the member carries a canonical contact",
    Boolean(activated?.contact_id),
    activated?.contact_id,
  );

  // --- The decisive run ----------------------------------------------------
  const first = await executeDueCampaignMembers(supabase, new Date(), campaign.id);
  check("the campaign actually sends", first.sent === 1, first);
  check("nothing failed", first.failed === 0, first);
  check("nothing was silently unclaimed", first.unclaimed === 0, first);

  const { data: message } = await supabase
    .from("messages")
    .select("status,provider_id,recipient_emails")
    .eq("metadata->>campaign_id", campaign.id)
    .maybeSingle();
  check("the send left a provider receipt", Boolean(message?.provider_id), message);
  check("the receipt is marked sent", message?.status === "sent", message?.status);
  check(
    "the receipt records the recipient",
    (message?.recipient_emails ?? []).includes(SINK),
    message?.recipient_emails,
  );

  const { data: advanced } = await supabase
    .from("campaign_members")
    .select("status,current_step,send_attempts")
    .eq("campaign_id", campaign.id)
    .single();
  check("the member advanced past the only step", advanced?.status === "completed", advanced);
  check(
    "the retry budget is clean after a delivered step",
    (advanced?.send_attempts ?? 0) === 0,
    advanced?.send_attempts,
  );

  // --- Replay must not double-send ----------------------------------------
  const second = await executeDueCampaignMembers(supabase, new Date(), campaign.id);
  check("a second run does not send again", second.sent === 0, second);
  const { count: messageCount } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("metadata->>campaign_id", campaign.id);
  check("only one message exists after replay", messageCount === 1, messageCount);

  await purge(supabase);
  const { count: leftover } = await supabase
    .from("campaigns")
    .select("*", { count: "exact", head: true })
    .like("name", `${PREFIX}%`);
  check("cleanup removed the verification campaign", (leftover ?? 0) === 0, leftover);

  console.log(
    JSON.stringify(
      {
        runId,
        recipient: SINK,
        globalDailyCap: globalDailySendCap(),
        firstRun: first,
        replayRun: second,
        result: failures.length ? "failed" : "passed",
        note: "delivered@resend.dev is Resend's test sink; no person received mail.",
      },
      null,
      2,
    ),
  );

  if (failures.length) {
    console.error(`\nCampaign execution verification failed ${failures.length} check(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    "Campaign execution verification errored:",
    error instanceof Error ? error.message : error,
  );
  console.error("Run with --cleanup to remove partial data.");
  process.exit(1);
});
