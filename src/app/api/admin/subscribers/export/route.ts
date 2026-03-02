import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("subscribers")
    .select("email, source, subscribed_at, unsubscribed_at")
    .order("subscribed_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const headers = ["Email", "Source", "Status", "Subscribed", "Unsubscribed"];
  const rows = (data || []).map(
    (r: Record<string, unknown>) =>
      [
        r.email,
        r.source || "website",
        r.unsubscribed_at ? "Unsubscribed" : "Active",
        new Date(r.subscribed_at as string).toLocaleDateString(),
        r.unsubscribed_at ? new Date(r.unsubscribed_at as string).toLocaleDateString() : "",
      ]
        .map((v) => `"${v}"`)
        .join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="subscribers-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
