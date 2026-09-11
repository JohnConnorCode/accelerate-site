import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  listLearningProposals,
  proposeLearning,
  LEARNING_PROPOSAL_TYPES,
  type LearningConfidence,
  type LearningProposalType,
} from "@/lib/revenue-os/learning-inbox";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const rawStatus = new URL(request.url).searchParams.get("status");
  const status =
    rawStatus === null
      ? undefined
      : (
          ["proposed", "approved", "rejected", "conversation_only", "ignored"] as const
        ).includes(rawStatus as never)
        ? (rawStatus as "proposed")
        : "invalid";
  if (status === "invalid") {
    return NextResponse.json({ error: "Unknown status filter" }, { status: 400 });
  }
  try {
    const proposals = await listLearningProposals(auth.database, {
      status,
      limit: 50,
    });
    return NextResponse.json({ proposals });
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
    console.warn("Learning API received a malformed JSON body");
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { type, rule } = body as { type?: unknown; rule?: unknown };
  if (
    typeof type !== "string" ||
    !(LEARNING_PROPOSAL_TYPES as readonly string[]).includes(type) ||
    typeof rule !== "string" ||
    !rule.trim()
  ) {
    return NextResponse.json({ error: "type and non-empty rule are required" }, { status: 400 });
  }
  if (
    body.supersedesPolicyId !== undefined &&
    body.supersedesPolicyId !== null &&
    typeof body.supersedesPolicyId !== "string"
  ) {
    return NextResponse.json({ error: "supersedesPolicyId must be a UUID string" }, { status: 400 });
  }

  try {
    const proposal = await proposeLearning(auth.database, {
      type: type as LearningProposalType,
      rule,
      rationale: typeof body.rationale === "string" ? body.rationale : "",
      scope:
        body.scope && typeof body.scope === "object"
          ? (body.scope as Record<string, unknown>)
          : null,
      confidence: (body.confidence as LearningConfidence) ?? undefined,
      conflicts:
        body.conflicts && typeof body.conflicts === "object"
          ? (body.conflicts as Record<string, unknown>)
          : null,
      affectedWorkers: Array.isArray(body.affectedWorkers)
        ? body.affectedWorkers.filter((w): w is string => typeof w === "string")
        : [],
      supersedesPolicyId:
        typeof body.supersedesPolicyId === "string" ? body.supersedesPolicyId : null,
      sourceRefs:
        body.sourceRefs && typeof body.sourceRefs === "object"
          ? (body.sourceRefs as Record<string, unknown>)
          : null,
      actorEmail: auth.user.email,
    });
    return NextResponse.json({ proposal });
  } catch (error) {
    const message = (error as Error).message;
    if (/Unknown proposal type|must not be empty|Unknown confidence|must be a valid UUID/.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Database error:", message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }
}
