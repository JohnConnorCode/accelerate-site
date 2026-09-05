import { NextRequest, NextResponse } from "next/server";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import {
  authenticateWorkAgent,
  listWorkBoard,
  mutateWorkBoard,
  workHistory,
} from "@/lib/revenue-os/work-board";
import { readWorkBody, workError } from "@/lib/revenue-os/work-board-http";
export async function GET(request: NextRequest) {
  const db = createPlatformServiceRoleClient("feature-board");
  try {
    const actor = await authenticateWorkAgent(
      db,
      request.headers.get("authorization")?.replace(/^Bearer /, "") ?? null,
    );
    const p = request.nextUrl.searchParams;
    if (p.get("history"))
      return NextResponse.json({ events: await workHistory(db, actor, p.get("history")!) });
    return NextResponse.json(
      await listWorkBoard(db, actor, {
        offset: Number(p.get("offset") || 0),
        limit: Number(p.get("limit") || 100),
        id: p.get("id") ?? undefined,
        seedKey: p.get("key") ?? undefined,
      }),
    );
  } catch (error) {
    return workError(error);
  }
}
export async function POST(request: NextRequest) {
  const db = createPlatformServiceRoleClient("feature-board");
  try {
    const actor = await authenticateWorkAgent(
      db,
      request.headers.get("authorization")?.replace(/^Bearer /, "") ?? null,
    );
    return NextResponse.json(await mutateWorkBoard(db, actor, await readWorkBody(request)));
  } catch (error) {
    return workError(error);
  }
}
