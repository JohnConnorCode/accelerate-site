import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { getAgentWork, controlAgentWork } from "@/lib/revenue-os/agent-work";
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(
      await runWithTenantRequestContext(auth, () =>
        getAgentWork(
          auth.database,
          { workItemId: request.nextUrl.searchParams.get("id") },
          auth.user.email || "",
        ),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (issue) {
    return NextResponse.json(
      { error: issue instanceof Error ? issue.message : "Work is unavailable" },
      { status: 404 },
    );
  }
}
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(
      await runWithTenantRequestContext(auth, async () =>
        controlAgentWork(auth.database, await request.json(), auth.user.email || ""),
      ),
    );
  } catch (issue) {
    return NextResponse.json(
      { error: issue instanceof Error ? issue.message : "Work control failed" },
      { status: 409 },
    );
  }
}
