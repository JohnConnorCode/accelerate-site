import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin, requirePlatformAdmin } from "@/lib/admin/auth";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import type { KanbanBoardKey } from "./types";

export interface KanbanBoardAuthOk {
  ok: true;
  supabase: SupabaseClient;
  /** Null only for the platform-global `features` board. */
  tenantId: string | null;
  /** The active tenant's config, for boards that need it (e.g. pipeline's
   * `stageLabels` override for lazy-seeding). Null for `features`. */
  tenantConfig: Record<string, unknown> | null;
  actorEmail: string | null;
}

export interface KanbanBoardAuthErr {
  ok: false;
  response: NextResponse;
}

export type KanbanBoardAuth = KanbanBoardAuthOk | KanbanBoardAuthErr;

/**
 * The one place board-key-to-auth-strategy logic lives. Each board mirrors
 * the exact auth its existing route uses today:
 * - features: requirePlatformAdmin() + the platform service-role client
 *   (src/app/api/admin/features/route.ts).
 * - content: requireAdminForModule("content") + the tenant-bound
 *   auth.database client (src/app/api/admin/content/route.ts).
 * - pipeline: requireAdmin() + the tenant-bound auth.database client
 *   (src/app/api/admin/revenue-os/pipeline/route.ts).
 */
export async function resolveKanbanBoardAuth(boardKey: KanbanBoardKey): Promise<KanbanBoardAuth> {
  if (boardKey === "features") {
    const auth = await requirePlatformAdmin();
    if (auth instanceof NextResponse) return { ok: false, response: auth };
    return {
      ok: true,
      supabase: createPlatformServiceRoleClient("kanban-features"),
      tenantId: null,
      tenantConfig: null,
      actorEmail: auth.user.email ?? null,
    };
  }

  if (boardKey === "content") {
    const auth = await requireAdminForModule("content");
    if (auth instanceof NextResponse) return { ok: false, response: auth };
    return {
      ok: true,
      supabase: auth.database,
      tenantId: auth.tenant.id,
      tenantConfig: auth.tenant.config,
      actorEmail: auth.user.email ?? null,
    };
  }

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return { ok: false, response: auth };
  return {
    ok: true,
    supabase: auth.database,
    tenantId: auth.tenant.id,
    tenantConfig: auth.tenant.config,
    actorEmail: auth.user.email ?? null,
  };
}
