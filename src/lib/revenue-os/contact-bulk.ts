import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { callContactBulkRpc } from "../supabase/server";
import { suppressContactFromCampaignEmail } from "./campaign-stops";
export const MAX_BULK_CONTACTS = 200;
export const MAX_TAGS_PER_CONTACT = 25;
const idsSchema = z
  .array(z.uuid())
  .min(1)
  .max(MAX_BULK_CONTACTS)
  .transform((ids) => [...new Set(ids)]);
const actorSchema = z.string().trim().min(1).max(320);
const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_-]{0,39}$/);
export function normalizeContactTag(value: unknown): string | null {
  const parsed = tagSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
export interface BulkRecordOutcome {
  contactId: string;
  status: "applied" | "skipped" | "failed";
  reason: string;
}
export interface BulkRunResult {
  outcomes: BulkRecordOutcome[];
  applied: number;
  skipped: number;
  failed: number;
}
function summarize(outcomes: BulkRecordOutcome[]): BulkRunResult {
  return {
    outcomes,
    applied: outcomes.filter((x) => x.status === "applied").length,
    skipped: outcomes.filter((x) => x.status === "skipped").length,
    failed: outcomes.filter((x) => x.status === "failed").length,
  };
}
const outcomesSchema = z.array(
  z.object({
    contactId: z.string(),
    status: z.enum(["applied", "skipped", "failed"]),
    reason: z.string(),
  }),
);
export async function bulkTagContacts(
  db: SupabaseClient,
  input: { contactIds: unknown; add?: unknown; remove?: unknown; actorEmail: string },
): Promise<BulkRunResult> {
  const ids = idsSchema.parse(input.contactIds);
  const add = [
    ...new Set(
      z
        .array(tagSchema)
        .max(25)
        .parse(input.add ?? []),
    ),
  ];
  const remove = [
    ...new Set(
      z
        .array(tagSchema)
        .max(25)
        .parse(input.remove ?? []),
    ),
  ];
  if (!add.length && !remove.length) throw new Error("Supply at least one tag to add or remove");
  const { data, error } = await callContactBulkRpc(db, "bulk_tag_contacts", {
    p_contacts: ids,
    p_add: add,
    p_remove: remove,
    p_actor: actorSchema.parse(input.actorEmail),
  });
  if (error) throw new Error(error.message);
  return summarize(outcomesSchema.parse(data));
}
export async function bulkEnrollContacts(
  db: SupabaseClient,
  input: { campaignId: string; contactIds: unknown; actorEmail: string },
): Promise<BulkRunResult> {
  const ids = idsSchema.parse(input.contactIds);
  const { data, error } = await callContactBulkRpc(db, "stage_campaign_members", {
    p_campaign: z.uuid().parse(input.campaignId),
    p_members: ids.map((contactId) => ({ contactId })),
    p_draft_only: true,
    p_actor: actorSchema.parse(input.actorEmail),
  });
  if (error) throw new Error(error.message);
  return summarize(outcomesSchema.parse(data));
}
/** Suppression uses the shared writer. Retrying also repairs outstanding stops
 * after a prior partial failure; already-suppressed contacts are not bypassed. */
export async function bulkSuppressContacts(
  db: SupabaseClient,
  input: { contactIds: unknown; actorEmail: string },
): Promise<BulkRunResult> {
  const ids = idsSchema.parse(input.contactIds);
  const actorEmail = actorSchema.parse(input.actorEmail);
  const outcomes: BulkRecordOutcome[] = [];
  for (const contactId of ids) {
    const { data, error } = await db
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .maybeSingle();
    if (error) {
      outcomes.push({ contactId, status: "failed", reason: error.message });
      continue;
    }
    if (!data) {
      outcomes.push({ contactId, status: "skipped", reason: "Contact unavailable" });
      continue;
    }
    try {
      await suppressContactFromCampaignEmail(db, {
        contactId,
        reason: "admin_suppressed",
        source: "admin",
        actorEmail,
      });
      outcomes.push({
        contactId,
        status: "applied",
        reason: "Campaign email suppressed; pending memberships stopped",
      });
    } catch (error) {
      outcomes.push({
        contactId,
        status: "failed",
        reason: `Suppression may be partially applied; retry to reconcile: ${error instanceof Error ? error.message : "receipt unavailable"}`,
      });
    }
  }
  return summarize(outcomes);
}
