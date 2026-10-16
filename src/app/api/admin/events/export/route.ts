import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { readTicketWorkspace } from "@/lib/revenue-os/event-ticketing";
import { ticketOrdersCsv } from "@/lib/revenue-os/event-ticketing-contract";

export async function GET(request: NextRequest) {
  const auth = await requireAdminForModule("event-ticketing");
  if (auth instanceof NextResponse) return auth;
  try {
    const workspace = await readTicketWorkspace(
      auth.database,
      request.nextUrl.searchParams.get("eventId") || undefined,
    );
    if (workspace.truncated)
      return NextResponse.json(
        {
          error:
            "Select one event with at most 500 orders before exporting. A partial export is unavailable.",
        },
        { status: 422 },
      );
    return new NextResponse(ticketOrdersCsv(workspace.orders), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="ticket-orders.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "[events/export] Ticket export failed",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json({ error: "Ticket orders could not be exported" }, { status: 503 });
  }
}
