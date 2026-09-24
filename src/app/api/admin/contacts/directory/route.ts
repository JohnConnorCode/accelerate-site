import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Math.min(10000, Number(params.get("page")) || 1));
  const search = params.get("search")?.trim().slice(0, 100) ?? "";
  const offset = (page - 1) * 50;
  let query = auth.database
    .from("contacts")
    .select(
      "id,full_name,primary_email,phone,title,lifecycle_stage,communication_status,next_action,next_action_at,company_id,created_at,updated_at",
      { count: "exact" },
    )
    .eq("tenant_id", auth.tenant.id)
    .order("updated_at", { ascending: false })
    .range(offset, offset + 49);
  if (search) {
    const escaped = search.replace(/[%,()]/g, "");
    query = query.or(`full_name.ilike.%${escaped}%,primary_email.ilike.%${escaped}%`);
  }
  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: "Contacts could not be loaded" }, { status: 500 });
  return NextResponse.json({ contacts: data ?? [], total: count ?? 0, page, pageSize: 50 });
}
