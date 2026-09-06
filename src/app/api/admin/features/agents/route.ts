import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import { issueWorkAgent, revokeWorkAgent } from "@/lib/revenue-os/work-board";
import { readWorkBody, workError } from "@/lib/revenue-os/work-board-http";
import { z } from "zod";
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await createPlatformServiceRoleClient("feature-board")
    .from("work_board_agents")
    .select("id,name,projects,scopes,expires_at,revoked_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return workError(error);
  return NextResponse.json({ agents: data });
}
export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(
      await issueWorkAgent(
        createPlatformServiceRoleClient("feature-board"),
        await readWorkBody(request),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return workError(error);
  }
}
export async function DELETE(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = z
      .object({ id: z.string().uuid() })
      .strict()
      .parse(await readWorkBody(request));
    await revokeWorkAgent(createPlatformServiceRoleClient("feature-board"), id);
    return NextResponse.json({ revoked: true });
  } catch (error) {
    return workError(error);
  }
}
