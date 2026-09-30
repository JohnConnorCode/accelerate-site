import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { SERVER_ONLY_SECRET_KEYS } from "@/lib/admin/settings";
import { applyWorkspaceConfigurationAsAdmin } from "@/lib/revenue-os/workspace-configuration";
import { readBoundedJson } from "@/lib/http/bounded-json";
import { z } from "zod";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = auth.database;
  const { data, error } = await supabase.from("admin_settings").select("*").order("key");

  if (error) {
    console.error("Database error:", error.message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }

  // Secret values are never returned, even masked; a mask still leaks length
  // and encourages treating the database as a secret store.
  const settings = (data || []).map(
    (s: {
      key: string;
      value: string;
      is_secret: boolean;
      description: string;
      updated_at: string;
    }) => ({
      ...s,
      value: s.is_secret || SERVER_ONLY_SECRET_KEYS.has(s.key) ? "" : s.value,
      configured: SERVER_ONLY_SECRET_KEYS.has(s.key)
        ? Boolean(process.env[s.key])
        : Boolean(s.value),
    }),
  );

  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const raw = await readBoundedJson(request).catch(() => null);
  const input = z.object({ key: z.string(), value: z.string() }).strict().safeParse(raw);
  if (!input.success)
    return NextResponse.json({ error: "Missing or invalid key/value" }, { status: 400 });
  if (input.data.key === "ADMIN_EMAIL" || SERVER_ONLY_SECRET_KEYS.has(input.data.key))
    return NextResponse.json(
      {
        error:
          "This is installation configuration. The owner must update the server environment securely.",
      },
      { status: 400 },
    );
  try {
    const result = await applyWorkspaceConfigurationAsAdmin(
      auth.database,
      { operation: "set_workspace_setting", ...input.data },
      auth.user.email!,
    );
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preference could not be saved" },
      { status: 409 },
    );
  }
}
