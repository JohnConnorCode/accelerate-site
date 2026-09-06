import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { MODULE_MAP } from "./modules";
import { getEntityType, registerEntityType } from "./entity-registry";
/** Trusted core read policies. A manifest cannot invent a backing table or
 * expand these fields. Existing operator policies are preserved. */
export const BUNDLED_SOURCE_POLICIES = {
  report_opportunities: {
    backingTable: "opportunities",
    readableColumns: ["name", "stage", "updated_at", "next_action_at"],
  },
  report_tasks: { backingTable: "tasks", readableColumns: ["title", "status", "due_date"] },
  report_calendar_events: {
    backingTable: "calendar_events",
    readableColumns: ["title", "status", "start_at", "end_at"],
  },
  workflow_contacts: { backingTable: "contacts", readableColumns: ["full_name", "primary_email"] },
  workflow_opportunities: {
    backingTable: "opportunities",
    readableColumns: ["name", "stage", "owner_email", "contact_id"],
  },
  workflow_meetings: {
    backingTable: "calendar_events",
    readableColumns: ["title", "start_at", "end_at", "contact_id", "opportunity_id"],
  },
} as const;
/** Enabling a bundled plugin explicitly installs its missing read-policy rows,
 * never SQL schema or business records. No policy is overwritten or re-enabled. */
export async function ensureBundledPluginSources(db: SupabaseClient, pluginId: string) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Tenant-bound plugin installation required");
  const moduleDef = MODULE_MAP.get(pluginId);
  const sources = moduleDef?.workflow?.sources ?? moduleDef?.report?.sources ?? [];
  for (const source of sources) {
    if (!Object.hasOwn(BUNDLED_SOURCE_POLICIES, source.type)) continue;
    const policy = BUNDLED_SOURCE_POLICIES[source.type as keyof typeof BUNDLED_SOURCE_POLICIES];
    if (await getEntityType(db, tenantId, source.type)) continue;
    await registerEntityType(db, {
      tenantId,
      typeKey: source.type,
      label: source.type.replaceAll("_", " "),
      backingTable: policy.backingTable,
      readableColumns: [...policy.readableColumns],
    });
  }
}
