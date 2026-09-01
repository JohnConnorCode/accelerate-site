import { siteUrl, tenant } from "@/config/tenant";

const baseUrl = () => siteUrl();

const COLORS = {
  page: "#eef1ee",
  surface: "#ffffff",
  ink: "#151611",
  body: "#3f4744",
  muted: "#68736e",
  faint: "#8a9690",
  line: "#dfe5df",
  signal: "#c8ef58",
  signalSoft: "#eff9d7",
  dark: "#1b211e",
};

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function baseHead(): string {
  return `<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">`;
}

function brandRow(label = tenant.brand.tagline): string {
  return `<tr><td style="padding:0 0 24px 0;"><a href="${baseUrl()}" style="color:${COLORS.ink};font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:800;letter-spacing:-.04em;text-decoration:none;">${esc(tenant.brand.name)}<span style="color:${tenant.brand.accentColor};">.</span></a><p style="margin:7px 0 0;color:${COLORS.muted};font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.08em;line-height:1.4;text-transform:uppercase;">${label}</p></td></tr>`;
}

export function emailWrapper(content: string): string {
  return `<!DOCTYPE html><html lang="en"><head>${baseHead()}<title>${esc(tenant.brand.name)}</title></head><body style="margin:0;padding:0;background-color:${COLORS.page};font-family:Arial,Helvetica,sans-serif;color:${COLORS.body};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${COLORS.page};"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;"><tr><td>${brandRow()}</td></tr><tr><td style="background-color:${COLORS.surface};border:1px solid ${COLORS.line};border-radius:16px;padding:36px 36px 32px;">${content}</td></tr><tr><td style="padding:22px 4px 0;text-align:center;"><p style="margin:0;color:${COLORS.faint};font-size:11px;line-height:1.6;">${esc(tenant.brand.emailFooter)}<br><a href="${baseUrl()}" style="color:${COLORS.muted};text-decoration:underline;">${esc(tenant.brand.domain)}</a></p></td></tr></table></td></tr></table></body></html>`;
}

function signalButton(text: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px;"><tr><td style="border-radius:7px;background-color:${COLORS.dark};"><a href="${esc(href)}" style="display:inline-block;border:1px solid ${COLORS.dark};border-radius:7px;padding:13px 20px;color:${COLORS.signal};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:1;text-decoration:none;">${esc(text)} <span aria-hidden="true" style="font-size:16px;">&nbsp;→</span></a></td></tr></table>`;
}

function adminWrapper(content: string): string {
  return `<!DOCTYPE html><html lang="en"><head>${baseHead()}<title>${esc(tenant.brand.name)} Operations</title></head><body style="margin:0;padding:0;background-color:${COLORS.page};font-family:Arial,Helvetica,sans-serif;color:${COLORS.body};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${COLORS.page};"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;"><tr><td>${brandRow("Founder operations")}</td></tr><tr><td style="background-color:${COLORS.surface};border:1px solid ${COLORS.line};border-radius:16px;padding:32px;">${content}</td></tr></table></td></tr></table></body></html>`;
}

/** Gives operator-written and scheduled plain-text messages the same reliable,
 * responsive email shell as transactional templates while preserving content. */
export function textEmail(body: string): string {
  const html = esc(body).replace(
    /(https?:\/\/[^\s<]+)/g,
    `<a href="$1" style="color:#5c8518;text-decoration:underline;word-break:break-word;">$1</a>`,
  );
  const paragraphs = html
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:${COLORS.body};font-size:15px;line-height:1.65;">${paragraph.replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  return emailWrapper(`<div>${paragraphs}</div>`);
}

/** A server-issued, one-time admin recovery link. */
export function adminPasswordResetEmail(resetUrl: string): string {
  return emailWrapper(
    `<p style="margin:0 0 9px;color:#5c8518;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">Account security</p><h1 style="margin:0 0 16px;color:${COLORS.ink};font-size:24px;letter-spacing:-.03em;line-height:1.2;">Reset your admin password</h1><p style="margin:0 0 16px;color:${COLORS.body};font-size:15px;line-height:1.65;">Use this one-time link to choose a new password for your ${esc(tenant.brand.name)} operations account.</p>${signalButton("Reset password", resetUrl)}<p style="margin:20px 0 0;color:${COLORS.faint};font-size:12px;line-height:1.5;">If you did not request this, you can safely ignore this email.</p>`,
  );
}

/** A platform-issued tenant invitation. The one-time URL is supplied by the
 * server and is never persisted in application data or returned to the UI. */
export function tenantAdminInvitationEmail(input: {
  workspaceName: string;
  acceptUrl: string;
}): string {
  return emailWrapper(
    `<p style="margin:0 0 9px;color:#5c8518;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">Workspace invitation</p><h1 style="margin:0 0 16px;color:${COLORS.ink};font-size:24px;letter-spacing:-.03em;line-height:1.2;">Join ${esc(input.workspaceName)}</h1><p style="margin:0 0 16px;color:${COLORS.body};font-size:15px;line-height:1.65;">You have been invited to administer this workspace in ${esc(tenant.brand.name)}. This one-time link signs you in and activates only the workspace named above.</p>${signalButton("Accept invitation", input.acceptUrl)}<p style="margin:20px 0 0;color:${COLORS.faint};font-size:12px;line-height:1.5;">If you were not expecting this invitation, you can safely ignore it. The link expires according to the workspace authentication policy.</p>`,
  );
}

export function planConfirmationEmail(name: string, summary: string, planUrl: string): string {
  return emailWrapper(
    `<p style="margin:0 0 9px;color:#5c8518;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">Your growth plan</p><h1 style="margin:0 0 16px;color:${COLORS.ink};font-size:24px;letter-spacing:-.03em;line-height:1.2;">Your Growth Plan Is Ready</h1><p style="margin:0 0 16px;color:${COLORS.body};font-size:15px;line-height:1.65;">Hi ${esc(name)},</p><p style="margin:0 0 16px;color:${COLORS.body};font-size:15px;line-height:1.65;">Your personalized AI growth plan has been generated. Here is a quick summary:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr><td style="border-left:4px solid #a8d936;background-color:${COLORS.signalSoft};padding:16px 18px;color:${COLORS.body};font-size:14px;line-height:1.6;">${esc(summary)}</td></tr></table><p style="margin:0 0 8px;color:${COLORS.body};font-size:15px;line-height:1.65;">View your full plan with detailed recommendations, implementation roadmap, and ROI projections:</p>${signalButton("View your growth plan", planUrl)}<p style="margin:20px 0 0;color:${COLORS.faint};font-size:12px;line-height:1.5;">This link is unique to you and can be shared with your team.</p>`,
  );
}

function infoRows(rows: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;color:${COLORS.body};font-size:14px;line-height:1.45;">${rows.map(([label, value]) => `<tr><td style="border-bottom:1px solid ${COLORS.line};padding:11px 8px 11px 0;color:${COLORS.muted};width:112px;vertical-align:top;">${label}</td><td style="border-bottom:1px solid ${COLORS.line};padding:11px 0;color:${COLORS.ink};vertical-align:top;word-break:break-word;">${value}</td></tr>`).join("")}</table>`;
}

export function adminLeadNotificationEmail(leadData: {
  name: string;
  email: string;
  phone?: string;
  business?: string;
  industry: string;
}): string {
  const rows: Array<[string, string]> = [
    ["Name", esc(leadData.name)],
    [
      "Email",
      `<a href="mailto:${esc(leadData.email)}" style="color:#5c8518;">${esc(leadData.email)}</a>`,
    ],
  ];
  if (leadData.phone) rows.push(["Phone", esc(leadData.phone)]);
  if (leadData.business) rows.push(["Business", esc(leadData.business)]);
  rows.push(["Industry", esc(leadData.industry.replace(/_/g, " "))]);
  return adminWrapper(
    `<p style="margin:0 0 9px;color:#5c8518;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">Lead intake</p><h1 style="margin:0 0 20px;color:${COLORS.ink};font-size:24px;letter-spacing:-.03em;line-height:1.2;">New lead, ready to qualify</h1>${infoRows(rows)}${signalButton("View in admin dashboard", `${baseUrl()}/admin/leads`)}`,
  );
}

export function contactConfirmationEmail(name: string): string {
  return emailWrapper(
    `<p style="margin:0 0 9px;color:#5c8518;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">Request received</p><h1 style="margin:0 0 16px;color:${COLORS.ink};font-size:24px;letter-spacing:-.03em;line-height:1.2;">Your audit request is with ${esc(tenant.founder.name)}</h1><p style="margin:0 0 16px;color:${COLORS.body};font-size:15px;line-height:1.65;">Hi ${esc(name)},</p><p style="margin:0 0 16px;color:${COLORS.body};font-size:15px;line-height:1.65;">Thanks for reaching out. ${esc(tenant.founder.name)} will review the company and reply personally within one business day with the best next step.</p><p style="margin:0 0 16px;color:${COLORS.body};font-size:15px;line-height:1.65;">When they reply, send back two times that work for you and they will schedule the conversation directly. You can also reply to this email now with anything else they should know.</p>${signalButton("See what we build", `${baseUrl()}/services`)}`,
  );
}

export function roiReportEmail(data: {
  name?: string;
  roiPercentage: number;
  additionalMonthlyRevenue: string;
  annualRevenueImpact: string;
  timeSavedPerWeek: string;
  paybackPeriodMonths: string;
}): string {
  const metricRows: Array<[string, string]> = [
    ["Projected ROI", `<strong>${Math.round(data.roiPercentage)}%</strong>`],
    ["Additional monthly revenue", `<strong>${esc(data.additionalMonthlyRevenue)}</strong>`],
    ["Annual revenue impact", `<strong>${esc(data.annualRevenueImpact)}</strong>`],
    ["Time saved / week", `<strong>${esc(data.timeSavedPerWeek)} hours</strong>`],
    ["Payback period", `<strong>${esc(data.paybackPeriodMonths)} months</strong>`],
  ];
  return emailWrapper(
    `<p style="margin:0 0 9px;color:#5c8518;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">Revenue analysis</p><h1 style="margin:0 0 16px;color:${COLORS.ink};font-size:24px;letter-spacing:-.03em;line-height:1.2;">Your AI Automation ROI Analysis</h1><p style="margin:0 0 16px;color:${COLORS.body};font-size:15px;line-height:1.65;">${data.name ? `Hi ${esc(data.name)},` : "Hi there,"}</p><p style="margin:0 0 20px;color:${COLORS.body};font-size:15px;line-height:1.65;">Here is a summary of your projected ROI with AI-powered automation:</p>${infoRows(metricRows)}<p style="margin:22px 0 8px;color:${COLORS.body};font-size:15px;line-height:1.65;">Want to see exactly how we would implement this for your business?</p>${signalButton("Book a free strategy call", `${baseUrl()}/contact`)}<p style="margin:20px 0 0;color:${COLORS.faint};font-size:12px;line-height:1.5;">These projections are estimates based on industry averages and the inputs you provided. Actual results vary depending on your market, competition, and execution.</p>`,
  );
}

export function adminContactNotificationEmail(formData: {
  name: string;
  email: string;
  phone?: string;
  businessType?: string;
  companyName?: string;
  companyWebsite?: string;
  primaryProblem?: string;
  message: string;
}): string {
  const rows: Array<[string, string]> = [
    ["Name", esc(formData.name)],
    [
      "Email",
      `<a href="mailto:${esc(formData.email)}" style="color:#5c8518;">${esc(formData.email)}</a>`,
    ],
  ];
  if (formData.phone) rows.push(["Phone", esc(formData.phone)]);
  if (formData.companyName) rows.push(["Company", esc(formData.companyName)]);
  if (formData.companyWebsite) rows.push(["Website", esc(formData.companyWebsite)]);
  if (formData.businessType) rows.push(["Business", esc(formData.businessType)]);
  if (formData.primaryProblem) rows.push(["Constraint", esc(formData.primaryProblem)]);
  return adminWrapper(
    `<p style="margin:0 0 9px;color:#5c8518;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">Contact request</p><h1 style="margin:0 0 20px;color:${COLORS.ink};font-size:24px;letter-spacing:-.03em;line-height:1.2;">A prospect sent a message</h1>${infoRows(rows)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr><td style="border-left:4px solid #a8d936;background-color:${COLORS.signalSoft};padding:16px 18px;color:${COLORS.body};font-size:14px;line-height:1.6;">${esc(formData.message).replace(/\n/g, "<br>")}</td></tr></table>${signalButton("Reply to lead", `mailto:${formData.email}`)}`,
  );
}
