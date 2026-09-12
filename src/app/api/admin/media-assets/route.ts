import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { readWorkspaceMedia } from "@/lib/revenue-os/media-assets";
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  try {
    const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
    const media = await readWorkspaceMedia(auth.database, id);
    return new Response(Uint8Array.from(media.bytes), {
      headers: {
        "Content-Type": media.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image unavailable" }, { status: 404 });
  }
}
