import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { loadIntegrationCatalog } from "@/lib/revenue-os/integrations";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json(await loadIntegrationCatalog(auth.database));
  } catch {
    return NextResponse.json({ error: "The integration catalog could not be loaded." }, { status: 500 });
  }
}
