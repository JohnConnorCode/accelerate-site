import { siteUrl, tenant } from "@/config/tenant";
import { emailSequences } from "@/content/email-sequences";
import {
  adminContactNotificationEmail,
  adminLeadNotificationEmail,
  contactConfirmationEmail,
  planConfirmationEmail,
  roiReportEmail,
  textEmail,
} from "./templates";

export interface EmailTemplateDefinition {
  key: string;
  name: string;
  description: string;
  category: string;
  subjectTemplate: string;
  bodyTemplate: string;
  variables: string[];
  sampleData: Record<string, string>;
  delayDays?: number;
  renderDefaultHtml?: (variables: Record<string, string>) => string;
}

const sample = {
  name: "Sarah Mitchell",
  email: "sarah@mitchellhvac.com",
  phone: "(555) 234-5678",
  business: "Mitchell HVAC Services",
  companyName: "Mitchell HVAC Services",
  companyWebsite: "https://mitchellhvac.com",
  businessType: "Home services",
  primaryProblem: "Slow inquiry follow-up",
  message: "We need a better system for responding to and following up with new inquiries.",
  industry: "home services",
  planLink: `${siteUrl()}/plan/example`,
  planSummary: "Prioritize response time, consistent follow-up, and clear pipeline ownership.",
  score: "62",
  topIssues: "Slow mobile performance and unclear conversion actions.",
  resourceTitle: "The AI Automation Playbook",
  downloadLink: `${siteUrl()}/resources/ai-playbook`,
  roiPercentage: "340",
  additionalMonthlyRevenue: "$8,400",
  annualRevenueImpact: "$100,800",
  timeSavedPerWeek: "12",
  paybackPeriodMonths: "2.1",
};

const transactional: EmailTemplateDefinition[] = [
  {
    key: "plan-confirmation", name: "Plan confirmation", category: "Transactional",
    description: "Delivers a generated action plan and gives the prospect a clear next step.",
    subjectTemplate: "Your growth plan is ready, {{name}}",
    bodyTemplate: `Hi {{name}},\n\nYour growth plan is ready.\n\n{{planSummary}}\n\nReview the plan: {{planLink}}\n\nIf you want to talk through the first move, reply here and I’ll help you choose the right starting point.\n\n${tenant.founder.name}\n${tenant.brand.name}`,
    variables: ["name", "planSummary", "planLink"], sampleData: sample,
    renderDefaultHtml: (v) => planConfirmationEmail(v.name || "there", v.planSummary || "Your recommendations are ready.", v.planLink || `${siteUrl()}/contact`),
  },
  {
    key: "contact-confirmation", name: "Contact confirmation", category: "Transactional",
    description: "Confirms an inquiry and sets a clear, personal follow-up expectation.",
    subjectTemplate: "We received your request, {{name}}",
    bodyTemplate: `Hi {{name}},\n\nThanks for reaching out. I’ve received your request and will review it personally.\n\nI’ll follow up within one business day with the clearest next step. If you already know when you’d like to talk, reply with two times that work for you.\n\n${tenant.founder.name}\n${tenant.brand.name}`,
    variables: ["name"], sampleData: sample,
    renderDefaultHtml: (v) => contactConfirmationEmail(v.name || "there"),
  },
  {
    key: "roi-report", name: "ROI report", category: "Transactional",
    description: "Delivers an ROI scenario with the assumptions supplied by the analysis.",
    subjectTemplate: "Your ROI scenario is ready, {{name}}",
    bodyTemplate: `Hi {{name}},\n\nHere’s the ROI scenario from your analysis:\n\nProjected return: {{roiPercentage}}%\nAdditional monthly revenue: {{additionalMonthlyRevenue}}\nAnnual revenue impact: {{annualRevenueImpact}}\nTime saved each week: {{timeSavedPerWeek}} hours\nPayback period: {{paybackPeriodMonths}} months\n\nThese figures are a planning scenario, not a guarantee. Reply if you want to review the assumptions and implementation order.\n\n${tenant.founder.name}\n${tenant.brand.name}`,
    variables: ["name", "roiPercentage", "additionalMonthlyRevenue", "annualRevenueImpact", "timeSavedPerWeek", "paybackPeriodMonths"], sampleData: sample,
    renderDefaultHtml: (v) => roiReportEmail({ name: v.name, roiPercentage: Number(v.roiPercentage || 0), additionalMonthlyRevenue: v.additionalMonthlyRevenue || "$0", annualRevenueImpact: v.annualRevenueImpact || "$0", timeSavedPerWeek: v.timeSavedPerWeek || "0", paybackPeriodMonths: v.paybackPeriodMonths || "0" }),
  },
  {
    key: "admin-lead", name: "Admin lead alert", category: "Operator alerts",
    description: "Gives the founder a concise, actionable alert for a new plan inquiry.",
    subjectTemplate: "New plan inquiry · {{name}}",
    bodyTemplate: "New plan inquiry needs review.\n\nName: {{name}}\nEmail: {{email}}\nPhone: {{phone}}\nBusiness: {{business}}\nIndustry: {{industry}}\n\nOpen the record, confirm the fit, and choose the next action.",
    variables: ["name", "email", "phone", "business", "industry"], sampleData: sample,
    renderDefaultHtml: (v) => adminLeadNotificationEmail({ name: v.name || "Unknown", email: v.email || "unknown@example.com", phone: v.phone, business: v.business, industry: v.industry || "unknown" }),
  },
  {
    key: "admin-contact", name: "Admin contact alert", category: "Operator alerts",
    description: "Gives the founder the context needed to respond to a contact inquiry.",
    subjectTemplate: "New contact inquiry · {{name}}",
    bodyTemplate: "A prospect sent a message.\n\nName: {{name}}\nEmail: {{email}}\nPhone: {{phone}}\nCompany: {{companyName}}\nWebsite: {{companyWebsite}}\nBusiness: {{businessType}}\nPrimary constraint: {{primaryProblem}}\n\nMessage:\n{{message}}\n\nOpen the record, link the inquiry, and set the next action.",
    variables: ["name", "email", "phone", "companyName", "companyWebsite", "businessType", "primaryProblem", "message"], sampleData: sample,
    renderDefaultHtml: (v) => adminContactNotificationEmail({ name: v.name || "Unknown", email: v.email || "unknown@example.com", phone: v.phone, companyName: v.companyName, companyWebsite: v.companyWebsite, businessType: v.businessType, primaryProblem: v.primaryProblem, message: v.message || "" }),
  },
];

const sequenceDefinitions: EmailTemplateDefinition[] = Object.entries(emailSequences).flatMap(([type, steps]) => steps.map((step) => ({
  key: `${type.replaceAll("_", "-")}-${step.stepNumber}`,
  name: `${type.replaceAll("_", " ").replace(/\b\w/g, (value) => value.toUpperCase())} · Email ${step.stepNumber}`,
  description: step.delayDays ? `Automated follow-up after ${step.delayDays} days.` : "Immediate sequence message.",
  category: "Automated sequences",
  subjectTemplate: step.subject,
  bodyTemplate: step.bodyTemplate,
  variables: [...new Set(`${step.subject} ${step.bodyTemplate}`.match(/\{\{([A-Za-z0-9_]+)\}\}/g)?.map((token) => token.slice(2, -2)) || [])],
  sampleData: sample,
  delayDays: step.delayDays,
})));

export const EMAIL_TEMPLATE_DEFINITIONS = [...transactional, ...sequenceDefinitions];

export function getEmailTemplateDefinition(key: string) {
  return EMAIL_TEMPLATE_DEFINITIONS.find((definition) => definition.key === key) ?? null;
}

export function replaceEmailVariables(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, key: string) => variables[key] ?? `{{${key}}}`);
}

export function renderDefinition(definition: EmailTemplateDefinition, variables = definition.sampleData) {
  const subject = replaceEmailVariables(definition.subjectTemplate, variables);
  const text = replaceEmailVariables(definition.bodyTemplate, variables);
  return { subject, text, html: definition.renderDefaultHtml?.(variables) ?? textEmail(text) };
}
