import { NextRequest, NextResponse } from "next/server";
import { unsubscribe } from "@/lib/revenue-os/public-unsubscribe";

export async function POST(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  return unsubscribe(context);
}
export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  await unsubscribe(context);
  return new NextResponse(
    "You have been unsubscribed from campaign email. You may close this page.",
    { headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}
