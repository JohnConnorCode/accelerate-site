import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { getSetting } from "@/lib/admin/settings";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

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

  if (key === "ANTHROPIC_API_KEY") {
    try {
      const apiKey = await getSetting("ANTHROPIC_API_KEY");
      if (!apiKey) {
        return NextResponse.json({ success: false, error: "API key not set" });
      }
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hi" }],
      });
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ success: false, error: "Invalid API key or connection failed" });
    }
  }

  return NextResponse.json({ success: false, error: "Test not available for this key" });
}
