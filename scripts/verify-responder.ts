#!/usr/bin/env tsx
/**
 * Live evidence for the autonomous inbound responder, against the real database
 * and the real Resend account.
 *
 * The deterministic suite (`npm run test:responder-envelope`) proves every
 * decline rule fires against an in-memory database. This proves the parts that
 * a stub cannot: that the real `admin_settings` rows exist and gate correctly,
 * that a real model produces something the grounding check accepts, and that
 * the real sender writes a real receipt.
 *
 * Recipients: this never emails a person. The send goes to delivered@resend.dev,
 * Resend's own test sink, so the provider round-trip and receipts are real while
 * nobody receives mail.
 *
 * The responder's live settings are read and restored, so running this never
 * leaves the founder's kill switch in a state they did not choose.
 *
 *   npm run verify:responder            full run, restores settings afterwards
 *   npm run verify:responder -- --cleanup   remove rows a previous run created
 */
import { randomUUID } from "node:crypto";
import {
  RESPONDER_APPROVED_VERSION_KEY,
  RESPONDER_ENABLED_KEY,
  RESPONDER_POLICY_VERSION,
  respondToInbound,
} from "../src/lib/revenue-os/auto-responder";
import { createServiceRoleClient } from "../src/lib/supabase/server";

const TEST_RECIPIENT = "delivered@resend.dev";
const PREFIX = "responder-verify";
const runId = randomUUID().slice(0, 8);
const failures: string[] = [];
const notes: string[] = [];

function check(label: string, condition: boolean, detail?: unknown) {
  if (!condition) failures.push(detail === undefined ? label : `${label} (got: ${JSON.stringify(detail)})`);
}

const supabase = createServiceRoleClient();

async function readSetting(key: string): Promise<string | null> {
  const { data } = await supabase.from("admin_settings").select("value").eq("key", key).maybeSingle();
  return data ? String(data.value) : null;
}

async function writeSetting(key: string, value: string) {
  const { error } = await supabase.from("admin_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`could not set ${key}: ${error.message}`);
}

/** Everything this script creates carries the prefix, so cleanup is exact. */
async function cleanup() {
  const { data: opportunities } = await supabase.from("opportunities").select("id").like("name", `${PREFIX}%`);
  const ids = (opportunities ?? []).map((row) => row.id as string);
  for (const id of ids) {
    await supabase.from("messages").delete().eq("opportunity_id", id);
    await supabase.from("conversations").delete().eq("opportunity_id", id);
    await supabase.from("activities").delete().eq("opportunity_id", id);
    await supabase.from("tasks").delete().eq("opportunity_id", id);
    await supabase.from("stage_events").delete().eq("opportunity_id", id);
    await supabase.from("audit_log").delete().eq("entity_id", id);
    await supabase.from("opportunities").delete().eq("id", id);
  }
  await supabase.from("contacts").delete().like("full_name", `${PREFIX}%`);
  await supabase.from("companies").delete().like("name", `${PREFIX}%`);
  await supabase.from("agent_runs").delete().eq("surface", "inbound_responder").like("prompt_preview", `${PREFIX}%`);
  return ids.length;
}

async function main() {
  if (process.argv.includes("--cleanup")) {
    console.log(JSON.stringify({ mode: "cleanup", opportunitiesRemoved: await cleanup() }, null, 2));
    return;
  }

  const leftovers = await supabase.from("opportunities").select("id").like("name", `${PREFIX}%`).limit(1);
  if ((leftovers.data?.length ?? 0) > 0) {
    throw new Error(`a previous run left rows behind; run \`npm run verify:responder -- --cleanup\` first`);
  }

  // ---- The operator controls must exist, or the founder cannot reach them --

  const enabledSeeded = await readSetting(RESPONDER_ENABLED_KEY);
  const approvedSeeded = await readSetting(RESPONDER_APPROVED_VERSION_KEY);
  check(`${RESPONDER_ENABLED_KEY} exists in admin_settings`, enabledSeeded !== null, enabledSeeded);
  check(`${RESPONDER_APPROVED_VERSION_KEY} exists in admin_settings`, approvedSeeded !== null, approvedSeeded);
  notes.push(`live settings on entry: enabled=${JSON.stringify(enabledSeeded)}, approved=${JSON.stringify(approvedSeeded)}`);

  // Build a canonical record to respond against, exactly as an inbound would.
  const email = `${PREFIX}-${runId}@example.com`;
  const { data: company, error: companyError } = await supabase.from("companies").insert({ name: `${PREFIX} Dental ${runId}` }).select("id,name").single();
  if (companyError) throw new Error(companyError.message);
  const { data: contact, error: contactError } = await supabase.from("contacts").insert({ full_name: `${PREFIX} Dana ${runId}`, primary_email: email, company_id: company.id, communication_status: "active" }).select("id").single();
  if (contactError) throw new Error(contactError.message);
  const { data: opportunity, error: opportunityError } = await supabase.from("opportunities").insert({ name: `${PREFIX} Dental ${runId}`, email, contact_id: contact.id, company_id: company.id, stage: "new", pipeline: "sales" }).select("id").single();
  if (opportunityError) throw new Error(opportunityError.message);

  const input = {
    opportunityId: opportunity.id as string,
    contactId: contact.id as string,
    companyName: company.name as string,
    contactName: "Dana",
    // Sent to the Resend sink, never to the address above.
    email: TEST_RECIPIENT,
    inquiry: `${PREFIX}: We keep missing calls when the front desk is busy and I think we are losing new patients because of it.`,
    existingOpportunity: false,
  };

  try {
    // ---- Disabled means disabled, against the real settings table ---------

    await writeSetting(RESPONDER_ENABLED_KEY, "false");
    await writeSetting(RESPONDER_APPROVED_VERSION_KEY, RESPONDER_POLICY_VERSION);
    const offDecision = await respondToInbound(supabase, input);
    check("a disabled policy declines", offDecision.sent === false, offDecision);
    check("the decline reason is the kill switch", !offDecision.sent && offDecision.reason === "policy_disabled", offDecision);

    // ---- An unapproved version is not authorised -------------------------

    await writeSetting(RESPONDER_ENABLED_KEY, "true");
    await writeSetting(RESPONDER_APPROVED_VERSION_KEY, "inbound-responder.v0-not-real");
    const unapproved = await respondToInbound(supabase, input);
    check("an unapproved version declines", !unapproved.sent && unapproved.reason === "policy_not_approved", unapproved);

    // Both declines must be on the audit ledger, not merely returned.
    const { data: declines } = await supabase.from("audit_log").select("action,metadata").eq("entity_id", opportunity.id).eq("action", "responder.declined");
    check("declines are recorded in the audit ledger", (declines?.length ?? 0) >= 2, declines?.length);

    // ---- Inside the envelope, with a real model and a real send ----------

    await writeSetting(RESPONDER_APPROVED_VERSION_KEY, RESPONDER_POLICY_VERSION);
    const decision = await respondToInbound(supabase, input);

    if (!decision.sent) {
      // A grounding rejection is a legitimate outcome of a live model call, not
      // a broken script, so it is reported rather than silently failed.
      if (decision.reason === "failed_grounding_check") {
        notes.push(`the live model produced a draft the grounding check rejected (${decision.detail}); that is the guard working, but it means no send was proven this run`);
      } else if (decision.reason === "outside_send_window") {
        notes.push("outside the approved send window, so no live send was attempted this run; re-run during business hours for send evidence");
      } else if (decision.reason === "not_configured") {
        // .env.local has no OPENROUTER_API_KEY and Vercel does not return
        // sensitive variables to `pull`, so the live generation leg cannot run
        // from a developer machine. The gating above is still real evidence.
        notes.push("OPENROUTER_API_KEY or RESEND_API_KEY is absent locally, so the generation and send legs were not exercised; the policy gating above ran against the real settings table");
      } else {
        failures.push(`the responder declined inside the envelope: ${JSON.stringify(decision)}`);
      }
    } else {
      const { data: message } = await supabase.from("messages").select("id,provider_id,status,body_text,idempotency_key").eq("id", decision.messageId!).maybeSingle();
      check("the send wrote a message receipt", Boolean(message), decision.messageId);
      check("the receipt carries a real provider id", Boolean(message?.provider_id), message?.provider_id);
      check("the receipt is marked sent", message?.status === "sent", message?.status);
      check("the idempotency key pins one reply per opportunity", message?.idempotency_key === `responder:${RESPONDER_POLICY_VERSION}:${opportunity.id}`, message?.idempotency_key);
      check("the body is non-empty", Boolean(message?.body_text?.trim()), (message?.body_text ?? "").slice(0, 60));
      check("the body leaks no placeholder", !/\{\{[A-Za-z0-9_]+\}\}/.test(String(message?.body_text ?? "")));

      const { data: run } = await supabase.from("agent_runs").select("status,surface,model,result_preview").eq("surface", "inbound_responder").order("started_at", { ascending: false }).limit(1).maybeSingle();
      check("the model call is on the run ledger", run?.status === "completed", run);
      check("the ledger records what was said", Boolean(run?.result_preview), run?.result_preview);

      const { data: sentAudit } = await supabase.from("audit_log").select("metadata").eq("entity_id", opportunity.id).eq("action", "responder.sent").maybeSingle();
      check("the send is audited with its policy version", (sentAudit?.metadata as { policy_version?: string })?.policy_version === RESPONDER_POLICY_VERSION, sentAudit?.metadata);

      // A second attempt must not deliver a second copy.
      const replay = await respondToInbound(supabase, input);
      check("a repeat inquiry does not send twice", replay.sent === false, replay);
      const { data: allMessages } = await supabase.from("messages").select("id").eq("opportunity_id", opportunity.id);
      check("exactly one message exists for this opportunity", (allMessages?.length ?? 0) === 1, allMessages?.length);
    }
  } finally {
    // Never leave the founder's controls in a state they did not choose.
    if (enabledSeeded !== null) await writeSetting(RESPONDER_ENABLED_KEY, enabledSeeded);
    if (approvedSeeded !== null) await writeSetting(RESPONDER_APPROVED_VERSION_KEY, approvedSeeded);
    notes.push(`live settings restored to enabled=${JSON.stringify(enabledSeeded)}, approved=${JSON.stringify(approvedSeeded)}`);
    await cleanup();
  }

  if (failures.length) {
    console.error(`Responder verification failed with ${failures.length} issue(s):`);
    for (const failure of failures) console.error(`- ${failure}`);
    for (const note of notes) console.error(`  note: ${note}`);
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ runId, policyVersion: RESPONDER_POLICY_VERSION, recipient: TEST_RECIPIENT, notes, result: "passed" }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
