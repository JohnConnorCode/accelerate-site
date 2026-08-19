import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenant } from "@/config/tenant";
import { safeAttribution } from "@/lib/opportunities";
import type { UTMData } from "@/lib/utm";
import { recordAudit } from "./audit";
import { resolveOrCreateIdentity } from "./identity";
import { canTransition, canonicalStage, transitionOpportunity } from "./pipeline";
import { createRevenueTask } from "./tasks";

type Qualification = { qualified: boolean; reason: string };

export type CanonicalInboundInput = {
  name: string; email: string; phone?: string | null; companyName?: string | null; website?: string | null; industry?: string | null;
  source: "contact_form" | "chat" | "solution_request"; sourceRecordId: string; summary: string; utm?: UTMData | null;
};

export type RoofingInboundInput = {
  email: string; companyWebsite: string; role: string; revenueBand: string; primaryLeak: string;
  messageVariant?: string; qualifierToken: string; utm?: UTMData | null; qualification: Qualification;
};

function companyNameFromWebsite(website: string) {
  try { return new URL(website).hostname.replace(/^www\./, ""); } catch { return website; }
}

function contactNameFromEmail(email: string) {
  return (email.split("@")[0] ?? "").replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Website inquiry";
}

export async function ingestInboundLead(supabase: SupabaseClient, input: CanonicalInboundInput) {
  const email = input.email.trim().toLowerCase();
  const attribution = safeAttribution(input.utm);
  const identity = await resolveOrCreateIdentity(supabase, {
    name: input.name, email, phone: input.phone, companyName: input.companyName, website: input.website, industry: input.industry,
    source: input.source, sourceRecordType: input.source, sourceRecordId: input.sourceRecordId,
  });
  const { data: sourceMatch, error: sourceError } = await supabase.from("opportunities").select("*")
    .eq("source_record_type", input.source).eq("source_record_id", input.sourceRecordId).maybeSingle();
  if (sourceError) throw new Error(sourceError.message);
  let opportunity = sourceMatch;
  let existing = Boolean(sourceMatch);
  if (!opportunity) {
    const { data: emailMatches, error } = await supabase.from("opportunities").select("*").eq("email", email)
      .not("stage", "in", "(won,lost)").order("created_at", { ascending: false }).limit(2);
    if (error) throw new Error(error.message);
    if ((emailMatches?.length ?? 0) > 1) throw new Error("Multiple open opportunities match this email; review the identity before merging.");
    opportunity = emailMatches?.[0] ?? null;
    existing = Boolean(opportunity);
  }
  // "Reply to audit request" was left over from the roofing funnel and was being
  // written onto every contact-form inquiry regardless of industry, so the queue
  // told the founder a dental practice had asked for a roof audit.
  const nextAction = input.source === "chat" ? "Reply to new chat inquiry" : input.source === "solution_request" ? "Qualify manually created lead" : "Reply to new inquiry";
  if (opportunity) {
    const { data, error } = await supabase.from("opportunities").update({
      contact_id: identity.contact.id, company_id: identity.company.id, source: attribution.utm_source || "website",
      source_detail: attribution.utm_campaign || input.source, next_action: opportunity.next_action || nextAction,
      next_action_at: opportunity.next_action_at || new Date().toISOString(), ...attribution,
    }).eq("id", opportunity.id).select("*").single();
    if (error) throw new Error(error.message);
    opportunity = data;
  } else {
    const { data, error } = await supabase.from("opportunities").insert({
      name: input.companyName || identity.company.name, email, contact_id: identity.contact.id, company_id: identity.company.id,
      stage: "new", pipeline: "sales", probability: 10, source: attribution.utm_source || "website",
      source_detail: attribution.utm_campaign || input.source, source_record_type: input.source, source_record_id: input.sourceRecordId,
      next_action: nextAction, next_action_at: new Date().toISOString(), ...attribution,
    }).select("*").single();
    if (error) throw new Error(error.message);
    opportunity = data;
    await supabase.from("stage_events").insert({ opportunity_id: opportunity.id, from_stage: null, to_stage: "new", source: input.source, reason: "Inbound inquiry created" });
  }
  const externalId = `${input.source}:${input.sourceRecordId}`;
  const { data: activity } = await supabase.from("activities").select("id").eq("source", input.source).eq("external_id", externalId).maybeSingle();
  if (!activity) {
    const title = input.source === "chat" ? "Chat inquiry captured" : input.source === "solution_request" ? "Manual lead captured" : "Website inquiry captured";
    const { error } = await supabase.from("activities").insert({ activity_type: "form_submission", title, summary: input.summary.slice(0, 1000), contact_id: identity.contact.id, company_id: identity.company.id, opportunity_id: opportunity.id, source: input.source, external_id: externalId, metadata: { attribution } });
    if (error) throw new Error(error.message);
  }
  await createRevenueTask(supabase, { title: `${nextAction}: ${identity.company.name}`, description: input.summary.slice(0, 1000), dueDate: new Date().toISOString().slice(0, 10), priority: "high", relatedType: "opportunity", relatedId: opportunity.id, relatedName: identity.company.name, opportunityId: opportunity.id, source: input.source, dedupeKey: `inbound-follow-up:${opportunity.id}`, actorEmail: tenant.founder.systemActorEmail });
  await recordAudit(supabase, { actorEmail: tenant.founder.systemActorEmail, action: "inbound.captured", entityType: "opportunity", entityId: opportunity.id, source: "webhook", after: { stage: opportunity.stage, source: opportunity.source }, metadata: { inbound_source: input.source, source_record_id: input.sourceRecordId, existing } });
  return { opportunity, identity, existing };
}

/**
 * Single canonical ingestion path for the roofing qualifier. It deliberately
 * keeps the legacy fields alive while adding canonical identity, activities,
 * transition history, attribution, and an actionable owner commitment.
 */
export async function ingestRoofingQualification(supabase: SupabaseClient, input: RoofingInboundInput) {
  const { data: matches, error: matchError } = await supabase
    .from("opportunities").select("id,qualifier_token,qualified,stage,contact_id,company_id,next_action,next_action_at")
    .eq("email", input.email).order("created_at", { ascending: false }).limit(2);
  if (matchError) throw new Error(matchError.message);
  if ((matches?.length ?? 0) > 1) throw new Error("More than one opportunity matches this inquiry. Resolve the duplicate before accepting another submission.");
  const existing = matches?.[0] ?? null;
  const attribution = safeAttribution(input.utm);
  const targetStage = input.qualification.qualified ? "qualified" : "nurture" as const;
  const legacyFields = {
    email: input.email, company_website: input.companyWebsite, role: input.role, revenue_band: input.revenueBand,
    primary_leak: input.primaryLeak, qualified: input.qualification.qualified, qualification_reason: input.qualification.reason,
    qualifier_token: existing?.qualifier_token || input.qualifierToken,
    message_variant: input.messageVariant?.slice(0, 80) || null, source: attribution.utm_source || "website",
    source_detail: attribution.utm_campaign || "roofing_qualifier", ...attribution,
  };

  let opportunity: { id: string; qualifier_token: string | null; stage: string; contact_id: string | null; company_id: string | null; next_action: string | null; next_action_at: string | null };
  if (existing) {
    const { data, error } = await supabase.from("opportunities").update(legacyFields).eq("id", existing.id)
      .select("id,qualifier_token,stage,contact_id,company_id,next_action,next_action_at").single();
    if (error) throw new Error(error.message);
    opportunity = data;
  } else {
    const { data, error } = await supabase.from("opportunities").insert({ ...legacyFields, stage: "new", pipeline: "sales", probability: 10, next_action: input.qualification.qualified ? "Respond to qualified roofing audit request" : "Review nurture qualification", next_action_at: new Date().toISOString() })
      .select("id,qualifier_token,stage,contact_id,company_id,next_action,next_action_at").single();
    if (error) throw new Error(error.message);
    opportunity = data;
  }

  const identity = await resolveOrCreateIdentity(supabase, {
    name: contactNameFromEmail(input.email), email: input.email, companyName: companyNameFromWebsite(input.companyWebsite),
    website: input.companyWebsite, industry: "roofing", source: "roofing_qualifier",
  });
  const linkPatch: Record<string, unknown> = { contact_id: identity.contact.id, company_id: identity.company.id };
  if (!opportunity.next_action && input.qualification.qualified) {
    linkPatch.next_action = "Respond to qualified roofing audit request";
    linkPatch.next_action_at = new Date().toISOString();
  }
  const { data: linked, error: linkError } = await supabase.from("opportunities").update(linkPatch)
    .eq("id", opportunity.id).select("id,qualifier_token,stage,contact_id,company_id,next_action,next_action_at").single();
  if (linkError) throw new Error(linkError.message);
  opportunity = linked;

  const currentStage = canonicalStage(opportunity.stage);
  if (currentStage && currentStage !== targetStage && canTransition(opportunity.stage, targetStage)) {
    opportunity = await transitionOpportunity(supabase, { id: opportunity.id, to: targetStage, actorEmail: tenant.founder.systemActorEmail, source: "roofing_qualifier", reason: input.qualification.reason }) as typeof opportunity;
  }

  const activityId = `roofing-qualifier:${opportunity.id}:${input.qualification.qualified ? "qualified" : "nurture"}`;
  const { data: existingActivity, error: activityReadError } = await supabase.from("activities").select("id")
    .eq("source", "roofing_qualifier").eq("external_id", activityId).maybeSingle();
  if (activityReadError) throw new Error(activityReadError.message);
  const { error: activityError } = existingActivity ? { error: null } : await supabase.from("activities").insert({
    activity_type: "form_submission", title: input.qualification.qualified ? "Qualified roofing audit request" : "Roofing nurture inquiry",
    summary: input.qualification.reason, contact_id: identity.contact.id, company_id: identity.company.id, opportunity_id: opportunity.id,
    source: "roofing_qualifier", external_id: activityId, metadata: { role: input.role, revenue_band: input.revenueBand, primary_leak: input.primaryLeak, attribution },
  });
  if (activityError) throw new Error(activityError.message);

  if (input.qualification.qualified) {
    const dueDate = new Date().toISOString().slice(0, 10);
    await createRevenueTask(supabase, {
      title: `Respond to qualified roofing audit request: ${identity.company.name}`,
      description: `Review ${input.primaryLeak.replaceAll("_", " ")} and offer next steps to ${input.email}.`, dueDate, priority: "high",
      relatedType: "opportunity", relatedId: opportunity.id, relatedName: identity.company.name, opportunityId: opportunity.id,
      source: "roofing_qualifier", dedupeKey: `inbound-follow-up:${opportunity.id}`, actorEmail: tenant.founder.systemActorEmail,
    });
  }
  await recordAudit(supabase, { actorEmail: tenant.founder.systemActorEmail, action: "inbound.roofing_qualified", entityType: "opportunity", entityId: opportunity.id, source: "webhook", after: { stage: opportunity.stage, contact_id: identity.contact.id, company_id: identity.company.id }, metadata: { existing: Boolean(existing), qualified: input.qualification.qualified } });
  return { opportunity, existing: Boolean(existing), identity };
}
