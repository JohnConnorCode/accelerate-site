import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  listSourceAuthorities,
  prepareSourceAuthorityCommand,
  registerSourceAuthority,
  SourceAuthorityCommandError,
} from "@/lib/revenue-os/source-authority";
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json({
      entries: await listSourceAuthorities(auth.database),
      tenantId: auth.tenant.id,
    });
  } catch {
    console.warn("Source authority list unavailable");
    return NextResponse.json(
      { error: "Sources could not be loaded. Retry before treating this list as current." },
      { status: 503 },
    );
  }
}
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const command = prepareSourceAuthorityCommand(body);
    const receipt = await registerSourceAuthority(auth.database, {
      ...command,
      actorEmail: auth.user.email,
    });
    return NextResponse.json(receipt);
  } catch (error) {
    if (error instanceof SyntaxError)
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    if (error instanceof SourceAuthorityCommandError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: "Save is unconfirmed. Keep this form and retry the same request." },
      { status: 503 },
    );
  }
}
