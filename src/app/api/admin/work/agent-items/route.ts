import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const page = Math.max(1, Math.min(10000, Number(request.nextUrl.searchParams.get("page")) || 1));
  const status = request.nextUrl.searchParams.get("status") || "active";
  let query = auth.database
    .from("work_items")
    .select(
      "id,kind,objective,reason,source,status,priority,due_at,next_check_at,next_check_reason,outcome,error,agent_run_id,created_at,finished_at",
      { count: "exact" },
    )
    .eq("tenant_id", auth.tenant.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * 25, page * 25 - 1);
  if (status === "active")
    query = query.in("status", ["pending", "claimed", "in_progress", "waiting", "failed"]);
  else if (["completed", "cancelled"].includes(status)) query = query.eq("status", status);
  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: "AI work could not be loaded" }, { status: 500 });
  return NextResponse.json({ items: data ?? [], total: count ?? 0, page });
}
