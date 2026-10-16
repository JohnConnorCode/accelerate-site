import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { readBoundedJson } from "@/lib/http/bounded-json";
import {
  executeTicketAdminCommand,
  proposeTicketAdminCommand,
  readTicketWorkspace,
} from "@/lib/revenue-os/event-ticketing";
import { ticketAdminProposalSchema } from "@/lib/revenue-os/event-ticketing-contract";

export async function GET(request: NextRequest) {
  const auth = await requireAdminForModule("event-ticketing");
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(
      await readTicketWorkspace(
        auth.database,
        request.nextUrl.searchParams.get("eventId") || undefined,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[events] Workshop read failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      {
        error:
          "Events could not be loaded. Check workspace setup and the event-ticketing migration, then retry.",
      },
      { status: 503 },
    );
  }
}
export async function POST(request: NextRequest) {
  const auth = await requireAdminForModule("event-ticketing");
  if (auth instanceof NextResponse) return auth;
  try {
    const raw = await readBoundedJson(request, 20000);
    const proposal = ticketAdminProposalSchema.safeParse(raw);
    if (proposal.success)
      return NextResponse.json({
        action: await proposeTicketAdminCommand(
          auth.database,
          proposal.data.command,
          auth.user.email!,
        ),
      });
    const result = await executeTicketAdminCommand(auth.database, raw, auth.user.email!);
    return NextResponse.json({ saved: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Event operation failed";
    return NextResponse.json(
      { error: message },
      { status: /changed|already used|Capacity/.test(message) ? 409 : 422 },
    );
  }
}
