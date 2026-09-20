import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { loadReport } from "@/lib/ai-readiness-service";
import { createAIReadinessPdf } from "@/lib/ai-readiness-pdf";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`ai-readiness-pdf:${ip}`, 12, 60 * 60 * 1000).success)
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token || token.length < 20)
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  const report = await loadReport(token);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  const pdf = createAIReadinessPdf(report);
  return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="accelerate-ai-readiness-${token.slice(0, 8)}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
