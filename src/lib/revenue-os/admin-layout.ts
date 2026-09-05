import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getLayoutScope } from "@/lib/admin/layout-scopes";
import type { LayoutDoc } from "@/lib/admin/layout-overrides";
import { proposeAction } from "./actions";
import { recordAudit, listAuditHistory } from "./audit";

export {
  ADMIN_LAYOUT_SCOPES,
  getLayoutScope,
  TODAY_LAYOUT_REGIONS,
} from "@/lib/admin/layout-scopes";

function settingsKey(scope: string): string {
  return `admin_layout.${scope}`;
}

export function validateLayoutDoc(scope: string, doc: unknown): LayoutDoc {
  const scopeDef = getLayoutScope(scope);
  if (!scopeDef) throw new Error(`Unknown layout scope: ${scope}`);

  const raw = (doc ?? {}) as Partial<LayoutDoc>;
  const order = Array.isArray(raw.order) ? raw.order.filter((id) => typeof id === "string") : [];
  const hidden = Array.isArray(raw.hidden) ? raw.hidden.filter((id) => typeof id === "string") : [];

  const allowedIds = new Set(scopeDef.regions.map((region) => region.id));
  const unknownOrder = order.filter((id) => !allowedIds.has(id));
  const unknownHidden = hidden.filter((id) => !allowedIds.has(id));
  if (unknownOrder.length || unknownHidden.length) {
    throw new Error(
      `Layout doc for ${scope} references unknown ids: ${[...unknownOrder, ...unknownHidden].join(", ")}`,
    );
  }

  const blockedHides = hidden.filter((id) => scopeDef.requiredIds.includes(id));
  if (blockedHides.length) {
    throw new Error(
      `Layout doc for ${scope} cannot hide required region(s): ${blockedHides.join(", ")}`,
    );
  }

  return { order, hidden };
}

export async function getCurrentLayout(
  supabase: SupabaseClient,
  scope: string,
  tenantId: string,
): Promise<LayoutDoc | null> {
  if (!tenantId?.trim()) throw new Error("A tenant id is required to read layout docs");
  const { data, error } = await supabase
    .from("admin_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", settingsKey(scope))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.value) return null;
  try {
    return validateLayoutDoc(scope, JSON.parse(data.value));
  } catch {
    // A stored doc that no longer validates (e.g. a scope's known ids
    // changed) falls back to the hardcoded default rather than breaking
    // the page — it is not a reason to error the whole render.
    return null;
  }
}

export async function proposeLayoutChange(
  supabase: SupabaseClient,
  input: { scope: string; doc: unknown; actorEmail: string; reasoning?: string },
) {
  const doc = validateLayoutDoc(input.scope, input.doc);
  return proposeAction(supabase, {
    actionType: "admin_layout_change",
    title: `Update ${getLayoutScope(input.scope)?.label ?? input.scope} layout`,
    description: input.reasoning,
    urgency: "low",
    payload: { scope: input.scope, doc },
    reasoning: input.reasoning,
    sourceContext: "admin_ai",
    // action_queue.entity_id is a UUID column for linking to a real business
    // record (contact/opportunity/etc). A layout scope is a config string,
    // not one of those — entityType/entityId are correctly omitted here.
    // The scope already travels in `payload.scope` for dedup and display;
    // audit_log.entity_id (TEXT) is where the scope string belongs, and
    // applyLayoutChange/revertLayoutChange already use it there correctly.
    dedupeKey: `ai-layout:${input.scope}`,
    proposedBy: input.actorEmail,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
}

export async function applyLayoutChange(
  supabase: SupabaseClient,
  input: {
    scope: string;
    doc: unknown;
    actorEmail: string;
    source?: "ai" | "admin";
    tenantId: string;
  },
) {
  const doc = validateLayoutDoc(input.scope, input.doc);
  if (!input.tenantId?.trim()) throw new Error("A tenant id is required to save layout docs");
  const before = await getCurrentLayout(supabase, input.scope, input.tenantId);
  const key = settingsKey(input.scope);
  const { error } = await supabase
    .from("admin_settings")
    .upsert(
      {
        tenant_id: input.tenantId,
        key,
        value: JSON.stringify(doc),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,key" },
    );
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "admin_layout.applied",
    entityType: "admin_layout",
    entityId: input.scope,
    source: input.source ?? "ai",
    before,
    after: doc,
  });
  return doc;
}

export async function revertLayoutChange(
  supabase: SupabaseClient,
  input: { scope: string; actorEmail: string; tenantId: string },
) {
  if (!getLayoutScope(input.scope)) throw new Error(`Unknown layout scope: ${input.scope}`);
  if (!input.tenantId?.trim()) throw new Error("A tenant id is required to revert layout docs");

  const { entries } = await listAuditHistory(supabase, {
    entityType: "admin_layout",
    entityId: input.scope,
    limit: 1,
  });
  const last = entries[0];
  if (!last) throw new Error(`No layout history to revert for ${input.scope}`);

  const previous = validateLayoutDoc(input.scope, last.before ?? { order: [], hidden: [] });
  const current = await getCurrentLayout(supabase, input.scope, input.tenantId);
  const key = settingsKey(input.scope);
  const { error } = await supabase
    .from("admin_settings")
    .upsert(
      {
        tenant_id: input.tenantId,
        key,
        value: JSON.stringify(previous),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,key" },
    );
  if (error) throw new Error(error.message);

  await recordAudit(supabase, {
    actorEmail: input.actorEmail,
    action: "admin_layout.reverted",
    entityType: "admin_layout",
    entityId: input.scope,
    source: "admin",
    before: current,
    after: previous,
  });
  return previous;
}
