import "server-only";

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBootstrapServiceRoleClient, tenantIdForDatabase } from "@/lib/supabase/server";
import { ingestInboundLead } from "@/lib/revenue-os/inbound";
import { sendRecordedEmail } from "@/lib/revenue-os/communications";
import { siteUrl } from "@/config/tenant";
import { openRouterJson } from "@/lib/ai/openrouter";
import { auditWebsite } from "@/lib/ai-readiness-website";
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

async function addWebsiteAudit(report: ReadinessReport, profile: AssessmentProfile) {
  const websiteAudit = await auditWebsite(profile.websiteUrl);
  return websiteAudit ? { ...report, websiteAudit } : report;
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
          websiteAudit: report.websiteAudit,
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
      { onConflict: "tenant_id,session_token", ignoreDuplicates: true },
    )
    .select("id,report_token")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as { id: string; report_token: string | null };
  const existing = await supabase
    .from("ai_readiness_assessments")
    .select("id,report_token")
    .eq("session_token", sessionToken)
    .single();
  if (existing.error) throw new Error("Assessment session could not be read");
  return existing.data as { id: string; report_token: string | null };
}

export async function previewAssessment(input: {
  sessionToken?: string;
  answers: unknown;
  profile: unknown;
  attribution?: AssessmentAttribution;
}): Promise<AssessmentSession> {
  const { answers, profile, report: rulesReport } = validateAssessment(input);
  const report = await addWebsiteAudit(rulesReport, profile);
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
  let reportToken: string | null = null;
  let deliveryEmail = input.contact.email.trim().toLowerCase();
  let deliveryName = input.contact.name.trim();
  let assessmentId: string | null = null;
  // A completed session reuses its stored report without another model or crawl.
  const previous = supabase
    ? await supabase
        .from("ai_readiness_assessments")
        .select("report_token")
        .eq("session_token", sessionToken)
        .maybeSingle()
    : null;
  if (previous?.error) throw new Error("Assessment recovery is temporarily unavailable");
  const existingReport = previous?.data?.report_token
    ? await loadReport(previous.data.report_token)
    : null;
  const reportWithWebsite = existingReport ?? (await addWebsiteAudit(rulesReport, profile));
  let report = reportWithWebsite;
  if (supabase && !existingReport) {
    try {
      report = await enrichReport(supabase, reportWithWebsite);
    } catch (error) {
      console.warn(
        "AI readiness enrichment unavailable; using rules report:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }
  let persisted = false;
  if (supabase) {
    const tenantId = tenantIdForDatabase(supabase);
    if (!tenantId) throw new Error("Tenant context required");
    const { data: saved, error } = await supabase.rpc("complete_ai_readiness_report", {
      p_tenant_id: tenantId,
      p_session_token: sessionToken,
      p_report_token: token(),
      p_assessment: {
        version: AI_READINESS_VERSION,
        answers,
        profile,
        name: input.contact.name.trim(),
        email: deliveryEmail,
        business_name: input.contact.businessName.trim(),
        consent_given: true,
        marketing_consent: input.contact.marketingConsent,
        ...input.attribution,
        referrer_host: input.attribution?.referrerHost || null,
      },
      p_report: report,
    });
    if (error || !saved?.assessmentId || !saved.reportToken || !saved.report)
      throw new Error("The report could not be saved. Retry to recover the same report.");
    assessmentId = saved.assessmentId;
    reportToken = saved.reportToken;
    report = saved.report;
    deliveryEmail = saved.email;
    deliveryName = saved.name;
    persisted = true;

    await ingestInboundLead(supabase, {
      name: deliveryName,
      email: deliveryEmail,
      companyName: saved.businessName,
      industry: report.profile.businessType,
      source: "solution_request",
      sourceRecordId: assessmentId!,
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
  if (
    supabase &&
    reportToken &&
    assessmentId &&
    !deliveryEmail.endsWith("@example.invalid") &&
    !/^qa[-_]/i.test(deliveryEmail)
  ) {
    try {
      await sendRecordedEmail(supabase, {
        to: deliveryEmail,
        subject: "Your AI Readiness Action Plan",
        text: `Hello ${deliveryName},\n\nYour saved AI Readiness Action Plan is ready: ${reportUrl}\n\nOpen the report to review your next steps and download the PDF.`,
        idempotencyKey: `ai-readiness-report:${assessmentId}`,
        source: "automation",
      });
    } catch {
      // The canonical mail service retains dispatch/failure state. A retry uses
      // this same identity; the saved web report remains available either way.
      console.warn("AI readiness report saved; email delivery needs verification in Activity.");
    }
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
