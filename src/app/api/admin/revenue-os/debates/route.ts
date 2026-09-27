import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import {
  createDebateProduction,
  listDebateProductions,
  loadDebateProduction,
  recordDebateMilestone,
  refreshDebateInvitation,
  reopenCancelledDebateInvitation,
  updateDebateProduction,
} from "@/lib/revenue-os/debate-bookings";
import { proposeDebateInvitation } from "@/lib/revenue-os/debate-invitations";

export async function GET(request: NextRequest) {
  const auth = await requireAdminForModule("bookings");
  if (auth instanceof NextResponse) return auth;
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json(await listDebateProductions(auth.database));
    const booking = await loadDebateProduction(auth.database, id);
    const emails = booking.contacts.map((contact) => contact.primary_email).filter(Boolean);
    const messages = emails.length
      ? await auth.database.from("messages")
          .select("id,conversation_id,sender_email,body_text,received_at,external_id")
          .eq("tenant_id", auth.tenant.id).eq("direction", "inbound")
          .in("sender_email", emails).order("received_at", { ascending: false }).limit(40)
      : { data: [], error: null };
    if (messages.error) throw new Error("Participant messages could not be loaded");
    const citedMessages = booking.milestones.filter((item) => item.source_type === "gmail_message")
      .map((item) => item.source_id);
    const citedDocuments = booking.milestones.filter((item) => item.source_type === "drive_document")
      .map((item) => item.source_id);
    const [messageSources, documentSources] = await Promise.all([
      citedMessages.length ? auth.database.from("messages").select("id,conversation_id")
        .eq("tenant_id", auth.tenant.id).in("id", citedMessages)
        : Promise.resolve({ data: [], error: null }),
      citedDocuments.length ? auth.database.from("drive_documents").select("id,web_view_link")
        .eq("tenant_id", auth.tenant.id).in("id", citedDocuments)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (messageSources.error || documentSources.error)
      throw new Error("Booking source links could not be loaded");
    const sourceLinks: Record<string, string> = {};
    for (const message of messageSources.data ?? [])
      sourceLinks[message.id] = `/admin/conversations?thread=${message.conversation_id}`;
    for (const document of documentSources.data ?? []) {
      if (!document.web_view_link || !URL.canParse(document.web_view_link)) continue;
      const url = new URL(document.web_view_link);
      if (url.protocol === "https:" && (url.hostname === "google.com" || url.hostname.endsWith(".google.com")))
        sourceLinks[document.id] = url.toString();
    }
    return NextResponse.json({ ...booking, acceptanceMessages: messages.data ?? [], sourceLinks });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load debate productions" },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminForModule("bookings");
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(
      await createDebateProduction(auth.database, await request.json(), auth.user.email || "founder"),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create debate production" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminForModule("bookings");
  if (auth instanceof NextResponse) return auth;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result =
      body.operation === "milestone"
        ? await recordDebateMilestone(auth.database, {
            ...body,
            ...(body.sourceType === "founder_confirmation" ? { sourceId: auth.user.email } : {}),
          }, auth.user.email || "founder")
        : body.operation === "update"
          ? await updateDebateProduction(auth.database, body, auth.user.email || "founder")
          : body.operation === "invite"
            ? await proposeDebateInvitation(auth.database, body, auth.user.email || "founder")
            : body.operation === "verify_calendar"
              ? await refreshDebateInvitation(auth.database, String(body.productionId ?? ""))
              : body.operation === "reopen_cancelled_invitation"
                ? await reopenCancelledDebateInvitation(auth.database,
                    String(body.productionId ?? ""), Number(body.expectedRevision),
                    auth.user.email || "founder")
          : null;
    if (!result) return NextResponse.json({ error: "Unknown debate operation" }, { status: 400 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update debate production" },
      { status: 400 },
    );
  }
}
