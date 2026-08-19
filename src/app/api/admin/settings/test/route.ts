import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getSetting } from "@/lib/admin/settings";
import { rateLimit } from "@/lib/rate-limit";
import { openRouterChat } from "@/lib/ai/openrouter";

const TEST_LIMIT = 10;
const TEST_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  // Don't expose API-key probing in production.
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const adminKey = auth.user.email ?? auth.user.id;
  const { success } = rateLimit(`admin-settings-test:${adminKey}`, TEST_LIMIT, TEST_WINDOW_MS);
  if (!success) {
    return NextResponse.json(
      { success: false, error: "Rate limit reached. Try again later." },
      { status: 429 },
    );
  }

  const { key } = await request.json();

  if (key === "RESEND_API_KEY") {
    try {
      const apiKey = await getSetting("RESEND_API_KEY");
      if (!apiKey) {
        return NextResponse.json({ success: false, error: "API key not set" });
      }
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: false, error: "Invalid API key" });
    } catch {
      return NextResponse.json({ success: false, error: "Connection failed" });
    }
  }

  if (key === "OPENROUTER_API_KEY") {
    try {
      if (!process.env.OPENROUTER_API_KEY) {
        return NextResponse.json({ success: false, error: "API key not set" });
      }
      await openRouterChat({ maxTokens: 5, temperature: 0, messages: [{ role: "user", content: "Reply with OK." }] });
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ success: false, error: "Invalid API key or connection failed" });
    }
  }

  return NextResponse.json({ success: false, error: "Test not available for this key" });
}
