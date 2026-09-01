import { siteUrl } from "@/config/tenant";
import { getResend, FROM_EMAIL, ADMIN_EMAIL } from "./resend";
import { resolveEmailTemplate } from "./runtime-template";

export async function sendPlanEmail(
  name: string,
  email: string,
  summary: string,
  shareToken: string,
) {
  const planUrl = `${siteUrl()}/plan/${shareToken}`;
  const [prospectEmail, adminEmail] = await Promise.all([
    resolveEmailTemplate("plan-confirmation", { name, planSummary: summary, planLink: planUrl }),
    resolveEmailTemplate("admin-lead", {
      name,
      email,
      industry: "via Solution Generator",
      phone: "",
      business: "",
    }),
  ]);

  await Promise.all([
    getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: prospectEmail.subject,
      text: prospectEmail.text,
      html: prospectEmail.html,
    }),
    getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: adminEmail.subject,
      text: adminEmail.text,
      html: adminEmail.html,
    }),
  ]);
}

export async function sendContactEmail(formData: {
  name: string;
  email: string;
  phone?: string;
  businessType?: string;
  companyName?: string;
  companyWebsite?: string;
  primaryProblem?: string;
  message: string;
}) {
  const [confirmation, alert] = await Promise.all([
    resolveEmailTemplate("contact-confirmation", { name: formData.name }),
    resolveEmailTemplate("admin-contact", {
      name: formData.name,
      email: formData.email,
      phone: formData.phone || "",
      businessType: formData.businessType || "",
      companyName: formData.companyName || "",
      companyWebsite: formData.companyWebsite || "",
      primaryProblem: formData.primaryProblem || "",
      message: formData.message,
    }),
  ]);
  await Promise.all([
    getResend().emails.send({
      from: FROM_EMAIL,
      to: formData.email,
      replyTo: ADMIN_EMAIL,
      subject: confirmation.subject,
      text: confirmation.text,
      html: confirmation.html,
    }),
    getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      replyTo: formData.email,
      subject: alert.subject,
      text: alert.text,
      html: alert.html,
    }),
  ]);
}

export async function sendRoiReportEmail(
  email: string,
  data: {
    name?: string;
    roiPercentage: number;
    additionalMonthlyRevenue: string;
    annualRevenueImpact: string;
    timeSavedPerWeek: string;
    paybackPeriodMonths: string;
  },
) {
  const resolved = await resolveEmailTemplate("roi-report", {
    name: data.name || "there",
    roiPercentage: String(Math.round(data.roiPercentage)),
    additionalMonthlyRevenue: data.additionalMonthlyRevenue,
    annualRevenueImpact: data.annualRevenueImpact,
    timeSavedPerWeek: data.timeSavedPerWeek,
    paybackPeriodMonths: data.paybackPeriodMonths,
  });
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: resolved.subject,
    text: resolved.text,
    html: resolved.html,
  });
}

export async function sendAdminNotification(
  subject: string,
  leadData: {
    name: string;
    email: string;
    phone?: string;
    business?: string;
    industry: string;
  },
) {
  const resolved = await resolveEmailTemplate("admin-lead", {
    name: leadData.name,
    email: leadData.email,
    phone: leadData.phone || "",
    business: leadData.business || "",
    industry: leadData.industry,
  });
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: subject || resolved.subject,
    text: resolved.text,
    html: resolved.html,
  });
}
