import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { recordAudit } from "./audit";
import { contrastRatio, resolveWorkspaceBrand, workspaceBrandSchema } from "./branding-contract";
function revision(brand: unknown) {
  return createHash("sha256").update(JSON.stringify(brand)).digest("hex");
}
async function snapshot(db: SupabaseClient) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Workspace branding requires a tenant-bound database");
  const { data, error } = await db
    .from("tenants")
    .select("id,name,config,status")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || !data || data.status !== "active")
    throw new Error("Workspace branding is unavailable");
  return {
    ...data,
    expectedConfig: data.config === null ? null : JSON.stringify(data.config),
    config: (data.config ?? {}) as Record<string, unknown>,
  };
}
export async function readWorkspaceBrand(db: SupabaseClient) {
  const row = await snapshot(db);
  const brand = resolveWorkspaceBrand(row.config, row.name);
  return { brand, revision: revision(brand) };
}
/** Brand revision protects unsaved edits; the config CAS also preserves concurrent module settings. */
export async function saveWorkspaceBrand(
  db: SupabaseClient,
  raw: unknown,
  expectedRevision: string,
  actorEmail: string,
) {
  const brand = workspaceBrandSchema.parse(raw);
  if (
    contrastRatio(brand.inkColor, "#ffffff") < 4.5 ||
    contrastRatio(brand.inkColor, brand.backgroundColor) < 4.5
  )
    throw new Error("Text needs at least 4.5:1 contrast against white and the page background");
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await snapshot(db);
    const before = resolveWorkspaceBrand(row.config, row.name);
    if (revision(before) !== expectedRevision)
      throw new Error("Branding changed in another session. Reload before saving your changes.");
    const next = {
      ...row.config,
      brand: { ...((row.config.brand as Record<string, unknown>) ?? {}), ...brand },
    };
    let query = db
      .from("tenants")
      .update({ config: next, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "active");
    // A null config needs IS NULL, not equality with an empty JSON object.
    query =
      row.expectedConfig === null
        ? query.is("config", null)
        : query.eq("config", row.expectedConfig);
    const result = await query.select("id").maybeSingle();
    if (result.error) throw new Error("Branding could not be saved");
    if (!result.data) continue;
    await recordAudit(db, {
      actorEmail,
      action: "workspace.branding_updated",
      entityType: "tenant",
      entityId: row.id,
      before,
      after: brand,
    });
    return { brand, revision: revision(brand) };
  }
  throw new Error("Workspace settings changed concurrently. Reload and retry.");
}
