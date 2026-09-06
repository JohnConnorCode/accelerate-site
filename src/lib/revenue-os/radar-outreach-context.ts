import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { getModuleSettings, isModuleEnabled } from "./modules";
import { radarProfileSchema } from "./radar-profile-contract";
import { readRadarStore } from "./radar-store";
import { getRadarRelationshipContext } from "./radar-relationship-context";
import { readInboundContactEvidence } from "./conversations";
import { radarIntroductionConsentSchema } from "./radar-outreach-contract";

/** Draft preparation reads the canonical packet and relationship memory first.
 * It never treats public profile copy as independently approved facts. */
export async function readRadarOutreachContext(db: SupabaseClient, opportunityId: string) {
  z.uuid().parse(opportunityId);
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Outreach requires an explicit workspace");
  const tenant = await db.from("tenants").select("status,config").eq("id", tenantId).single();
  if (
    tenant.error ||
    tenant.data?.status !== "active" ||
    !isModuleEnabled("opportunity-radar", tenant.data.config)
  )
    throw new Error("Radar is disabled or unavailable");
  const profile = radarProfileSchema.parse(
    getModuleSettings("opportunity-radar", tenant.data.config.moduleSettings),
  );
  const packet = await readRadarStore(db, { opportunityId });
  if (!("opportunity" in packet) || !packet.opportunity?.contact_id)
    throw new Error("Link a canonical contact before preparing outreach");
  const contactId = String(packet.opportunity.contact_id);
  const relationship = await getRadarRelationshipContext(db, { contactId });
  if (relationship.contact.communication_status !== "active")
    throw new Error("The contact is suppressed");
  const contact = await db
    .from("contacts")
    .select("id,primary_email,full_name,communication_status,updated_at")
    .eq("tenant_id", tenantId)
    .eq("id", contactId)
    .single();
  if (contact.error || !contact.data || !z.email().safeParse(contact.data.primary_email).success)
    throw new Error("Canonical recipient address unavailable; do not guess a contact method");
  return {
    tenantId,
    config: tenant.data.config,
    profile,
    packet,
    relationship,
    contact: contact.data,
  };
}

/** This proves the cited words were received from each exact party. A human must
 * still confirm that those words authorize this particular introduction. */
export async function readRadarIntroductionConsents(
  db: SupabaseClient,
  contactIds: [string, string],
  raw: unknown,
  now = new Date(),
) {
  const ids = z.tuple([z.uuid(), z.uuid()]).parse(contactIds);
  const consents = z.array(radarIntroductionConsentSchema).length(2).parse(raw);
  if (
    ids[0] === ids[1] ||
    new Set(consents.map((c) => c.contactId)).size !== 2 ||
    consents.some((c) => !ids.includes(c.contactId))
  )
    throw new Error("Both exact introduction parties must provide consent evidence");
  const results = [];
  for (const consent of consents) {
    const expiry = Date.parse(consent.validUntil);
    if (expiry <= now.getTime() || expiry > now.getTime() + 30 * 86400000)
      throw new Error("Introduction consent must be current and expire within 30 days");
    const cited = await readInboundContactEvidence(db, {
      contactId: consent.contactId,
      messageId: consent.messageId,
      allowAssociated: true,
    });
    if (!cited.text.includes(consent.quotation))
      throw new Error("Consent quotation does not match received evidence");
    results.push({ ...consent, evidence: cited.snapshot, subject: cited.title });
  }
  return {
    consents: results,
    requiresHumanMeaningReview: true as const,
    sendingAuthorized: false as const,
  };
}
