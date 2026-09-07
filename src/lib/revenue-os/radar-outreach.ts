import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callRadarOutreachRpc, tenantIdForDatabase } from "@/lib/supabase/server";
import { getTenantFromEmail, getTenantReplyToEmail } from "@/lib/email/resend";
import { checkAutonomy } from "./autonomy-policy";
import { proposeAction, checkpointActionResult } from "./actions";
import { sendRecordedEmail } from "./communications";
import { readRadarOutreachContext, readRadarIntroductionConsents } from "./radar-outreach-context";
import { getRadarRelationshipContext } from "./radar-relationship-context";
import { readContactIdentityReviewState } from "./identity-review";
import { readApprovedClaimReferences } from "./claims";
import { readRadarStore } from "./radar-store";
import {
  radarOutreachPreviewSchema,
  radarOutreachProposalSchema,
  radarOutreachReadSchema,
  reviewRadarOutreachText,
} from "./radar-outreach-contract";
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
const hash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");

/** A preview contains the full exact message and bounded current canonical evidence.
 * The internal action exclusion only removes this dispatch's own processing message. */
export async function previewRadarOutreach(
  db: SupabaseClient,
  raw: unknown,
  executingActionId?: string,
) {
  const input = radarOutreachPreviewSchema.parse(raw);
  const asset = await readRadarStore(db, { assetId: input.assetId });
  if (
    !("record" in asset) ||
    asset.record?.kind !== "outreach_draft" ||
    asset.record.state !== "draft"
  )
    throw new Error("Choose a saved outreach draft");
  if (typeof asset.text !== "string" || !asset.sourceVersions || !asset.sources)
    throw new Error("Draft evidence unavailable");
  const context = await readRadarOutreachContext(db, String(asset.record.opportunity_id));
  if (context.profile.outreachMode !== "approval-required")
    throw new Error(
      "Outreach is draft-only. Configure reviewed sending before requesting send approval.",
    );
  // Read the complete bounded asset, never silently send a 2,000-character excerpt.
  let text = asset.text;
  for (let offset = asset.nextOffset; offset !== null;) {
    const next = await readRadarStore(db, { assetId: input.assetId, offset });
    if (!("record" in next) || typeof next.text !== "string") throw new Error("Draft unavailable");
    text += next.text;
    offset = next.nextOffset;
  }
  z.string().trim().min(1).max(3000).parse(text);
  if (
    !asset.sourceVersions.length ||
    asset.sourceVersions.some((v) => v.verification !== "verified")
  )
    throw new Error("Every cited source needs current verification");
  const linked = new Set(context.packet.citations!.map((c) => c.source_version_id));
  if (asset.sourceVersions.some((v) => !linked.has(v.id)))
    throw new Error("Draft evidence no longer belongs to this opportunity");
  const claims = await readApprovedClaimReferences(db, input.approvedClaimIds);
  let primaryId = String(context.contact.id);
  if (input.purpose === "introduction_request") {
    const path = context.relationship.paths.find(
      (p) => p.kind === "introduction_offer" && p.relationshipId === input.relationshipId,
    );
    if (!path) throw new Error("The explicit introduction offer is unavailable or stale");
    primaryId = path.viaContactId;
  }
  const contactIds = [
    primaryId,
    ...(input.introductionContactId ? [input.introductionContactId] : []),
  ];
  const identity = await readContactIdentityReviewState(db, [
    ...new Set([String(context.contact.id), ...contactIds]),
  ]);
  if (!identity.complete || identity.pendingContactIds.length)
    throw new Error("Resolve contact identity before requesting outreach");
  const recipients: Array<{ contactId: string; email: string; name: string }> = [];
  const histories = [];
  let ownMessageId: string | null = null;
  if (executingActionId) {
    const own = await db
      .from("messages")
      .select("id")
      .eq("tenant_id", context.tenantId)
      .eq("idempotency_key", `action:${executingActionId}`)
      .maybeSingle();
    if (own.error) throw new Error("Dispatch history unavailable");
    ownMessageId = own.data?.id ?? null;
  }
  for (const contactId of contactIds) {
    const relationship =
      contactId === context.contact.id
        ? context.relationship
        : await getRadarRelationshipContext(db, { contactId });
    if (!relationship.history.complete || relationship.truncated)
      throw new Error("Contact history is incomplete; review it before outreach");
    const contact = await db
      .from("contacts")
      .select("id,primary_email,full_name,communication_status")
      .eq("tenant_id", context.tenantId)
      .eq("id", contactId)
      .single();
    if (contact.error || contact.data?.communication_status !== "active")
      throw new Error("Recipient is suppressed or unavailable");
    recipients.push({
      contactId,
      email: z.email().max(254).parse(contact.data.primary_email).toLowerCase(),
      name: String(contact.data.full_name ?? ""),
    });
    const messages = relationship.history.messages.filter((m) => m.id !== ownMessageId);
    const cutoff = Date.now() - context.profile.outreachCooldownHours * 3600000;
    if (
      messages.some(
        (m) =>
          m.direction === "outbound" &&
          (["processing", "queued"].includes(String(m.status)) ||
            (m.status !== "failed" && Date.parse(String(m.created_at)) > cutoff)),
      )
    )
      throw new Error("Earlier outreach is unresolved or within the contact cooldown");
    histories.push({ contactId, messages });
  }
  if (new Set(recipients.map((r) => r.email)).size !== recipients.length)
    throw new Error("Introduction parties must have distinct canonical addresses");
  const consent =
    input.purpose === "introduction"
      ? await readRadarIntroductionConsents(
          db,
          [primaryId, input.introductionContactId!],
          input.consents,
        )
      : null;
  const quality = reviewRadarOutreachText({
    subject: String(asset.record.title),
    body: text,
    purpose: input.purpose,
    approvedFacts: claims.map((c) => c.proposed_value),
    allowedUrls: asset.sources.map((s) => String(s.canonical_url)),
    forbiddenPhrases: context.profile.outreachForbiddenPhrases.split("\n").map((s) => s.trim()),
    allowApprovedTerms: context.profile.outreachApprovedTerms,
    hasPriorOutbound: histories.some((h) => h.messages.some((m) => m.direction === "outbound")),
    hasCurrentIntroductionOffer: input.purpose === "introduction_request",
    hasBothConsents: Boolean(consent),
  });
  if (quality.blockers.length) throw new Error(quality.blockers.map((b) => b.message).join(" "));
  const [from, replyTo] = await Promise.all([getTenantFromEmail(db), getTenantReplyToEmail(db)]);
  const preview = {
    version: 1,
    input,
    tenantId: context.tenantId,
    opportunityId: String(asset.record.opportunity_id),
    revision: context.packet.opportunity!.revision,
    assetId: input.assetId,
    config: context.config,
    recipients,
    from,
    replyTo,
    subject: String(asset.record.title),
    text,
    sources: asset.sourceVersions,
    sourceUrls: asset.sources,
    claims,
    histories,
    relationships: context.relationship.assertions,
    consent,
    quality,
    cooldownHours: context.profile.outreachCooldownHours,
    dailyLimit: context.profile.outreachDailyLimit,
  };
  return { ...preview, digest: hash(preview) };
}
export async function proposeRadarOutreach(db: SupabaseClient, raw: unknown, actorEmail: string) {
  const input = radarOutreachProposalSchema.parse(raw);
  const preview = await previewRadarOutreach(db, input.input);
  if (preview.digest !== input.digest)
    throw new Error("Outreach changed. Review the current preview again.");
  return proposeAction(db, {
    actionType: "send_radar_outreach",
    title: preview.subject,
    description: `Send to ${preview.recipients.map((r) => r.email).join(", ")}. Review cited facts, prior asks and any introduction consent.`,
    payload: { input: input.input, digest: preview.digest, preview },
    sourceContext: "radar",
    entityType: "radar_opportunity",
    entityId: preview.opportunityId,
    proposedBy: actorEmail,
    dedupeKey: `radar-outreach:${preview.assetId}:${preview.digest}`,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    evidence: { digest: preview.digest, assetId: preview.assetId, requiresHumanReview: true },
  });
}
export async function reconcileRadarOutreach(db: SupabaseClient, actionId: string) {
  z.uuid().parse(actionId);
  const receipt = await callRadarOutreachRpc(db, "reconcile_radar_outreach", {
    p_action: actionId,
  });
  if (receipt.error) throw new Error("Outreach receipt is unavailable");
  return receipt.data;
}
export async function executeRadarOutreach(
  db: SupabaseClient,
  actionId: string,
  actorEmail: string,
) {
  z.uuid().parse(actionId);
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Outreach workspace required");
  const action = await db
    .from("action_queue")
    .select("status,action_type,payload,approved_by,expires_at")
    .eq("tenant_id", tenantId)
    .eq("id", actionId)
    .single();
  if (
    action.error ||
    action.data?.status !== "executing" ||
    action.data.action_type !== "send_radar_outreach" ||
    !action.data.approved_by ||
    !action.data.expires_at ||
    Date.parse(action.data.expires_at) <= Date.now()
  )
    throw new Error("Claimed unexpired human approval required");
  const payload = radarOutreachProposalSchema.parse({
    input: action.data.payload?.input,
    digest: action.data.payload?.digest,
  });
  const prior = await db
    .from("radar_outreach_attempts")
    .select("state")
    .eq("tenant_id", tenantId)
    .eq("action_id", actionId)
    .maybeSingle();
  if (prior.error) throw new Error("Outreach dispatch history unavailable");
  if (prior.data) {
    const receipt = await reconcileRadarOutreach(db, actionId);
    if (receipt.state !== "sent")
      throw new Error("Earlier outreach requires receipt review; this action cannot send again");
    return receipt;
  }
  const preview = await previewRadarOutreach(db, payload.input);
  if (preview.digest !== payload.digest)
    throw new Error("Approved outreach changed; review a new preview");
  const reservation = await callRadarOutreachRpc(db, "reserve_radar_outreach", {
    p_action: actionId,
  });
  if (reservation.error || reservation.data?.reserved !== true)
    throw new Error("Outreach reservation refused; refresh current history and limits");
  try {
    await sendRecordedEmail(db, {
      to: preview.recipients[0]!.email,
      cc: preview.recipients.slice(1).map((r) => ({ contactId: r.contactId, email: r.email })),
      contactId: preview.recipients[0]!.contactId,
      from: preview.from,
      replyTo: preview.replyTo,
      subject: preview.subject,
      text: preview.text,
      actorEmail,
      source: "admin",
      template: "radar-outreach-v1",
      idempotencyKey: `action:${actionId}`,
      beforeSend: async () => {
        const [freshAction, policy] = await Promise.all([
          db
            .from("action_queue")
            .select("status,approved_by,expires_at")
            .eq("tenant_id", tenantId)
            .eq("id", actionId)
            .single(),
          checkAutonomy(db, "send_radar_outreach"),
        ]);
        if (
          freshAction.error ||
          freshAction.data?.status !== "executing" ||
          freshAction.data.approved_by !== action.data.approved_by ||
          !freshAction.data.expires_at ||
          Date.parse(freshAction.data.expires_at) <= Date.now() ||
          policy.hardFloor ||
          policy.level === "prohibited"
        )
          throw new Error("Outreach approval or permission changed before dispatch");
        const current = await previewRadarOutreach(db, payload.input, actionId);
        if (current.digest !== payload.digest)
          throw new Error(
            "Outreach evidence, recipient, consent or history changed before dispatch",
          );
      },
    });
  } catch {
    console.warn("Radar outreach requires canonical receipt reconciliation");
  }
  const receipt = await reconcileRadarOutreach(db, actionId);
  if (receipt.state !== "sent") {
    await checkpointActionResult(db, actionId, {
      status: receipt.state,
      reason:
        receipt.state === "not_sent"
          ? "Confirmed no provider dispatch; refresh and obtain new approval"
          : "Provider acceptance uncertain; do not resend",
    });
    throw new Error(
      receipt.state === "not_sent"
        ? "Outreach was not sent. Refresh the evidence before a new approval."
        : "Outreach acceptance is uncertain. Reconcile the existing receipt; do not resend.",
    );
  }
  return receipt;
}
/** Read/reconcile remain available after plugin disable and never perform sends. */
export async function readRadarOutreach(db: SupabaseClient, raw: unknown) {
  const input = radarOutreachReadSchema.parse(raw),
    tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Outreach workspace required");
  let query = db
    .from("radar_outreach_attempts")
    .select(
      "action_id,opportunity_id,asset_id,state,contact_ids,message_id,provider_id,sent_at,created_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(input.limit);
  if (input.opportunityId) query = query.eq("opportunity_id", input.opportunityId);
  if (input.actionId) query = query.eq("action_id", input.actionId);
  const read = await query;
  if (read.error) throw new Error("Outreach history unavailable");
  return { attempts: read.data, sends: false };
}

/** Bounded selectors for the same source-backed workflow exposed to AI tools. */
export async function readRadarOutreachOptions(db: SupabaseClient, raw: unknown) {
  const input = z
    .object({ opportunityId: z.uuid(), otherContactId: z.uuid().optional() })
    .strict()
    .parse(raw);
  const context = await readRadarOutreachContext(db, input.opportunityId);
  const [people, claims] = await Promise.all([
    db
      .from("contacts")
      .select("id,full_name,primary_email")
      .eq("tenant_id", context.tenantId)
      .eq("communication_status", "active")
      .order("full_name")
      .limit(20),
    db
      .from("claims")
      .select("id,proposed_value")
      .eq("tenant_id", context.tenantId)
      .eq("status", "verified")
      .eq("best_evidence", "human_confirmed")
      .order("resolved_at", { ascending: false })
      .limit(10),
  ]);
  if (people.error || claims.error) throw new Error("Outreach choices unavailable");
  const histories = [{ contactId: String(context.contact.id), ...context.relationship.history }];
  if (input.otherContactId && input.otherContactId !== context.contact.id)
    histories.push({
      contactId: input.otherContactId,
      ...(await getRadarRelationshipContext(db, { contactId: input.otherContactId })).history,
    });
  return {
    contactId: String(context.contact.id),
    mode: context.profile.outreachMode,
    people: people.data ?? [],
    claims: claims.data ?? [],
    offers: context.relationship.paths.filter((p) => p.kind === "introduction_offer"),
    histories,
    dailyLimit: context.profile.outreachDailyLimit,
    cooldownHours: context.profile.outreachCooldownHours,
  };
}
