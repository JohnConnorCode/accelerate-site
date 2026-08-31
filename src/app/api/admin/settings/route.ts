import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { SERVER_ONLY_SECRET_KEYS } from "@/lib/admin/settings";
import { recordAudit } from "@/lib/revenue-os/audit";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const { data, error } = await supabase
    .from("admin_settings")
    .select("*")
    .order("key");

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  // Secret values are never returned, even masked; a mask still leaks length
  // and encourages treating the database as a secret store.
  const settings = (data || []).map(
    (s: { key: string; value: string; is_secret: boolean; description: string; updated_at: string }) => ({
      ...s,
      value: s.is_secret || SERVER_ONLY_SECRET_KEYS.has(s.key) ? "" : s.value,
      configured: SERVER_ONLY_SECRET_KEYS.has(s.key) ? Boolean(process.env[s.key]) : Boolean(s.value),
    })
  );

  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { key, value } = await request.json();

  if (!key || value === undefined) {
    return NextResponse.json({ error: "Missing key or value" }, { status: 400 });
  }

  if (SERVER_ONLY_SECRET_KEYS.has(key)) {
    return NextResponse.json(
      { error: `${key} is server-only. Configure it in Vercel environment variables.` },
      { status: 400 },
    );
  }

  const supabase = auth.database;
  const { data: existing } = await supabase
    .from("admin_settings")
    .select("key,value")
    .eq("key", key)
    .maybeSingle();

  const { error } = await supabase
    .from("admin_settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  await recordAudit(supabase, {
    actorEmail: auth.user.email,
    action: "settings.updated",
    entityType: "admin_settings",
    entityId: key,
    before: { key, configured: Boolean(existing?.value) },
    after: { key, configured: Boolean(value) },
  });

  return NextResponse.json({ success: true });
}
