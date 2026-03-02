import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();

  const [notificationsRes, unreadRes, urgentRes] = await Promise.all([
    supabase
      .from("admin_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("admin_notifications")
      .select("id", { count: "exact", head: true })
      .eq("read", false),
    supabase
      .from("admin_notifications")
      .select("id", { count: "exact", head: true })
      .eq("read", false)
      .eq("priority", "urgent"),
  ]);

  return NextResponse.json({
    notifications: notificationsRes.data || [],
    unreadCount: unreadRes.count || 0,
    urgentCount: urgentRes.count || 0,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const body = await request.json();

  if (body.markAllRead) {
    const { error } = await supabase
      .from("admin_notifications")
      .update({ read: true })
      .eq("read", false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (body.id) {
    const { error } = await supabase
      .from("admin_notifications")
      .update({ read: true })
      .eq("id", body.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
