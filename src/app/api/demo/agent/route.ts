import { NextRequest, NextResponse } from "next/server";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { readBoundedJson } from "@/lib/ai/bounded-json";
import { runDemoAgent } from "@/lib/admin/demo/agent";
import { demoAgentRequestSchema } from "@/lib/admin/demo/agent-contract";
import {
  DEMO_SESSION_COOKIE,
  demoSession,
  withDemoInference,
} from "@/lib/admin/demo/agent-inference";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json({ error: "Use the demo from its own website" }, { status: 403 });
  const ip =
    process.env.VERCEL === "1"
      ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown"
      : "local";
  const gate = await rateLimit(`demo-agent:${ip}`, 5, 60000);
  if (!gate.success)
    return rateLimitResponse(gate, {
      error:
        gate.status === 503
          ? "The demo agent is temporarily unavailable. You can still explore the fictional workspace."
          : "The demo request limit has been reached. Please try again shortly.",
    });
  let session;
  try {
    const input = demoAgentRequestSchema.parse(
      await readBoundedJson(new Response(request.body), 64000),
    );
    session = demoSession(request.cookies.get(DEMO_SESSION_COOKIE)?.value);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(50000)]);
    const result = await withDemoInference(
      session.key,
      input.clientMessageId,
      (infer) => runDemoAgent(input, infer),
      signal,
    );
    const response = NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(DEMO_SESSION_COOKIE, session.cookie, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "strict",
      maxAge: 4 * 3600,
      path: "/api/demo/agent",
    });
    return response;
  } catch (issue) {
    const validation =
      issue instanceof SyntaxError || (issue instanceof Error && issue.name === "ZodError");
    const response = NextResponse.json(
      {
        error: validation
          ? "Invalid fictional demo request"
          : issue instanceof Error
            ? issue.message
            : "The demo agent is temporarily unavailable. You can still explore the workspace.",
      },
      { status: validation ? 400 : 503, headers: { "Cache-Control": "no-store" } },
    );
    if (session)
      response.cookies.set(DEMO_SESSION_COOKIE, session.cookie, {
        httpOnly: true,
        secure: request.nextUrl.protocol === "https:",
        sameSite: "strict",
        maxAge: 4 * 3600,
        path: "/api/demo/agent",
      });
    return response;
  }
}
