import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { loadOperatorQueue, summarizeOperatorQueue } from "@/lib/revenue-os/queue";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;

  const [notificationsRes, unreadRes, urgentRes, priorityItems] = await Promise.all([
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
    loadOperatorQueue(supabase).catch((error) => {
      console.error("[admin/notifications/priority]", error);
      return null;
    }),
  ]);

  const firstError = [notificationsRes.error, unreadRes.error, urgentRes.error].find(Boolean);
  if (firstError) {
    console.error("[admin/notifications]", firstError.message);
    return NextResponse.json({ error: "Could not load notifications." }, { status: 500 });
  }

  return NextResponse.json({
    notifications: notificationsRes.data || [],
    unreadCount: unreadRes.count || 0,
    urgentCount: urgentRes.count || 0,
    priority: {
      status: priorityItems ? "ready" : "degraded",
      summary: summarizeOperatorQueue(priorityItems ?? []),
      items: (priorityItems ?? []).slice(0, 5),
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const body = await request.json();

  if (body.markAllRead) {
    const { error } = await supabase
      .from("admin_notifications")
      .update({ read: true })
      .eq("read", false);

    if (error) {
      console.error("Database error:", error.message);
      return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (body.id) {
    const { error } = await supabase
      .from("admin_notifications")
      .update({ read: true })
      .eq("id", body.id);

    if (error) {
      console.error("Database error:", error.message);
      return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
