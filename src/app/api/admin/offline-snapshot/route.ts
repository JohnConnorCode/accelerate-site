import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { loadOperatorQueue, summarizeOperatorQueue } from "@/lib/revenue-os/queue";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const items = await loadOperatorQueue(auth.database, { onSourceError: () => undefined });
    return NextResponse.json({
      version: 1,
      tenantSlug: auth.tenant.slug,
      userId: auth.user.id,
      tenantName: auth.tenant.name,
      generatedAt: new Date().toISOString(),
      summary: summarizeOperatorQueue(items),
    });
  } catch (error) {
    console.error("[admin/offline-snapshot]", error);
    return NextResponse.json(
      { error: "Could not prepare the offline workspace snapshot." },
      { status: 500 },
    );
  }
}
