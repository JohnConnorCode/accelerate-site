import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import {
  ContentBriefConfigurationError,
  ContentBriefInputError,
  generateContentBrief,
} from "@/lib/revenue-os/content-brief";

export async function POST(request: NextRequest) {
  const auth = await requireAdminForModule("content");
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.warn("Invalid JSON request for content brief");
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  try {
    return NextResponse.json(await generateContentBrief(auth.database, body));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate brief";
    const status =
      error instanceof ContentBriefInputError || error instanceof ContentBriefConfigurationError
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
