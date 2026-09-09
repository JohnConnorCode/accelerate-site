import { NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { getSiteModelCatalog } from "@/lib/site-studio/model-catalog";

export async function GET(request: Request) {
  const auth = await requireAdminForModule("site-studio");
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(
    await getSiteModelCatalog(new URL(request.url).searchParams.get("refresh") === "1"),
    {
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
