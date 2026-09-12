import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { listDecisions, recordDecision } from "@/lib/revenue-os/decision-memory";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const decisions = await listDecisions(auth.database, {});
    return NextResponse.json({ decisions });
  } catch (error) {
    console.error("Database error:", (error as Error).message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    console.warn("Decision API received a malformed JSON body");
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, decision } = body as { title?: unknown; decision?: unknown };
  if (
    typeof title !== "string" ||
    !title.trim() ||
    typeof decision !== "string" ||
    !decision.trim()
  ) {
    return NextResponse.json({ error: "title and decision are required" }, { status: 400 });
  }
  if (
    body.supersedesId !== undefined &&
    body.supersedesId !== null &&
    typeof body.supersedesId !== "string"
  ) {
    return NextResponse.json({ error: "supersedesId must be a UUID string" }, { status: 400 });
  }

  try {
    const record = await recordDecision(auth.database, {
      title,
      decision,
      why: typeof body.why === "string" ? body.why : "",
      ownerEmail: typeof body.ownerEmail === "string" ? body.ownerEmail : null,
      evidence:
        body.evidence && typeof body.evidence === "object"
          ? (body.evidence as Record<string, unknown>)
          : null,
      supersedesId: typeof body.supersedesId === "string" ? body.supersedesId : null,
      implications:
        body.implications && typeof body.implications === "object"
          ? (body.implications as Record<string, unknown>)
          : null,
      actorEmail: auth.user.email,
    });
    return NextResponse.json({ decision: record });
  } catch (error) {
    const message = (error as Error).message;
    if (/must not be empty|must be a valid UUID|not found|already superseded/.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Database error:", message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }
}
