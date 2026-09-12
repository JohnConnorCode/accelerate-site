import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { listSources, registerSource, SOURCE_AUTHORITIES } from "@/lib/revenue-os/source-authority";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const sources = await listSources(auth.database);
    return NextResponse.json({ sources });
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
    console.warn("Source registry received a malformed JSON body");
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sourceKey, truthDomains } = body as { sourceKey?: unknown; truthDomains?: unknown };
  if (typeof sourceKey !== "string" || !sourceKey.trim()) {
    return NextResponse.json({ error: "sourceKey is required" }, { status: 400 });
  }
  if (
    !Array.isArray(truthDomains) ||
    truthDomains.length === 0 ||
    !truthDomains.every((d): d is string => typeof d === "string" && d.trim().length > 0)
  ) {
    return NextResponse.json(
      { error: "truthDomains must be a non-empty string array" },
      { status: 400 },
    );
  }
  const authority = body.authority;
  if (
    authority !== undefined &&
    (typeof authority !== "string" ||
      !(SOURCE_AUTHORITIES as readonly string[]).includes(authority))
  ) {
    return NextResponse.json({ error: "Unknown authority tier" }, { status: 400 });
  }

  try {
    const source = await registerSource(auth.database, {
      sourceKey,
      truthDomains: truthDomains as string[],
      authority: (authority as "working" | undefined) ?? undefined,
      ownerEmail: typeof body.ownerEmail === "string" ? body.ownerEmail : null,
      appliesTo:
        body.appliesTo && typeof body.appliesTo === "object"
          ? (body.appliesTo as Record<string, unknown>)
          : null,
      actorEmail: auth.user.email,
    });
    return NextResponse.json({ source });
  } catch (error) {
    const message = (error as Error).message;
    if (/must not be empty|required|Unknown authority/.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Database error:", message);
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 });
  }
}
