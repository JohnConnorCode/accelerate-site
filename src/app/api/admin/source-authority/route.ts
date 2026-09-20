import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  listSourceAuthorities,
  registerSourceAuthority,
  SOURCE_AUTHORITY_TIERS,
  type SourceAuthorityTier,
} from "@/lib/revenue-os/source-authority";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const entries = await listSourceAuthorities(auth.database, { limit: 100 });
    return NextResponse.json({ entries });
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
    console.warn("Source authority API received a malformed JSON body");
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { systemKey, displayName, truthDomains, authorityTier, ownerEmail, lastVerifiedAt } = body;
  if (
    typeof systemKey !== "string" ||
    typeof displayName !== "string" ||
    !Array.isArray(truthDomains) ||
    typeof authorityTier !== "string" ||
    !(SOURCE_AUTHORITY_TIERS as readonly string[]).includes(authorityTier) ||
    typeof ownerEmail !== "string" ||
    typeof lastVerifiedAt !== "string"
  ) {
    return NextResponse.json(
      {
        error:
          "systemKey, displayName, truthDomains, authorityTier, ownerEmail and lastVerifiedAt are required",
      },
      { status: 400 },
    );
  }

  try {
    const entry = await registerSourceAuthority(auth.database, {
      systemKey,
      displayName,
      truthDomains: truthDomains.filter((domain): domain is string => typeof domain === "string"),
      authorityTier: authorityTier as SourceAuthorityTier,
      ownerEmail,
      lastVerifiedAt,
      verificationLapseDays:
        typeof body.verificationLapseDays === "number" ? body.verificationLapseDays : undefined,
      appliesTo:
        body.appliesTo && typeof body.appliesTo === "object"
          ? (body.appliesTo as { entityTypes?: string[]; coworkerIds?: string[] })
          : null,
      requestKey: typeof body.requestKey === "string" ? body.requestKey : undefined,
      actorEmail: auth.user.email,
    });
    return NextResponse.json({ entry });
  } catch (error) {
    const message = (error as Error).message;
    if (
      /must be a lowercase slug|must not be empty|Unknown authority tier|must be a valid email|must be an ISO date|must be an integer|already bound|does not match this request|appliesTo/.test(
        message,
      )
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Database error:", message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }
}
