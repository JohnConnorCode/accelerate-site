import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { createPlatformServiceRoleClient } from "@/lib/supabase/server";
import { readWorkBody, workError } from "@/lib/revenue-os/work-board-http";
import { saveWorkView, deleteWorkView } from "@/lib/revenue-os/work-board";
import { z } from "zod";
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await createPlatformServiceRoleClient("feature-board")
    .from("work_board_views")
    .select("*")
    .or(`shared.eq.true,owner.eq.${auth.user.id}`)
    .order("name")
    .limit(100);
  if (error) return workError(error);
  return NextResponse.json({ views: data });
}
export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    return NextResponse.json(
      await saveWorkView(
        createPlatformServiceRoleClient("feature-board"),
        auth.user.id,
        await readWorkBody(request),
      ),
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
    await deleteWorkView(createPlatformServiceRoleClient("feature-board"), auth.user.id, id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return workError(error);
  }
}
