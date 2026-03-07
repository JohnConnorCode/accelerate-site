import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";
import { sanitizeCsv } from "@/lib/admin/csv";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("contact_submissions")
    .select("name, email, phone, business_type, message, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  const headers = ["Name", "Email", "Phone", "Business Type", "Message", "Date"];
  const rows = (data || []).map(
    (r: Record<string, unknown>) =>
      [
        r.name,
        r.email,
        r.phone || "",
        r.business_type || "",
        String(r.message || "").replace(/"/g, '""').replace(/\n/g, " "),
        new Date(r.created_at as string).toLocaleDateString(),
      ]
        .map((v) => `"${sanitizeCsv(String(v))}"`)
        .join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="contacts-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
