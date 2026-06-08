import { getResend, FROM_EMAIL, ADMIN_EMAIL } from "./resend";
import {
  planConfirmationEmail,
  adminLeadNotificationEmail,
  contactConfirmationEmail,
  adminContactNotificationEmail,
  roiReportEmail,
} from "./templates";

export async function sendPlanEmail(
  name: string,
  email: string,
  summary: string,
  shareToken: string
) {
  const planUrl = `https://www.acceleratewith.us/plan/${shareToken}`;

  await Promise.all([
    getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Your AI Growth Plan Is Ready, ${name}`,
      html: planConfirmationEmail(name, summary, planUrl),
    }),
    getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `New Lead: ${name}`,
      html: adminLeadNotificationEmail({
        name,
        email,
        industry: "via Solution Generator",
      }),
    }),
  ]);
}

export async function sendContactEmail(formData: {
  name: string;
  email: string;
  phone?: string;
  businessType?: string;
  message: string;
}) {
  await Promise.all([
    getResend().emails.send({
      from: FROM_EMAIL,
      to: formData.email,
      subject: "We received your message - Accelerate",
      html: contactConfirmationEmail(formData.name),
    }),
    getResend().emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `Contact Form: ${formData.name}`,
      html: adminContactNotificationEmail(formData),
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
  }
) {
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Your ROI Analysis: ${Math.round(data.roiPercentage)}% Projected Return`,
    html: roiReportEmail(data),
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
  }
) {
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject,
    html: adminLeadNotificationEmail(leadData),
  });
}
