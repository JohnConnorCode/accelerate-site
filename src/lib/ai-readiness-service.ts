import "server-only";

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBootstrapServiceRoleClient } from "@/lib/supabase/server";
import { ingestInboundLead } from "@/lib/revenue-os/inbound";
import { scheduleEmailSequence } from "@/lib/email/sequences";
import { siteUrl } from "@/config/tenant";
import { openRouterJson } from "@/lib/ai/openrouter";
import {
  assessmentAnswerSchema,
  calculateReadiness,
  profileSchema,
  publicPreview,
  type AssessmentAnswers,
  type AssessmentProfile,
  type ReadinessReport,
  AI_READINESS_VERSION,
} from "@/lib/ai-readiness";
import type { UTMData } from "@/lib/utm";

export type AssessmentContact = {
  name: string;
  email: string;
  businessName: string;
  consentGiven: boolean;
  marketingConsent: boolean;
};

export type AssessmentAttribution = Pick<UTMData, "utm_source" | "utm_medium" | "utm_campaign"> & {
  referrerHost?: string;
};

export type AssessmentSession = {
  sessionToken: string;
  reportToken: string | null;
  report: ReadinessReport;
  preview: ReturnType<typeof publicPreview>;
  persisted: boolean;
};

function token() {
  return randomBytes(32).toString("base64url");
}

function database(): SupabaseClient | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    return createBootstrapServiceRoleClient("public-ai-readiness");
  } catch {
    return null;
  }
}

export function validateAssessment(input: { answers: unknown; profile: unknown }) {
  const answers = assessmentAnswerSchema.parse(input.answers) as AssessmentAnswers;
  const profile = profileSchema.parse(input.profile) as AssessmentProfile;
  const report = calculateReadiness(answers, profile);
  return { answers, profile, report };
}

async function enrichReport(
  supabase: SupabaseClient,
  report: ReadinessReport,
): Promise<ReadinessReport> {
  const response = await openRouterJson({
    database: supabase,
    job: "ai-readiness-report",
    maxTokens: 900,
    temperature: 0.35,
    schemaName: "ai_readiness_report_enrichment",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "actionPlan"],
      properties: {
        summary: { type: "string", minLength: 40, maxLength: 700 },
        actionPlan: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["week", "title", "detail"],
            properties: {
              week: { type: "string", maxLength: 30 },
              title: { type: "string", maxLength: 100 },
              detail: { type: "string", maxLength: 320 },
            },
          },
        },
      },
    },
    validate(value) {
      if (!value || typeof value !== "object") throw new Error("Invalid enrichment");
      const candidate = value as { summary?: unknown; actionPlan?: unknown };
      if (
        typeof candidate.summary !== "string" ||
        !Array.isArray(candidate.actionPlan) ||
        candidate.actionPlan.length !== 4
      )
        throw new Error("Invalid enrichment");
      if (
        candidate.actionPlan.some(
          (item) =>
            !item ||
            typeof item !== "object" ||
            typeof (item as { week?: unknown }).week !== "string" ||
            typeof (item as { title?: unknown }).title !== "string" ||
            typeof (item as { detail?: unknown }).detail !== "string",
        )
      )
        throw new Error("Invalid enrichment steps");
      return {
        summary: candidate.summary,
        actionPlan: candidate.actionPlan as ReadinessReport["actionPlan"],
      };
    },
    messages: [
      {
        role: "system",
        content:
          "You tailor a practical AI readiness report. Use only supplied facts. Never invent savings, benchmarks, prices, guarantees, or capabilities. Keep language plain and specific. Return exactly four action-plan steps.",
      },
      {
        role: "user",
        content: JSON.stringify({
          score: report.score,
          coverage: report.coverage,
          profile: report.profile,
          dimensions: report.dimensionScores,
          recommendations: report.recommendations.map((item) => ({
            title: item.title,
            summary: item.summary,
            metric: item.metric,
            prerequisites: item.prerequisites,
          })),
          currentPlan: report.actionPlan,
        }),
      },
    ],
  });
  return {
    ...report,
    summary: response.data.summary,
    actionPlan: response.data.actionPlan,
    aiStatus: "enriched",
  };
}

async function saveDraft(
  supabase: SupabaseClient,
  sessionToken: string,
  answers: AssessmentAnswers,
  profile: AssessmentProfile,
  report: ReadinessReport,
  attribution?: AssessmentAttribution,
) {
  const { data, error } = await supabase
    .from("ai_readiness_assessments")
    .upsert(
      {
        session_token: sessionToken,
        version: AI_READINESS_VERSION,
        status: "previewed",
        answers,
        profile,
        score: report.score,
        coverage: report.coverage,
        dimension_scores: report.dimensionScores,
        utm_source: attribution?.utm_source || null,
        utm_medium: attribution?.utm_medium || null,
        utm_campaign: attribution?.utm_campaign || null,
        referrer_host: attribution?.referrerHost || null,
        previewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_token" },
    )
    .select("id,report_token")
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; report_token: string | null };
}

export async function previewAssessment(input: {
  sessionToken?: string;
  answers: unknown;
  profile: unknown;
  attribution?: AssessmentAttribution;
}): Promise<AssessmentSession> {
  const { answers, profile, report } = validateAssessment(input);
  const sessionToken = input.sessionToken || token();
  let reportToken: string | null = null;
  let persisted = false;
  const supabase = database();
  if (supabase) {
    try {
      const saved = await saveDraft(
        supabase,
        sessionToken,
        answers,
        profile,
        report,
        input.attribution,
      );
      reportToken = saved.report_token;
      persisted = true;
    } catch (error) {
      console.warn(
        "AI readiness draft could not be persisted:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }
  return { sessionToken, reportToken, report, preview: publicPreview(report), persisted };
}

export async function unlockAssessment(input: {
  sessionToken?: string;
  answers: unknown;
  profile: unknown;
  contact: AssessmentContact;
  attribution?: AssessmentAttribution;
}): Promise<AssessmentSession> {
  const { answers, profile, report: rulesReport } = validateAssessment(input);
  if (!input.contact.consentGiven) throw new Error("Consent is required to save your report.");
  const sessionToken = input.sessionToken || token();
  const supabase = database();
  const reportToken = supabase ? token() : null;
  let report = rulesReport;
  if (supabase) {
    try {
      report = await enrichReport(supabase, rulesReport);
    } catch (error) {
      console.warn(
        "AI readiness enrichment unavailable; using rules report:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }
  let persisted = false;
  if (supabase) {
    const { data: row, error } = await supabase
      .from("ai_readiness_assessments")
      .upsert(
        {
          session_token: sessionToken,
          report_token: reportToken,
          version: AI_READINESS_VERSION,
          status: "unlocked",
          answers,
          profile,
          score: report.score,
          coverage: report.coverage,
          dimension_scores: report.dimensionScores,
          name: input.contact.name.trim(),
          email: input.contact.email.trim().toLowerCase(),
          business_name: input.contact.businessName.trim(),
          consent_given: true,
          marketing_consent: input.contact.marketingConsent,
          utm_source: input.attribution?.utm_source || null,
          utm_medium: input.attribution?.utm_medium || null,
          utm_campaign: input.attribution?.utm_campaign || null,
          referrer_host: input.attribution?.referrerHost || null,
          unlocked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "session_token" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const assessmentId = row.id;
    const { error: reportError } = await supabase
      .from("ai_readiness_reports")
      .upsert(
        { assessment_id: assessmentId, revision: 1, report, ai_status: report.aiStatus },
        { onConflict: "tenant_id,assessment_id,revision" },
      );
    if (reportError) throw new Error(reportError.message);
    persisted = true;

    await ingestInboundLead(supabase, {
      name: input.contact.name.trim(),
      email: input.contact.email.trim().toLowerCase(),
      companyName: input.contact.businessName.trim(),
      industry: profile.businessType,
      source: "solution_request",
      sourceRecordId: assessmentId,
      summary: `AI readiness assessment: ${report.score === null ? "incomplete score" : `${report.score}/100`}; focus ${report.recommendations[0]?.title ?? "guided review"}.`,
      utm: input.attribution,
    })
      .then(async (result) => {
        await supabase
          .from("ai_readiness_assessments")
          .update({
            contact_id: result.identity.contact.id,
            opportunity_id: result.opportunity?.id ?? null,
          })
          .eq("id", assessmentId);
      })
      .catch((error) =>
        console.warn(
          "AI readiness canonical linkage deferred:",
          error instanceof Error ? error.message : "unknown",
        ),
      );
  }

  const reportUrl = reportToken
    ? `${siteUrl()}/ai-readiness/report/${reportToken}`
    : `${siteUrl()}/ai-readiness`;
  if (process.env.RESEND_API_KEY && reportToken) {
    void scheduleEmailSequence({
      email: input.contact.email.trim().toLowerCase(),
      sequenceType: "resource_welcome",
      metadata: {
        name: input.contact.name.trim(),
        resourceTitle: "your AI Readiness Action Plan",
        downloadLink: reportUrl,
        reportLink: reportUrl,
      },
    }).catch((error) =>
      console.warn(
        "AI readiness report email could not be scheduled:",
        error instanceof Error ? error.message : "unknown",
      ),
    );
  }
  return { sessionToken, reportToken, report, preview: publicPreview(report), persisted };
}

export async function loadReport(reportToken: string) {
  const supabase = database();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("ai_readiness_assessments")
    .select("id,report_token")
    .eq("report_token", reportToken)
    .maybeSingle();
  if (error || !data) return null;
  const report = await supabase
    .from("ai_readiness_reports")
    .select("report")
    .eq("assessment_id", data.id)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (report.error || !report.data) return null;
  return report.data.report as ReadinessReport;
}
