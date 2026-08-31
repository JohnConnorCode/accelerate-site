import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  captureFounderNote,
  FOUNDER_NOTE_CAPTURE_SOURCES,
  FOUNDER_NOTE_KNOWLEDGE_CONTRACT,
  loadFounderKnowledgeNotes,
  type FounderNoteCaptureSource,
} from "@/lib/revenue-os/notes";
import { isMissingRevenueSchema } from "@/lib/revenue-os/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const params = new URL(request.url).searchParams;
  const ids = {
    contactId: params.get("contactId")?.trim() || undefined,
    companyId: params.get("companyId")?.trim() || undefined,
    opportunityId: params.get("opportunityId")?.trim() || undefined,
  };
  for (const [label, value] of Object.entries(ids)) {
    if (value && !UUID.test(value)) return NextResponse.json({ error: `${label} must be a valid canonical ID` }, { status: 400 });
  }
  const requestedLimit = Number(params.get("limit") || 25);
  try {
    const notes = await loadFounderKnowledgeNotes(auth.database, {
      ...ids,
      before: params.get("before")?.trim() || undefined,
      limit: Number.isFinite(requestedLimit) ? requestedLimit : 25,
    });
    return NextResponse.json({
      contract: FOUNDER_NOTE_KNOWLEDGE_CONTRACT,
      notes,
      nextCursor: notes.at(-1)?.occurredAt ?? null,
    });
  } catch (error) {
    if (isMissingRevenueSchema(error)) return NextResponse.json({ error: "Revenue OS schema is not ready" }, { status: 503 });
    const message = error instanceof Error ? error.message : "Founder notes could not be loaded";
    return NextResponse.json({ error: /invalid/i.test(message) ? message : "Founder notes could not be loaded" }, { status: /invalid/i.test(message) ? 400 : 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const note = typeof body.note === "string" ? body.note : "";
  const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim() : null;
  const contactId = typeof body.contactId === "string" ? body.contactId : null;
  const companyId = typeof body.companyId === "string" ? body.companyId : null;
  const opportunityId = typeof body.opportunityId === "string" ? body.opportunityId : null;
  if (body.captureDurationMs !== undefined && typeof body.captureDurationMs !== "number") return NextResponse.json({ error: "captureDurationMs must be a number" }, { status: 400 });
  if (body.captureSource !== undefined && typeof body.captureSource !== "string") return NextResponse.json({ error: "captureSource must be a string" }, { status: 400 });
  const captureDurationMs = typeof body.captureDurationMs === "number" ? body.captureDurationMs : null;
  const captureSource = typeof body.captureSource === "string" ? body.captureSource : "unknown";

  if (!UUID.test(requestId)) return NextResponse.json({ error: "A valid request ID is required" }, { status: 400 });
  for (const [label, value] of [["contactId", contactId], ["companyId", companyId], ["opportunityId", opportunityId]] as const) {
    if (value && !UUID.test(value)) return NextResponse.json({ error: `${label} must be a valid canonical ID` }, { status: 400 });
  }
  if (!FOUNDER_NOTE_CAPTURE_SOURCES.includes(captureSource as FounderNoteCaptureSource)) return NextResponse.json({ error: "captureSource is not recognized" }, { status: 400 });

  try {
    const receipt = await captureFounderNote(auth.database, {
      requestId,
      body: note,
      actorEmail: auth.user.email ?? "founder",
      contactEmail,
      contactId,
      companyId,
      opportunityId,
      captureDurationMs,
      captureSource: captureSource as FounderNoteCaptureSource,
    });
    return NextResponse.json({ success: true, receipt });
  } catch (error) {
    if (isMissingRevenueSchema(error)) return NextResponse.json({ error: "Revenue OS schema is not ready" }, { status: 503 });
    const message = error instanceof Error ? error.message : "The note could not be saved";
    const status = /required|limited|write something|does not match|no canonical|no longer exists|capture duration|capture source/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: status === 400 ? message : "The note could not be saved" }, { status });
  }
}
