import { NextRequest, NextResponse } from "next/server";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import { authenticateWorkAgent } from "@/lib/revenue-os/work-board";
import { handleWorkMcp } from "@/lib/revenue-os/work-board-mcp";
import { readWorkBody, workError } from "@/lib/revenue-os/work-board-http";
export async function POST(request: NextRequest) {
  try {
    const db = createPlatformServiceRoleClient("feature-board");
    const actor = await authenticateWorkAgent(
      db,
      request.headers.get("authorization")?.replace(/^Bearer /, "") ?? null,
    );
    const result = await handleWorkMcp(db, actor, await readWorkBody(request));
    return result === null ? new NextResponse(null, { status: 202 }) : NextResponse.json(result);
  } catch (error) {
    return workError(error);
  }
}
