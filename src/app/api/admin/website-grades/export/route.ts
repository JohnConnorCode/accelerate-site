import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { sanitizeCsv } from "@/lib/admin/csv";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const { data, error } = await supabase
    .from("website_grades")
    .select("url, email, overall_score, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  const headers = ["URL", "Email", "Score", "Date"];
  const rows = (data || []).map((r: Record<string, unknown>) =>
    [r.url, r.email, r.overall_score, new Date(r.created_at as string).toLocaleDateString()]
      .map((v) => `"${sanitizeCsv(String(v ?? "")).replace(/"/g, '""')}"`)
      .join(","),
  );

  const csv = [headers.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="website-grades-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
