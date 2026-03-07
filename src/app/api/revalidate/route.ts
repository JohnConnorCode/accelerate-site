import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (token !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const slug = body.slug as string | undefined;

  const revalidated: string[] = [];

  if (slug) {
    revalidatePath(`/learn/${slug}`);
    revalidated.push(`/learn/${slug}`);
  }

  // Always revalidate listing pages so new articles appear
  revalidatePath("/learn");
  revalidatePath("/sitemap.xml");
  revalidatePath("/learn/feed.xml");
  revalidated.push("/learn", "/sitemap.xml", "/learn/feed.xml");

  return NextResponse.json({ revalidated, timestamp: new Date().toISOString() });
}
