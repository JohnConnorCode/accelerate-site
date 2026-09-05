import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  listIdentityReviewItems,
  resolveIdentityReview,
  type IdentityReviewDecision,
} from "@/lib/revenue-os/identity-review";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const params = new URL(request.url).searchParams;
  const limit = Number(params.get("limit") || "50");

  try {
    const result = await listIdentityReviewItems(auth.database, {
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load identity reviews" },
      { status: 500 },
    );
  }
}

const DECISIONS: IdentityReviewDecision[] = ["link", "create", "no_match", "defer"];

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as {
    actionId?: string;
    decision?: IdentityReviewDecision;
    contactId?: string | null;
    companyId?: string | null;
    fullName?: string | null;
    phone?: string | null;
    companyName?: string | null;
  };

  if (!body.actionId?.trim()) {
    return NextResponse.json({ error: "Action id is required" }, { status: 400 });
  }
  if (!body.decision || !DECISIONS.includes(body.decision)) {
    return NextResponse.json(
      { error: "Decision must be one of link, create, no_match, defer" },
      { status: 400 },
    );
  }

  try {
    const result = await resolveIdentityReview(auth.database, {
      actionId: body.actionId,
      decision: body.decision,
      contactId: body.contactId,
      companyId: body.companyId,
      fullName: body.fullName,
      phone: body.phone,
      companyName: body.companyName,
      actorEmail: auth.user.email || "founder@revenue-os.local",
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Resolution failed" },
      { status: 400 },
    );
  }
}
