import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  ContentBriefConfigurationError,
  ContentBriefInputError,
  generateContentBrief,
} from "@/lib/revenue-os/content-brief";
import { isModuleEnabled } from "@/lib/revenue-os/modules";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  if (
    !isModuleEnabled("content", {
      modules: auth.tenant.config?.modules as Partial<Record<string, boolean>> | undefined,
    })
  ) {
    return NextResponse.json(
      { error: "Content Operations is disabled for this workspace" },
      { status: 403 },
    );
  }

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
