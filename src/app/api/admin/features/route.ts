import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import {
  listWorkBoard,
  mutateWorkBoard,
  workHistory,
  type WorkActor,
} from "@/lib/revenue-os/work-board";
import { readWorkBody, workError } from "@/lib/revenue-os/work-board-http";

export async function GET(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;
  const actor: WorkActor = { id: auth.user.email!, projects: ["*"], scopes: ["*"], reviewer: true };
  const db = createPlatformServiceRoleClient("feature-board");
  try {
    const params = request.nextUrl.searchParams;
    if (params.get("history"))
      return NextResponse.json({ events: await workHistory(db, actor, params.get("history")!) });
    return NextResponse.json(
      await listWorkBoard(db, actor, { offset: Number(params.get("offset") || 0), limit: 500 }),
    );
  } catch (error) {
    return workError(error);
  }
}
export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(
      await mutateWorkBoard(
        createPlatformServiceRoleClient("feature-board"),
        { id: auth.user.email!, projects: ["*"], scopes: ["*"], reviewer: true },
        await readWorkBody(request),
      ),
    );
  } catch (error) {
    return workError(error);
  }
}
// Old clients fail closed instead of silently skipping claim or revision checks.
export const PATCH = POST;
export const DELETE = POST;
