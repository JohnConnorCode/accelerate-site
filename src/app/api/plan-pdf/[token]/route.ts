import { generatePlanHTML } from "@/lib/plan-document";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import type { DigitalGrowthPlan } from "@/lib/types";
import { createBootstrapServiceRoleClient } from "@/lib/supabase/server";

// PDF generation using a simple HTML-to-response approach
// @react-pdf/renderer has SSR compatibility issues with Next.js App Router,
// so we generate a clean HTML document that the browser can print to PDF
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(ip, 20, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { token } = await params;

  let plan: DigitalGrowthPlan | null = null;
  let businessName = "Your Business";
  let contactName = "Valued Prospect";

  // Try to load from Supabase
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createBootstrapServiceRoleClient("legacy-public-plan-pdf");

      const { data } = await supabase
        .from("solution_requests")
        .select("ai_plan, business_name, contact_name")
        .eq("share_token", token)
        .single();

      if (data) {
        plan = data.ai_plan;
        businessName = data.business_name || businessName;
        contactName = data.contact_name || contactName;
      }
    } catch (e) {
      console.warn("Supabase fetch failed:", e);
    }
  }

  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const html = generatePlanHTML(plan, businessName, contactName);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="growth-plan-${token}.html"`,
    },
  });
}
