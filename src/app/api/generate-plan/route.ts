import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";
import { PLAN_SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompts";
import { rateLimit } from "@/lib/rate-limit";
import type { IntakeFormData, DigitalGrowthPlan } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPlanEmail as sendPlanEmailNotification } from "@/lib/email/send";
import { scheduleEmailSequence } from "@/lib/email/sequences";

function validateIntakeData(data: Partial<IntakeFormData>): data is IntakeFormData {
  return !!(
    data.industry &&
    data.contactName &&
    data.contactEmail &&
    data.consentGiven
  );
}

async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  try {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(ip, 5, 60 * 60 * 1000);
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { formData, utm } = body as { formData: Partial<IntakeFormData>; utm?: { utm_source?: string; utm_medium?: string; utm_campaign?: string } };

    if (!validateIntakeData(formData)) {
      return NextResponse.json(
        { error: "Missing required fields. Please complete all required steps." },
        { status: 400 }
      );
    }

    const shareToken = nanoid(10);
    const supabase = await getSupabaseClient();

    // Save initial record
    if (supabase) {
      try {
        await supabase.from("solution_requests").insert({
          share_token: shareToken,
          status: "generating",
          industry: formData.industry,
          industry_other: formData.industryOther || null,
          business_name: formData.businessName || null,
          contact_name: formData.contactName,
          contact_email: formData.contactEmail,
          contact_phone: formData.contactPhone || null,
          intake_data: formData,
          utm_source: utm?.utm_source || null,
          utm_medium: utm?.utm_medium || null,
          utm_campaign: utm?.utm_campaign || null,
        });

        // Create admin notification (fire and forget)
        Promise.resolve(supabase.from("admin_notifications").insert({
          type: "new_lead",
          title: `New lead: ${formData.contactName}`,
          description: `${formData.industry?.replace(/_/g, " ")}: ${formData.businessName || "No business name"}`,
          link: "/admin/leads",
        })).catch(() => {});
      } catch (e) {
        console.warn("Supabase insert failed:", e);
      }
    }

    // Call Claude API (or fallback)
    if (!process.env.ANTHROPIC_API_KEY) {
      const fallbackPlan = generateFallbackPlan(formData);
      await savePlan(supabase, shareToken, fallbackPlan, "fallback");
      return NextResponse.json({ plan: fallbackPlan, shareToken });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const userPrompt = buildUserPrompt(formData);
    const modelUsed = "claude-sonnet-4-20250514";

    let plan: DigitalGrowthPlan;

    try {
      plan = await callClaude(anthropic, modelUsed, userPrompt);
    } catch (firstError) {
      console.error("First Claude call failed, retrying:", firstError);
      try {
        plan = await callClaude(anthropic, modelUsed, userPrompt);
      } catch (retryError) {
        console.error("Retry also failed:", retryError);
        if (supabase) {
          try {
            await supabase
              .from("solution_requests")
              .update({ status: "failed", updated_at: new Date().toISOString() })
              .eq("share_token", shareToken);
          } catch {
            // non-critical
          }
        }
        const fallbackPlan = generateFallbackPlan(formData);
        await savePlan(supabase, shareToken, fallbackPlan, "fallback");
        return NextResponse.json({ plan: fallbackPlan, shareToken });
      }
    }

    await savePlan(supabase, shareToken, plan, modelUsed);

    // Send confirmation email (fire and forget)
    sendPlanEmailNotification(
      formData.contactName,
      formData.contactEmail,
      plan.executiveSummary,
      shareToken
    ).catch((e) => console.warn("Plan email failed:", e));

    // Schedule plan_nurture drip sequence via Resend
    scheduleEmailSequence({
      email: formData.contactEmail,
      sequenceType: "plan_nurture",
      metadata: {
        name: formData.contactName,
        industry: formData.industry,
        planLink: `https://acceleratewith.us/plan/${shareToken}`,
        planSummary: plan.executiveSummary,
      },
    }).catch((e) => console.warn("Plan nurture sequence failed:", e));

    return NextResponse.json({ plan, shareToken });
  } catch (error) {
    console.error("Generate plan error:", error);
    return NextResponse.json(
      { error: "Failed to generate your growth plan. Please try again or book a call with us." },
      { status: 500 }
    );
  }
}

async function callClaude(
  anthropic: Anthropic,
  model: string,
  userPrompt: string
): Promise<DigitalGrowthPlan> {
  const message = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    temperature: 0.7,
    system: PLAN_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textContent = message.content.find((c) => c.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return JSON.parse(textContent.text) as DigitalGrowthPlan;
}

async function savePlan(
  supabase: SupabaseClient | null,
  shareToken: string,
  plan: DigitalGrowthPlan,
  modelUsed: string
) {
  if (!supabase) return;
  try {
    await supabase
      .from("solution_requests")
      .update({
        status: "completed",
        ai_plan: plan,
        ai_model_used: modelUsed,
        estimated_value: plan.investmentSummary.totalOneTime + plan.investmentSummary.totalMonthly * 12,
        updated_at: new Date().toISOString(),
      })
      .eq("share_token", shareToken);
  } catch (e) {
    console.warn("Failed to save plan to Supabase:", e);
  }
}

function generateFallbackPlan(data: IntakeFormData): DigitalGrowthPlan {
  const industry = data.industry;
  const isHomeServices = industry === "home_services";
  const isLawFirm = industry === "law_firm";
  const isRealEstate = industry === "real_estate";

  const websiteRec = {
    name: "AI-Powered Website Redesign",
    description: `A fast, SEO-optimized website built to convert visitors into clients for your ${formatIndustry(industry)} business. Mobile-first design with built-in inquiry capture forms and local SEO.`,
    whyItMatters: "Your website is the foundation of your digital presence. Without a site that ranks and converts, every other investment works harder than it should.",
    features: [
      "Mobile-responsive, fast-loading design",
      "SEO-optimized for local search terms",
      "Built-in inquiry capture forms and CTAs",
      "Google Analytics and conversion tracking",
      isHomeServices ? "Service area pages for each location you serve" : "Professional service pages showcasing your expertise",
    ],
    estimatedImpact: "Expect 25-40% increase in organic client acquisition within 90 days.",
    timeline: "2-3 weeks",
    pricingOneTime: 3500,
    pricingMonthly: undefined as number | undefined,
    pricingDisplay: "$3,500 one-time",
    priority: 1,
  };

  const automationRec = {
    name: isLawFirm ? "AI Client Intake System" : "Automated Prospect Follow-Up",
    description: isLawFirm
      ? "An AI-powered intake system that qualifies potential clients 24/7, asks the right questions, and books consultations automatically."
      : "Automated email and SMS sequences that follow up with every inquiry within minutes, not days. Keeps prospects engaged until they are ready to buy.",
    whyItMatters: isLawFirm
      ? "35% of law firm calls go unanswered. Every missed call could be a case worth thousands. This system ensures no inquiry falls through the cracks."
      : "80% of deals go to whoever responds first. Automated follow-up ensures you are always first, even when you are on a job site.",
    features: [
      "Instant response to new inquiries (under 2 minutes)",
      "Multi-step nurture sequences via email and SMS",
      "CRM integration for inquiry tracking",
      isHomeServices ? "Automated appointment scheduling for estimates" : "Smart qualification to prioritize high-value prospects",
      "Performance dashboard with conversion metrics",
    ],
    estimatedImpact: "Response time drops from hours to minutes. Expect 20-30% improvement in inquiry-to-customer conversion.",
    timeline: "1-2 weeks",
    pricingOneTime: 1500,
    pricingMonthly: 400,
    pricingDisplay: "$1,500 setup + $400/month",
    priority: 2,
  };

  const agentRec = {
    name: isRealEstate ? "AI Lead Response Agent" : "AI Phone & Chat Agent",
    description: isRealEstate
      ? "An AI agent that responds to ad leads instantly, qualifies buyers based on criteria you set, and keeps them engaged with personalized follow-up."
      : "An AI-powered agent that answers your phone and website chat 24/7. Books appointments, answers common questions, and captures lead information.",
    whyItMatters: "You cannot be available 24/7, but your customers expect instant responses. This agent handles the first touchpoint so you never miss an opportunity.",
    features: [
      "24/7 availability for calls and web chat",
      "Natural conversation that represents your brand",
      "Appointment booking with calendar integration",
      "Lead qualification and data capture",
      "Call transcripts and chat logs for review",
    ],
    estimatedImpact: "Capture 40-60% of after-hours inquiries that currently go unanswered.",
    timeline: "1-2 weeks",
    pricingOneTime: 1500,
    pricingMonthly: 350,
    pricingDisplay: "$1,500 setup + $350/month",
    priority: 3,
  };

  const recommendations = [websiteRec, automationRec, agentRec];
  const totalOneTime = recommendations.reduce((sum, r) => sum + (r.pricingOneTime || 0), 0);
  const totalMonthly = recommendations.reduce((sum, r) => sum + (r.pricingMonthly || 0), 0);

  return {
    executiveSummary: `Based on your intake, your ${formatIndustry(industry)} business has strong growth potential that is being held back by gaps in your digital presence and lead management. The biggest immediate opportunity is capturing the leads you are currently missing through faster response times and a website that actually converts visitors into customers.`,
    recommendations,
    implementationRoadmap: [
      {
        phase: 1,
        name: "Foundation",
        description: "Launch your new website and set up core lead capture. This gives you an immediate uplift in online visibility and conversion.",
        duration: "2-3 weeks",
        solutions: ["AI-Powered Website Redesign"],
      },
      {
        phase: 2,
        name: "Automation",
        description: "Deploy automated follow-up sequences and CRM integration. Every lead gets a response within minutes.",
        duration: "1-2 weeks",
        solutions: [isLawFirm ? "AI Client Intake System" : "Automated Lead Follow-Up"],
      },
      {
        phase: 3,
        name: "Intelligence",
        description: "Activate 24/7 AI agent for phone and chat. Full coverage, no missed opportunities.",
        duration: "1-2 weeks",
        solutions: [isRealEstate ? "AI Lead Response Agent" : "AI Phone & Chat Agent"],
      },
    ],
    roiProjection: {
      ninetyDay: {
        estimatedLeadIncrease: "25-40%",
        estimatedTimeSaved: "8-12 hours per week",
        estimatedRevenueImpact: "$3,000-8,000 additional monthly revenue",
      },
      twelveMonth: {
        estimatedLeadIncrease: "50-80%",
        estimatedTimeSaved: "15-20 hours per week",
        estimatedRevenueImpact: "$8,000-20,000 additional monthly revenue",
      },
      disclaimer: "Projections are based on industry averages from similar implementations. Individual results vary based on market conditions, execution, and existing business fundamentals.",
    },
    investmentSummary: {
      oneTimeCosts: recommendations
        .filter((r) => r.pricingOneTime)
        .map((r) => ({ item: r.name, amount: r.pricingOneTime! })),
      monthlyCosts: recommendations
        .filter((r) => r.pricingMonthly)
        .map((r) => ({ item: r.name, amount: r.pricingMonthly! })),
      totalOneTime,
      totalMonthly,
      budgetNotes: data.budgetRange === "under_2500"
        ? "Your stated budget of under $2,500 covers the website redesign. We recommend starting there and phasing in automation and AI agents as revenue grows."
        : undefined,
    },
    nextSteps: [
      "Book a free 30-minute consultation to review this plan together.",
      "We will refine the proposal based on our conversation.",
      "If it is a fit, we start building within a week.",
    ],
  };
}

function formatIndustry(industry: string): string {
  const map: Record<string, string> = {
    home_services: "home services",
    law_firm: "law firm",
    professional_services: "professional services",
    real_estate: "real estate",
    other: "business",
  };
  return map[industry] || industry;
}
