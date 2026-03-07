import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  planConfirmationEmail,
  contactConfirmationEmail,
  roiReportEmail,
  adminLeadNotificationEmail,
  adminContactNotificationEmail,
  emailWrapper,
} from "@/lib/email/templates";
import { emailSequences } from "@/content/email-sequences";

interface EmailEntry {
  id: string;
  name: string;
  category: string;
  subject: string;
}

const SAMPLE = {
  name: "Sarah Mitchell",
  email: "sarah@mitchellhvac.com",
  phone: "(555) 234-5678",
  business: "Mitchell HVAC Services",
  industry: "home_services",
  planUrl: "https://acceleratewith.us/plan/abc123",
  planSummary:
    "AI-powered website with 24/7 chat, automated follow-up sequences, and review management system.",
  score: "62",
  topIssues:
    "- Mobile page speed: 2.8s (target: <1.5s)\n- No SSL certificate detected\n- Missing meta descriptions on 4 pages",
  resourceTitle: "The Small Business AI Automation Playbook",
  downloadLink: "https://acceleratewith.us/resources/ai-playbook",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function linkifyUrls(text: string): string {
  return text.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#F5D060;text-decoration:underline;">$1</a>'
  );
}

function replaceVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

function sequenceToHtml(body: string): string {
  const escaped = escapeHtml(body);
  const linked = linkifyUrls(escaped);
  const lined = linked.replace(/\n/g, "<br>");
  const content = `<div style="font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">${lined}</div>`;
  return emailWrapper(content);
}

const sequenceVars: Record<string, string> = {
  name: SAMPLE.name,
  industry: "home services",
  planLink: SAMPLE.planUrl,
  planSummary: SAMPLE.planSummary,
  score: SAMPLE.score,
  topIssues: SAMPLE.topIssues,
  resourceTitle: SAMPLE.resourceTitle,
  downloadLink: SAMPLE.downloadLink,
};

function buildRegistry(): EmailEntry[] {
  const entries: EmailEntry[] = [
    {
      id: "plan-confirmation",
      name: "Plan Confirmation",
      category: "User Emails",
      subject: "Your Growth Plan Is Ready",
    },
    {
      id: "contact-confirmation",
      name: "Contact Confirmation",
      category: "User Emails",
      subject: "We Got Your Message",
    },
    {
      id: "roi-report",
      name: "ROI Report",
      category: "User Emails",
      subject: "Your AI Automation ROI Analysis",
    },
    {
      id: "admin-lead",
      name: "Admin Lead Alert",
      category: "Admin Alerts",
      subject: "New Lead Submitted",
    },
    {
      id: "admin-contact",
      name: "Admin Contact Alert",
      category: "Admin Alerts",
      subject: "New Contact Form Submission",
    },
  ];

  const seqMap: Record<string, { prefix: string; category: string }> = {
    plan_nurture: { prefix: "plan-nurture", category: "Sequences" },
    resource_welcome: { prefix: "resource-welcome", category: "Sequences" },
    grader_followup: { prefix: "grader-followup", category: "Sequences" },
  };

  for (const [seqType, steps] of Object.entries(emailSequences)) {
    const config = seqMap[seqType];
    if (!config) continue;
    for (const step of steps) {
      const subject = replaceVars(step.subject, sequenceVars);
      entries.push({
        id: `${config.prefix}-${step.stepNumber}`,
        name: `${config.prefix}-${step.stepNumber}`,
        category: config.category,
        subject,
      });
    }
  }

  return entries;
}

function renderEmail(id: string): string | null {
  switch (id) {
    case "plan-confirmation":
      return planConfirmationEmail(SAMPLE.name, SAMPLE.planSummary, SAMPLE.planUrl);
    case "contact-confirmation":
      return contactConfirmationEmail(SAMPLE.name);
    case "roi-report":
      return roiReportEmail({
        name: SAMPLE.name,
        roiPercentage: 340,
        additionalMonthlyRevenue: "$8,400",
        annualRevenueImpact: "$100,800",
        timeSavedPerWeek: "12",
        paybackPeriodMonths: "2.1",
      });
    case "admin-lead":
      return adminLeadNotificationEmail({
        name: SAMPLE.name,
        email: SAMPLE.email,
        phone: SAMPLE.phone,
        business: SAMPLE.business,
        industry: SAMPLE.industry,
      });
    case "admin-contact":
      return adminContactNotificationEmail({
        name: SAMPLE.name,
        email: SAMPLE.email,
        phone: SAMPLE.phone,
        businessType: SAMPLE.business,
        message:
          "Hi, I'm interested in learning more about your AI automation services for my HVAC company. We currently handle about 200 service calls per month and I think there's a lot of room for improvement in our follow-up process.",
      });
    default: {
      // Sequence emails
      for (const [seqType, steps] of Object.entries(emailSequences)) {
        const prefix =
          seqType === "plan_nurture"
            ? "plan-nurture"
            : seqType === "resource_welcome"
              ? "resource-welcome"
              : seqType === "grader_followup"
                ? "grader-followup"
                : null;
        if (!prefix) continue;
        for (const step of steps) {
          if (`${prefix}-${step.stepNumber}` === id) {
            const body = replaceVars(step.bodyTemplate, sequenceVars);
            return sequenceToHtml(body);
          }
        }
      }
      return null;
    }
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");

  if (!id) {
    const emails = buildRegistry();
    return NextResponse.json({ emails });
  }

  const registry = buildRegistry();
  const entry = registry.find((e) => e.id === id);
  if (!entry) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  const html = renderEmail(id);
  if (!html) {
    return NextResponse.json({ error: "Failed to render email" }, { status: 500 });
  }

  return NextResponse.json({ id, subject: entry.subject, html });
}
