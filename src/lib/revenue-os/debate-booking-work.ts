import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { isModuleEnabled } from "./modules";
import { loadDebateProduction, refreshDebateInvitation } from "./debate-bookings";
import { registerWorkKindHandler } from "./work-executor";
import { createWorkItem } from "./work-items";

/** Recheck linked invitations daily so cancellations and changed attendee responses reach Today. */
export async function scheduleDebateBookingReconciliation(db: SupabaseClient) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Debate reconciliation requires an explicit workspace");
  const tenant = await db.from("tenants").select("config").eq("id", tenantId).single();
  if (tenant.error) throw new Error("Booking module configuration is unavailable");
  if (!isModuleEnabled("bookings", tenant.data.config)) return { created: 0, skipped: 0 };
  const events = await db.from("debate_productions")
    .select("id,title,target_at")
    .eq("tenant_id", tenantId)
    .not("calendar_event_id", "is", null)
    .gte("target_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString())
    .order("target_at", { ascending: true })
    .limit(101);
  if (events.error) throw new Error("Debate invitations could not be listed");
  if ((events.data?.length ?? 0) > 100)
    throw new Error("More than 100 linked debate invitations require a paged reconciliation run");
  let created = 0;
  let skipped = 0;
  const day = new Date().toISOString().slice(0, 10);
  for (const production of events.data ?? []) {
    const result = await createWorkItem(db, {
      kind: "debate_invitation_reconcile",
      objective: `Verify invitation: ${production.title}`,
      reason: "A linked invitation needs a current Google Calendar receipt and participant responses",
      source: "debate_bookings",
      priority: "high",
      entityType: "debate_production",
      entityId: production.id,
      dedupeKey: `debate-invitation-reconcile:${production.id}:${day}`,
      dedupeAcrossStatuses: true,
      maxAttempts: 3,
    });
    if (result.deduplicated) skipped++;
    else created++;
  }
  return { created, skipped };
}

export function registerDebateBookingWorkHandlers() {
  registerWorkKindHandler("debate_invitation_reconcile", async (db, work) => {
    if (!work.entity_id) throw new Error("Debate reconciliation has no production id");
    const booking = await loadDebateProduction(db, work.entity_id);
    if (!booking.calendar) return { status: "skipped", outcome: "The invitation was already reopened" };
    await refreshDebateInvitation(db, work.entity_id);
    const refreshed = await loadDebateProduction(db, work.entity_id);
    return {
      status: "completed",
      outcome: refreshed.nextAction.booked
        ? "The current Google invitation and participant responses confirm the booking"
        : `Google invitation checked. Next: ${refreshed.nextAction.reason}`,
    };
  });
}
