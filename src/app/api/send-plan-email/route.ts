import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/validation";
import { sendPlanEmail } from "@/lib/email/send";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(ip, 5, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { name, email, summary, shareToken } = await request.json();

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      typeof shareToken !== "string" ||
      !shareToken.trim()
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }

    await sendPlanEmail(name, email, summary || "Your custom growth plan", shareToken);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send plan email:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
