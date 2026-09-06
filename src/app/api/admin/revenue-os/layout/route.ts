import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  ADMIN_LAYOUT_SCOPES,
  applyLayoutChange,
  getCurrentLayout,
  getLayoutScope,
  revertLayoutChange,
} from "@/lib/revenue-os/admin-layout";
import { listAuditHistory } from "@/lib/revenue-os/audit";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const scope = request.nextUrl.searchParams.get("scope");
  if (!scope || !getLayoutScope(scope)) {
    return NextResponse.json(
      {
        error: `Unknown layout scope. Expected one of: ${ADMIN_LAYOUT_SCOPES.map((s) => s.id).join(", ")}`,
      },
      { status: 400 },
    );
  }

  const supabase = auth.database;
  const [doc, history] = await Promise.all([
    getCurrentLayout(supabase, scope, auth.tenant.id),
    listAuditHistory(supabase, { entityType: "admin_layout", entityId: scope, limit: 20 }),
  ]);

  return NextResponse.json({ scope, doc, history: history.entries });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { scope, action, doc } = await request.json();
  if (!scope || !getLayoutScope(scope)) {
    return NextResponse.json({ error: "Unknown layout scope" }, { status: 400 });
  }
  // Founder-direct save: the founder is the authority, so their own layout
  // preference applies immediately with an audit receipt instead of staging
  // through the AI approval queue (which exists for agent proposals).
  if (action === "save") {
    try {
      const saved = await applyLayoutChange(auth.database, {
        scope,
        doc: doc ?? {},
        actorEmail: auth.user.email || "founder",
        source: "admin",
        tenantId: auth.tenant.id,
      });
      return NextResponse.json({ scope, doc: saved });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Save failed" },
        { status: 400 },
      );
    }
  }
  if (action !== "revert") {
    return NextResponse.json({ error: "Unsupported layout action" }, { status: 400 });
  }

  try {
    const doc = await revertLayoutChange(auth.database, {
      scope,
      actorEmail: auth.user.email || "founder",
      tenantId: auth.tenant.id,
    });
    return NextResponse.json({ scope, doc });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Revert failed" },
      { status: 400 },
    );
  }
}
