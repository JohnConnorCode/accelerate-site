import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { loadReport, previewAssessment, unlockAssessment } from "@/lib/ai-readiness-service";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("preview"),
    sessionToken: z
      .string()
      .regex(/^[A-Za-z0-9_-]{32,96}$/)
      .optional(),
    answers: z.record(z.string(), z.string()),
    profile: z.record(z.string(), z.unknown()),
    attribution: z.record(z.string(), z.string()).optional(),
  }),
  z.object({
    action: z.literal("unlock"),
    sessionToken: z
      .string()
      .regex(/^[A-Za-z0-9_-]{32,96}$/)
      .optional(),
    answers: z.record(z.string(), z.string()),
    profile: z.record(z.string(), z.unknown()),
    contact: z.object({
      name: z.string().trim().min(1).max(160),
      email: z.string().trim().email().max(254),
      businessName: z.string().trim().min(1).max(160),
      consentGiven: z.literal(true),
      marketingConsent: z.boolean().default(false),
    }),
    attribution: z.record(z.string(), z.string()).optional(),
  }),
]);

function attribution(value: Record<string, string> | undefined) {
  return {
    utm_source: value?.utm_source,
    utm_medium: value?.utm_medium,
    utm_campaign: value?.utm_campaign,
    referrerHost: value?.referrerHost,
  };
}

export async function GET(request: NextRequest) {
  const reportToken = request.nextUrl.searchParams.get("token")?.trim();
  if (!reportToken || reportToken.length < 20)
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  const report = await loadReport(reportToken);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  return NextResponse.json({ report });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateLimitResult = await rateLimit(`ai-readiness:${ip}`, 30, 60 * 60 * 1000);
  if (!rateLimitResult.success)
    return rateLimitResponse(rateLimitResult, { error: "Too many requests" });
  let requestBody: unknown = null;
  try {
    requestBody = await request.json();
  } catch (error) {
    console.warn("[ai-readiness] rejected malformed JSON request", error);
  }
  const parsed = requestSchema.safeParse(requestBody);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Please check your answers and try again." },
      { status: 400 },
    );
  try {
    if (parsed.data.action === "preview") {
      const result = await previewAssessment({
        sessionToken: parsed.data.sessionToken,
        answers: parsed.data.answers,
        profile: parsed.data.profile,
        attribution: attribution(parsed.data.attribution),
      });
      return NextResponse.json({
        sessionToken: result.sessionToken,
        preview: result.preview,
        persisted: result.persisted,
      });
    }
    const result = await unlockAssessment({
      sessionToken: parsed.data.sessionToken,
      answers: parsed.data.answers,
      profile: parsed.data.profile,
      contact: parsed.data.contact,
      attribution: attribution(parsed.data.attribution),
    });
    return NextResponse.json({
      sessionToken: result.sessionToken,
      reportToken: result.reportToken,
      report: result.report,
      persisted: result.persisted,
    });
  } catch (error) {
    console.warn(
      "[ai-readiness] assessment request failed",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      {
        error:
          parsed.data.action === "preview"
            ? "Please complete the assessment fields and try again."
            : "We could not save your report. Please check the form and try again.",
      },
      { status: 422 },
    );
  }
}
