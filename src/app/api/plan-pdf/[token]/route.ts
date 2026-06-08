import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import type { DigitalGrowthPlan } from "@/lib/types";

// PDF generation using a simple HTML-to-response approach
// @react-pdf/renderer has SSR compatibility issues with Next.js App Router,
// so we generate a clean HTML document that the browser can print to PDF
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
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
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

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
      "Content-Disposition": `inline; filename="accelerate-growth-plan-${token}.html"`,
    },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generatePlanHTML(
  plan: DigitalGrowthPlan,
  businessName: string,
  contactName: string
): string {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount);

  const safeBusiness = escapeHtml(businessName);
  const safeContact = escapeHtml(contactName);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Digital Growth Plan - ${safeBusiness} | Accelerate</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', sans-serif;
      color: #1a1a1a;
      line-height: 1.6;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 3px solid #D4AF37;
    }

    .logo { font-size: 28px; font-weight: 700; color: #D4AF37; margin-bottom: 4px; }
    .subtitle { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 2px; }

    .plan-for {
      text-align: center;
      margin-bottom: 40px;
    }
    .plan-for h1 { font-size: 24px; color: #1a1a1a; margin-bottom: 4px; }
    .plan-for p { font-size: 14px; color: #666; }

    .section { margin-bottom: 32px; }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #D4AF37;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #eee;
    }

    .summary { font-size: 16px; color: #333; line-height: 1.7; }

    .solution {
      background: #f9f9f7;
      border-left: 3px solid #D4AF37;
      padding: 16px 20px;
      margin-bottom: 16px;
      border-radius: 0 8px 8px 0;
    }
    .solution h3 { font-size: 16px; color: #1a1a1a; margin-bottom: 8px; }
    .solution p { font-size: 14px; color: #444; margin-bottom: 8px; }
    .solution .features { padding-left: 20px; }
    .solution .features li { font-size: 13px; color: #555; margin-bottom: 4px; }
    .solution .meta { display: flex; gap: 24px; margin-top: 8px; font-size: 13px; color: #666; }
    .solution .meta strong { color: #D4AF37; }

    .roadmap-phase {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      align-items: flex-start;
    }
    .phase-num {
      width: 32px;
      height: 32px;
      background: #D4AF37;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      flex-shrink: 0;
    }
    .phase-content h4 { font-size: 15px; color: #1a1a1a; margin-bottom: 4px; }
    .phase-content p { font-size: 13px; color: #555; }

    .roi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .roi-col { background: #f9f9f7; padding: 16px; border-radius: 8px; }
    .roi-col h4 { font-size: 14px; color: #D4AF37; margin-bottom: 8px; }
    .roi-col p { font-size: 13px; color: #444; margin-bottom: 4px; }
    .disclaimer { font-size: 11px; color: #999; font-style: italic; margin-top: 8px; }

    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 8px 12px; background: #f5f0e0; color: #333; font-weight: 600; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; }
    .total td { font-weight: 700; border-top: 2px solid #D4AF37; }

    .next-steps ol { padding-left: 20px; }
    .next-steps li { font-size: 14px; color: #333; margin-bottom: 8px; }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #D4AF37;
      text-align: center;
      font-size: 13px;
      color: #666;
    }
    .footer a { color: #D4AF37; text-decoration: none; }

    @media print {
      body { padding: 20px; }
      .solution { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Accelerate</div>
    <div class="subtitle">AI Strategy & Systems for Small Business</div>
  </div>

  <div class="plan-for">
    <h1>Digital Growth Plan</h1>
    <p>Prepared for ${safeContact} at ${safeBusiness}</p>
    <p style="font-size: 12px; color: #999; margin-top: 4px;">${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
  </div>

  <div class="section">
    <div class="section-title">Executive Summary</div>
    <p class="summary">${escapeHtml(plan.executiveSummary)}</p>
  </div>

  <div class="section">
    <div class="section-title">Recommended Solutions</div>
    ${plan.recommendations
      .sort((a, b) => a.priority - b.priority)
      .map(
        (rec) => `
      <div class="solution">
        <h3>${escapeHtml(rec.name)}</h3>
        <p>${escapeHtml(rec.description)}</p>
        <p><em>${escapeHtml(rec.whyItMatters)}</em></p>
        <ul class="features">${rec.features.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
        <div class="meta">
          <span>Impact: <strong>${escapeHtml(rec.estimatedImpact)}</strong></span>
          <span>Timeline: <strong>${escapeHtml(rec.timeline)}</strong></span>
          <span>Investment: <strong>${escapeHtml(rec.pricingDisplay)}</strong></span>
        </div>
      </div>
    `
      )
      .join("")}
  </div>

  <div class="section">
    <div class="section-title">Implementation Roadmap</div>
    ${plan.implementationRoadmap
      .map(
        (phase) => `
      <div class="roadmap-phase">
        <div class="phase-num">${phase.phase}</div>
        <div class="phase-content">
          <h4>${escapeHtml(phase.name)} (${escapeHtml(phase.duration)})</h4>
          <p>${escapeHtml(phase.description)}</p>
        </div>
      </div>
    `
      )
      .join("")}
  </div>

  <div class="section">
    <div class="section-title">ROI Projection</div>
    <div class="roi-grid">
      <div class="roi-col">
        <h4>90-Day Outlook</h4>
        <p>Inquiry Increase: ${escapeHtml(plan.roiProjection.ninetyDay.estimatedLeadIncrease)}</p>
        <p>Time Saved: ${escapeHtml(plan.roiProjection.ninetyDay.estimatedTimeSaved)}</p>
        <p>Revenue Impact: ${escapeHtml(plan.roiProjection.ninetyDay.estimatedRevenueImpact)}</p>
      </div>
      <div class="roi-col">
        <h4>12-Month Outlook</h4>
        <p>Inquiry Increase: ${escapeHtml(plan.roiProjection.twelveMonth.estimatedLeadIncrease)}</p>
        <p>Time Saved: ${escapeHtml(plan.roiProjection.twelveMonth.estimatedTimeSaved)}</p>
        <p>Revenue Impact: ${escapeHtml(plan.roiProjection.twelveMonth.estimatedRevenueImpact)}</p>
      </div>
    </div>
    <p class="disclaimer">${escapeHtml(plan.roiProjection.disclaimer)}</p>
  </div>

  <div class="section">
    <div class="section-title">Investment Summary</div>
    <table>
      <thead><tr><th>Item</th><th>One-Time</th><th>Monthly</th></tr></thead>
      <tbody>
        ${plan.recommendations
          .map(
            (rec) => `
          <tr>
            <td>${escapeHtml(rec.name)}</td>
            <td>${rec.pricingOneTime ? formatCurrency(rec.pricingOneTime) : "-"}</td>
            <td>${rec.pricingMonthly ? formatCurrency(rec.pricingMonthly) + "/mo" : "-"}</td>
          </tr>
        `
          )
          .join("")}
        <tr class="total">
          <td>Total</td>
          <td>${formatCurrency(plan.investmentSummary.totalOneTime)}</td>
          <td>${formatCurrency(plan.investmentSummary.totalMonthly)}/mo</td>
        </tr>
      </tbody>
    </table>
    ${plan.investmentSummary.budgetNotes ? `<p class="disclaimer" style="margin-top: 12px;">${escapeHtml(plan.investmentSummary.budgetNotes)}</p>` : ""}
  </div>

  <div class="section next-steps">
    <div class="section-title">Next Steps</div>
    <ol>${plan.nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
  </div>

  <div class="footer">
    <p><strong>Accelerate</strong> | AI Strategy & Systems for Small Business</p>
    <p><a href="https://www.acceleratewith.us">acceleratewith.us</a> | john@acceleratewith.us</p>
    <p style="margin-top: 8px; font-size: 11px; color: #999;">This plan was generated based on information you provided and is intended as a starting point for discussion. Final pricing and timelines are confirmed during consultation.</p>
  </div>
</body>
</html>`;
}
