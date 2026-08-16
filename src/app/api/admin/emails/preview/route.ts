import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import {
  planConfirmationEmail,
  contactConfirmationEmail,
  roiReportEmail,
  adminLeadNotificationEmail,
  adminContactNotificationEmail,
  textEmail,
} from "@/lib/email/templates";
import { emailSequences } from "@/content/email-sequences";

interface EmailEntry {
  id: string;
  name: string;
  category: string;
  subject: string;
  delayDays?: number;
}

const SAMPLE = {
  name: "Sarah Mitchell",
  email: "sarah@mitchellhvac.com",
  phone: "(555) 234-5678",
  business: "Mitchell HVAC Services",
  industry: "home_services",
  planUrl: "https://www.acceleratewith.us/plan/abc123",
  planSummary:
    "AI-powered website with 24/7 chat, automated follow-up sequences, and review management system.",
  score: "62",
  topIssues:
    "- Mobile page speed: 2.8s (target: <1.5s)\n- No SSL certificate detected\n- Missing meta descriptions on 4 pages",
  resourceTitle: "The Small Business AI Automation Playbook",
  downloadLink: "https://www.acceleratewith.us/resources/ai-playbook",
};

function replaceVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
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

  for (const [seqType, steps] of Object.entries(emailSequences)) {
    const name = seqType.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    const prefix = seqType.replace(/_/g, "-");
    for (const step of steps) {
      const subject = replaceVars(step.subject, sequenceVars);
      entries.push({
        id: `${prefix}-${step.stepNumber}`,
        name: `${name} · Email ${step.stepNumber}`,
        category: "Automated sequences",
        subject,
        delayDays: step.delayDays,
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
        const prefix = seqType.replace(/_/g, "-");
        for (const step of steps) {
          if (`${prefix}-${step.stepNumber}` === id) {
            const body = replaceVars(step.bodyTemplate, sequenceVars);
            return textEmail(body);
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

  return NextResponse.json({
    id,
    subject: entry.subject,
    html,
    name: entry.name,
    category: entry.category,
    delayDays: entry.delayDays,
  });
}
