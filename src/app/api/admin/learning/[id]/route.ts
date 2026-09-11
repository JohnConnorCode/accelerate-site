import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  rejectLearningProposal,
  requestLearningApproval,
  setLearningDisposition,
  LEARNING_STATUSES,
  type LearningStatus,
} from "@/lib/revenue-os/learning-inbox";

const DISPOSITIONS: LearningStatus[] = ["proposed", "rejected", "conversation_only", "ignored"];

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    console.warn("Learning API received a malformed JSON body");
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action } = body as { action?: unknown };
  if (action === "request-approval") {
    try {
      const approval = await requestLearningApproval(auth.database, {
        id,
        actorEmail: auth.user.email,
      });
      return NextResponse.json({ action: approval });
    } catch (error) {
      const message = (error as Error).message;
      const status = /not found/i.test(message) ? 404 : /only proposed/i.test(message) ? 409 : 500;
      if (status === 500) console.error("Database error:", message);
      return NextResponse.json({ error: message }, { status });
    }
  }

  if (action === "reject") {
    try {
      const proposal = await rejectLearningProposal(auth.database, {
        id,
        reason: typeof body.reason === "string" ? body.reason : undefined,
        actorEmail: auth.user.email,
      });
      return NextResponse.json({ proposal });
    } catch (error) {
      const message = (error as Error).message;
      const status = /not found/i.test(message) ? 404 : /not allowed/i.test(message) ? 409 : 500;
      if (status === 500) console.error("Database error:", message);
      return NextResponse.json({ error: message }, { status });
    }
  }

  const { disposition } = body as { disposition?: unknown };
  if (
    typeof disposition !== "string" ||
    !(LEARNING_STATUSES as readonly string[]).includes(disposition) ||
    !DISPOSITIONS.includes(disposition as LearningStatus)
  ) {
    return NextResponse.json(
      { error: "disposition must be one of proposed, rejected, conversation_only, ignored" },
      { status: 400 },
    );
  }

  try {
    const proposal = await setLearningDisposition(auth.database, {
      id,
      to: disposition as LearningStatus,
      actorEmail: auth.user.email,
    });
    return NextResponse.json({ proposal });
  } catch (error) {
    const message = (error as Error).message;
    const status = /not found/i.test(message) ? 404 : /not allowed/i.test(message) ? 409 : 500;
    if (status === 500) console.error("Database error:", message);
    return NextResponse.json({ error: message }, { status });
  }
}
