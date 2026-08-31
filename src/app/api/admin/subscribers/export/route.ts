import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { sanitizeCsv } from "@/lib/admin/csv";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const { data, error } = await supabase
    .from("subscribers")
    .select("email, source, subscribed_at, unsubscribed_at")
    .order("subscribed_at", { ascending: false });

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
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
        .map((v) => `"${sanitizeCsv(String(v))}"`)
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
