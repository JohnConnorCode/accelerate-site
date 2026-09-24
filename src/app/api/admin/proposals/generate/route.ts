import { loadContextPack } from "@/lib/revenue-os/shared-context";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminForModule } from "@/lib/admin/module-guard";
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { openRouterJson } from "@/lib/ai/openrouter";
import { isTenantOpenRouterConfigured } from "@/lib/ai/openrouter-credentials";
import {
  buildProposalUserPrompt,
  PROPOSAL_SCHEMA,
  PROPOSAL_SYSTEM_PROMPT,
  validateProposal,
} from "@/lib/ai/proposal-draft";

const GENERATE_LIMIT = 30;
const GENERATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const auth = await requireAdminForModule("proposals");
  if (auth instanceof NextResponse) return auth;

  const adminKey = auth.user.email ?? auth.user.id;
  const rateLimitResult = await rateLimit(
    `admin-proposal-gen:${adminKey}`,
    GENERATE_LIMIT,
    GENERATE_WINDOW_MS,
  );
  if (!rateLimitResult.success)
    return rateLimitResponse(rateLimitResult, {
      error: "Rate limit reached (30 proposals/hour). Wait a moment and try again.",
    });

  const { lead_id } = await request.json();

  if (!lead_id) {
    return NextResponse.json({ error: "lead_id is required" }, { status: 400 });
  }

  const supabase = auth.database;

  const { data: lead, error: leadError } = await supabase
    .from("solution_requests")
    .select("*")
    .eq("id", lead_id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!(await isTenantOpenRouterConfigured(supabase))) {
    return NextResponse.json(
      {
        error: "OpenRouter is not configured for this workspace. Add its API key in Integrations.",
      },
      { status: 503 },
    );
  }

  try {
    const context = await loadContextPack(supabase, {
      entity: { type: "solution_request", id: lead_id },
      includeEvidence: false,
      maxChars: 4000,
    });
    const response = await openRouterJson({
      database: supabase,
      job: "proposal-draft",
      model: process.env.OPENROUTER_PROPOSAL_MODEL,
      maxTokens: 2000,
      temperature: 0.2,
      schemaName: "proposal_draft",
      schema: PROPOSAL_SCHEMA,
      validate: validateProposal,
      messages: [
        { role: "system", content: PROPOSAL_SYSTEM_PROMPT },
        { role: "system", content: context.text },
        { role: "user", content: buildProposalUserPrompt(lead) },
      ],
    });

    const proposalContent = response.data;

    let totalMonthly = 0;
    let totalOneTime = 0;
    const investmentSection = proposalContent.sections?.find((s: { title: string }) =>
      s.title.toLowerCase().includes("investment"),
    );
    if (investmentSection?.pricing) {
      for (const item of investmentSection.pricing) {
        totalMonthly += item.monthly || 0;
        totalOneTime += item.oneTime || 0;
      }
    }

    return NextResponse.json({
      content: proposalContent,
      totalMonthly,
      totalOneTime,
      clientName: lead.contact_name,
      businessName: lead.business_name,
      provider: "openrouter",
      model: response.model,
      requestId: response.requestId,
    });
  } catch (error) {
    console.error("[proposals/generate] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate proposal" },
      { status: 500 },
    );
  }
}
