import { NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { loadRevenueReport } from "@/lib/revenue-os/analytics";

export async function GET() {
  const auth = await requireAdminForModule("revenue");
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json(await loadRevenueReport(auth.database, auth.tenant.id));
  } catch {
    console.error("Revenue report unavailable: complete reporting sources could not be read");
    return NextResponse.json(
      {
        error:
          "Revenue could not be read completely. Retry, or ask your workspace owner to check reporting access and limits.",
        retryable: true,
      },
      { status: 503 },
    );
  }
}
