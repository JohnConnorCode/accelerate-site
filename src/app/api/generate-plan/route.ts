import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getOpenRouterModel, isOpenRouterConfigured, openRouterJson } from "@/lib/ai/openrouter";
import { PLAN_SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompts";
import { rateLimit } from "@/lib/rate-limit";
import type { IntakeFormData, DigitalGrowthPlan } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPlanEmail as sendPlanEmailNotification } from "@/lib/email/send";
import { scheduleEmailSequence } from "@/lib/email/sequences";

const stringArray = { type: "array", items: { type: "string", maxLength: 500 }, maxItems: 20 } as const;
const PLAN_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["executiveSummary", "recommendations", "implementationRoadmap", "roiProjection", "investmentSummary", "nextSteps"],
  properties: {
    executiveSummary: { type: "string", maxLength: 5000 },
    recommendations: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["name", "description", "whyItMatters", "features", "estimatedImpact", "timeline", "pricingOneTime", "pricingMonthly", "pricingDisplay", "priority"], properties: { name: { type: "string" }, description: { type: "string" }, whyItMatters: { type: "string" }, features: stringArray, estimatedImpact: { type: "string" }, timeline: { type: "string" }, pricingOneTime: { type: ["number", "null"], minimum: 0 }, pricingMonthly: { type: ["number", "null"], minimum: 0 }, pricingDisplay: { type: "string" }, priority: { type: "integer", minimum: 1, maximum: 20 } } } },
    implementationRoadmap: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["phase", "name", "description", "duration", "solutions"], properties: { phase: { type: "integer" }, name: { type: "string" }, description: { type: "string" }, duration: { type: "string" }, solutions: stringArray } } },
    roiProjection: { type: "object", additionalProperties: false, required: ["ninetyDay", "twelveMonth", "disclaimer"], properties: { ninetyDay: { type: "object", additionalProperties: false, required: ["estimatedLeadIncrease", "estimatedTimeSaved", "estimatedRevenueImpact"], properties: { estimatedLeadIncrease: { type: "string" }, estimatedTimeSaved: { type: "string" }, estimatedRevenueImpact: { type: "string" } } }, twelveMonth: { type: "object", additionalProperties: false, required: ["estimatedLeadIncrease", "estimatedTimeSaved", "estimatedRevenueImpact"], properties: { estimatedLeadIncrease: { type: "string" }, estimatedTimeSaved: { type: "string" }, estimatedRevenueImpact: { type: "string" } } }, disclaimer: { type: "string" } } },
    investmentSummary: { type: "object", additionalProperties: false, required: ["oneTimeCosts", "monthlyCosts", "totalOneTime", "totalMonthly", "budgetNotes"], properties: { oneTimeCosts: { type: "array", items: { type: "object", additionalProperties: false, required: ["item", "amount"], properties: { item: { type: "string" }, amount: { type: "number", minimum: 0 } } } }, monthlyCosts: { type: "array", items: { type: "object", additionalProperties: false, required: ["item", "amount"], properties: { item: { type: "string" }, amount: { type: "number", minimum: 0 } } } }, totalOneTime: { type: "number", minimum: 0 }, totalMonthly: { type: "number", minimum: 0 }, budgetNotes: { type: ["string", "null"] } } },
    nextSteps: stringArray,
  },
} as const;

function validatePlan(value: unknown): DigitalGrowthPlan {
  if (!value || typeof value !== "object") throw new Error("OpenRouter returned an invalid growth plan");
  const plan = value as DigitalGrowthPlan & { investmentSummary?: { budgetNotes?: string | null }; recommendations?: Array<Record<string, unknown>> };
  if (typeof plan.executiveSummary !== "string" || !Array.isArray(plan.recommendations) || !Array.isArray(plan.implementationRoadmap) || !plan.roiProjection || !plan.investmentSummary || !Array.isArray(plan.nextSteps)) throw new Error("OpenRouter returned an incomplete growth plan");
  for (const recommendation of plan.recommendations) {
    if (recommendation.pricingOneTime === null) delete recommendation.pricingOneTime;
    if (recommendation.pricingMonthly === null) delete recommendation.pricingMonthly;
  }
  if (plan.investmentSummary.budgetNotes === null) delete plan.investmentSummary.budgetNotes;
  return plan;
}

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
        const { error: dbError } = await supabase.from("solution_requests").insert({
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
        // The visitor still receives their plan, so a 500 would deny them the
        // thing they came for. But the lead must not vanish, so it is escalated
        // with everything needed to recover it by hand.
        if (dbError) {
          console.error("solution_requests insert FAILED:", dbError.message);
          await supabase.from("admin_notifications").insert({
            type: "new_lead",
            title: `Plan request not recorded: ${formData.contactName}`,
            description: `${formData.contactEmail} requested a plan for ${formData.businessName || "an unnamed business"}. The database write failed, so this lead exists only in this notification.`,
            link: "/admin/leads",
            priority: "urgent",
          });
        }

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

    // Use the deterministic fallback when the optional OpenRouter connection is
    // not active. No alternate AI provider is called.
    if (!isOpenRouterConfigured()) {
      const fallbackPlan = generateFallbackPlan(formData);
      await savePlan(supabase, shareToken, fallbackPlan, "fallback");
      return NextResponse.json({ plan: fallbackPlan, shareToken });
    }

    const userPrompt = buildUserPrompt(formData);
    const modelUsed = getOpenRouterModel(process.env.OPENROUTER_PLAN_MODEL);

    let plan: DigitalGrowthPlan;

    try {
      plan = await callOpenRouter(modelUsed, userPrompt);
    } catch (firstError) {
      console.error("First OpenRouter plan call failed, retrying:", firstError);
      try {
        plan = await callOpenRouter(modelUsed, userPrompt);
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
        planLink: `https://www.acceleratewith.us/plan/${shareToken}`,
        planSummary: plan.executiveSummary,
      },
    }).catch((e) => console.warn("Plan nurture sequence failed:", e));

    return NextResponse.json({ plan, shareToken });
  } catch (error) {
    console.error("Generate plan error:", error);
    return NextResponse.json(
      { error: "Failed to generate your growth plan. Please try again or book a strategy session with us." },
      { status: 500 }
    );
  }
}

async function callOpenRouter(
  model: string,
  userPrompt: string
): Promise<DigitalGrowthPlan> {
  const response = await openRouterJson({
    model,
    maxTokens: 4096,
    temperature: 0.7,
    schemaName: "digital_growth_plan",
    schema: PLAN_SCHEMA,
    validate: validatePlan,
    messages: [{ role: "system", content: PLAN_SYSTEM_PROMPT }, { role: "user", content: userPrompt }],
  });
  return response.data;
}

async function savePlan(
  supabase: SupabaseClient | null,
  shareToken: string,
  plan: DigitalGrowthPlan,
  modelUsed: string
) {
  if (!supabase) return;
  // supabase-js resolves with an error rather than throwing, so the previous
  // try/catch here caught nothing: a failed update left the row stuck in
  // `generating` while the caller handed the visitor a share token pointing at
  // a plan that would never appear.
  const { error } = await supabase
    .from("solution_requests")
    .update({
      status: "completed",
      ai_plan: plan,
      ai_model_used: modelUsed,
      estimated_value: plan.investmentSummary.totalOneTime + plan.investmentSummary.totalMonthly * 12,
      updated_at: new Date().toISOString(),
    })
    .eq("share_token", shareToken);
  if (error) {
    console.error("[generate-plan] saving the completed plan FAILED:", error.message);
    await supabase.from("admin_notifications").insert({
      type: "new_lead",
      title: "Generated plan could not be saved",
      description: `Share token ${shareToken} is stranded: the plan was generated but the row was never completed. ${error.message}`,
      link: "/admin/leads",
      priority: "urgent",
    });
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
      ? "Every unanswered inquiry could be a case worth thousands. This system ensures no potential client falls through the cracks."
      : "Follow-up is where sold work leaks away. Running it on a system instead of memory means every open estimate is worked until it closes, even when you are on a job site.",
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
    name: isRealEstate ? "AI Inquiry Response Agent" : "AI Phone & Chat Agent",
    description: isRealEstate
      ? "An AI agent that responds to ad inquiries instantly, qualifies buyers based on criteria you set, and keeps them engaged with personalized follow-up."
      : "An AI-powered agent that answers your phone and website chat 24/7. Books appointments, answers common questions, and captures contact information.",
    whyItMatters: "You cannot be available 24/7, but your customers expect instant responses. This agent handles the first touchpoint so you never miss an opportunity.",
    features: [
      "24/7 availability for calls and web chat",
      "Natural conversation that represents your brand",
      "Appointment booking with calendar integration",
      "Inquiry qualification and data capture",
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
    executiveSummary: `Based on your intake, your ${formatIndustry(industry)} business has strong growth potential that is being held back by gaps in your digital presence and follow-up. The biggest immediate opportunity is capturing the inquiries you are currently missing through faster response times and a website that actually converts visitors into customers.`,
    recommendations,
    implementationRoadmap: [
      {
        phase: 1,
        name: "Foundation",
        description: "Launch your new website and set up core inquiry capture. This gives you an immediate uplift in online visibility and conversion.",
        duration: "2-3 weeks",
        solutions: ["AI-Powered Website Redesign"],
      },
      {
        phase: 2,
        name: "Automation",
        description: "Deploy automated follow-up sequences and CRM integration. Every inquiry gets a response within minutes.",
        duration: "1-2 weeks",
        solutions: [isLawFirm ? "AI Client Intake System" : "Automated Prospect Follow-Up"],
      },
      {
        phase: 3,
        name: "Intelligence",
        description: "Activate 24/7 AI agent for phone and chat. Full coverage, no missed opportunities.",
        duration: "1-2 weeks",
        solutions: [isRealEstate ? "AI Inquiry Response Agent" : "AI Phone & Chat Agent"],
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
