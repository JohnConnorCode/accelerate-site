import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/validation";
import { sendRoiReportEmail } from "@/lib/email/send";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(`roi-report:${ip}`, 5, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { email, name, inputs, result, utm } = await request.json();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    if (!inputs || !result) {
      return NextResponse.json(
        { error: "Missing calculator data." },
        { status: 400 }
      );
    }

    // Database-first: save before sending email
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      await supabase.from("roi_calculations").insert({
        email: email.trim(),
        industry: inputs.industry || null,
        inputs,
        results: result,
        utm_source: utm?.utm_source || null,
        utm_medium: utm?.utm_medium || null,
        utm_campaign: utm?.utm_campaign || null,
      });

      // Fire-and-forget admin notification
      supabase.from("admin_notifications").insert({
        type: "roi_report",
        title: `ROI report requested: ${name || email}`,
        description: `${inputs.industry?.replace(/_/g, " ")} — ${Math.round(result.roiPercentage)}% projected ROI`,
        link: "/admin/leads",
      }).then(() => {}, () => {});
    }

    // Format currency values for email template
    const fmt = (v: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(v || 0);

    // Send email (non-blocking — DB save already succeeded)
    try {
      await sendRoiReportEmail(email.trim(), {
        name: name || undefined,
        roiPercentage: result.roiPercentage || 0,
        additionalMonthlyRevenue: fmt(result.additionalMonthlyRevenue),
        annualRevenueImpact: fmt(result.annualRevenueImpact),
        timeSavedPerWeek: (result.timeSavedPerWeek || 0).toFixed(1),
        paybackPeriodMonths: (result.paybackPeriodMonths || 0).toFixed(1),
      });
    } catch (emailErr) {
      console.error("ROI email send failed (submission still saved):", emailErr);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to save report. Please try again." },
      { status: 500 }
    );
  }
}
