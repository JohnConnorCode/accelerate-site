import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuditEvent {
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  source?: "admin" | "ai" | "automation" | "webhook" | "migration";
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(supabase: SupabaseClient, event: AuditEvent): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({
    actor_email: event.actorEmail ?? null,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    source: event.source ?? "admin",
    before_state: event.before ?? null,
    after_state: event.after ?? null,
    metadata: event.metadata ?? {},
  });
  if (error) console.error("[revenue-os/audit]", error.message);
}
