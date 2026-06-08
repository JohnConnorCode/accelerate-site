const BASE_URL = "https://www.acceleratewith.us";

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0A0A;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="padding:0 0 30px 0;">
          <a href="${BASE_URL}" style="font-size:24px;font-weight:bold;background:linear-gradient(135deg,#D4AF37,#F5D060,#E8D5A3);-webkit-background-clip:text;-webkit-text-fill-color:transparent;text-decoration:none;">Accelerate</a>
        </td></tr>
        <!-- Content -->
        <tr><td style="background-color:#111111;border-radius:12px;padding:32px;border:1px solid rgba(255,255,255,0.08);">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:30px 0 0 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.38);">
            Accelerate | AI Strategy &amp; Systems for Small Business<br>
            <a href="${BASE_URL}" style="color:rgba(255,255,255,0.38);">acceleratewith.us</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function goldButton(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#D4AF37,#F5D060,#E8D5A3);color:#000000;font-weight:600;font-size:14px;text-decoration:none;border-radius:8px;margin:16px 0;">${text}</a>`;
}

export function planConfirmationEmail(
  name: string,
  summary: string,
  planUrl: string
): string {
  return emailWrapper(`
    <h1 style="margin:0 0 16px 0;font-size:22px;color:rgba(255,255,255,0.93);">Your Growth Plan Is Ready</h1>
    <p style="margin:0 0 16px 0;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
      Hi ${esc(name)},
    </p>
    <p style="margin:0 0 16px 0;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
      Your personalized AI growth plan has been generated. Here is a quick summary:
    </p>
    <div style="background-color:#0A0A0A;border-radius:8px;padding:16px;margin:16px 0;border-left:3px solid #D4AF37;">
      <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.65);line-height:1.6;">${esc(summary)}</p>
    </div>
    <p style="margin:0 0 8px 0;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
      View your full plan with detailed recommendations, implementation roadmap, and ROI projections:
    </p>
    ${goldButton("View Your Growth Plan", planUrl)}
    <p style="margin:24px 0 0 0;font-size:13px;color:rgba(255,255,255,0.38);">
      This link is unique to you and can be shared with your team.
    </p>
  `);
}

export function adminLeadNotificationEmail(leadData: {
  name: string;
  email: string;
  phone?: string;
  business?: string;
  industry: string;
}): string {
  return emailWrapper(`
    <h1 style="margin:0 0 16px 0;font-size:22px;color:rgba(255,255,255,0.93);">New Lead Submitted</h1>
    <table style="width:100%;font-size:14px;color:rgba(255,255,255,0.65);" cellpadding="4">
      <tr><td style="color:rgba(255,255,255,0.38);width:100px;">Name</td><td>${esc(leadData.name)}</td></tr>
      <tr><td style="color:rgba(255,255,255,0.38);">Email</td><td><a href="mailto:${esc(leadData.email)}" style="color:#F5D060;">${esc(leadData.email)}</a></td></tr>
      ${leadData.phone ? `<tr><td style="color:rgba(255,255,255,0.38);">Phone</td><td>${esc(leadData.phone)}</td></tr>` : ""}
      ${leadData.business ? `<tr><td style="color:rgba(255,255,255,0.38);">Business</td><td>${esc(leadData.business)}</td></tr>` : ""}
      <tr><td style="color:rgba(255,255,255,0.38);">Industry</td><td style="text-transform:capitalize;">${esc(leadData.industry.replace(/_/g, " "))}</td></tr>
    </table>
    ${goldButton("View in Admin Dashboard", `${BASE_URL}/admin/leads`)}
  `);
}

export function contactConfirmationEmail(name: string): string {
  return emailWrapper(`
    <h1 style="margin:0 0 16px 0;font-size:22px;color:rgba(255,255,255,0.93);">We Got Your Message</h1>
    <p style="margin:0 0 16px 0;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
      Hi ${esc(name)},
    </p>
    <p style="margin:0 0 16px 0;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
      Thanks for reaching out to Accelerate. We have received your message and will get back to you within 24 hours.
    </p>
    <p style="margin:0 0 16px 0;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
      In the meantime, you can get a free AI-powered growth plan for your business:
    </p>
    ${goldButton("Get Your Free Growth Plan", `${BASE_URL}/plan-builder`)}
  `);
}

export function roiReportEmail(data: {
  name?: string;
  roiPercentage: number;
  additionalMonthlyRevenue: string;
  annualRevenueImpact: string;
  timeSavedPerWeek: string;
  paybackPeriodMonths: string;
}): string {
  return emailWrapper(`
    <h1 style="margin:0 0 16px 0;font-size:22px;color:rgba(255,255,255,0.93);">Your AI Automation ROI Analysis</h1>
    <p style="margin:0 0 16px 0;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
      ${data.name ? `Hi ${esc(data.name)},` : "Hi there,"}
    </p>
    <p style="margin:0 0 24px 0;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
      Here is a summary of your projected ROI with AI-powered automation:
    </p>
    <table style="width:100%;font-size:14px;color:rgba(255,255,255,0.65);border-collapse:collapse;" cellpadding="0">
      <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
        <td style="padding:12px 0;color:rgba(255,255,255,0.38);">Projected ROI</td>
        <td style="padding:12px 0;text-align:right;font-weight:bold;color:#F5D060;">${Math.round(data.roiPercentage)}%</td>
      </tr>
      <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
        <td style="padding:12px 0;color:rgba(255,255,255,0.38);">Additional Monthly Revenue</td>
        <td style="padding:12px 0;text-align:right;font-weight:bold;color:rgba(255,255,255,0.93);">${data.additionalMonthlyRevenue}</td>
      </tr>
      <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
        <td style="padding:12px 0;color:rgba(255,255,255,0.38);">Annual Revenue Impact</td>
        <td style="padding:12px 0;text-align:right;font-weight:bold;color:rgba(255,255,255,0.93);">${data.annualRevenueImpact}</td>
      </tr>
      <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
        <td style="padding:12px 0;color:rgba(255,255,255,0.38);">Time Saved / Week</td>
        <td style="padding:12px 0;text-align:right;font-weight:bold;color:rgba(255,255,255,0.93);">${data.timeSavedPerWeek} hours</td>
      </tr>
      <tr>
        <td style="padding:12px 0;color:rgba(255,255,255,0.38);">Payback Period</td>
        <td style="padding:12px 0;text-align:right;font-weight:bold;color:rgba(255,255,255,0.93);">${data.paybackPeriodMonths} months</td>
      </tr>
    </table>
    <p style="margin:24px 0 8px 0;font-size:15px;color:rgba(255,255,255,0.65);line-height:1.6;">
      Want to see exactly how we would implement this for your business?
    </p>
    ${goldButton("Get Your Custom Growth Plan", `${BASE_URL}/plan-builder`)}
    <p style="margin:24px 0 0 0;font-size:12px;color:rgba(255,255,255,0.38);line-height:1.5;">
      These projections are estimates based on industry averages and the inputs you provided. Actual results vary depending on your market, competition, and execution.
    </p>
  `);
}

export function adminContactNotificationEmail(formData: {
  name: string;
  email: string;
  phone?: string;
  businessType?: string;
  message: string;
}): string {
  return emailWrapper(`
    <h1 style="margin:0 0 16px 0;font-size:22px;color:rgba(255,255,255,0.93);">New Contact Form Submission</h1>
    <table style="width:100%;font-size:14px;color:rgba(255,255,255,0.65);" cellpadding="4">
      <tr><td style="color:rgba(255,255,255,0.38);width:100px;">Name</td><td>${esc(formData.name)}</td></tr>
      <tr><td style="color:rgba(255,255,255,0.38);">Email</td><td><a href="mailto:${esc(formData.email)}" style="color:#F5D060;">${esc(formData.email)}</a></td></tr>
      ${formData.phone ? `<tr><td style="color:rgba(255,255,255,0.38);">Phone</td><td>${esc(formData.phone)}</td></tr>` : ""}
      ${formData.businessType ? `<tr><td style="color:rgba(255,255,255,0.38);">Business</td><td>${esc(formData.businessType)}</td></tr>` : ""}
    </table>
    <div style="background-color:#0A0A0A;border-radius:8px;padding:16px;margin:16px 0;border-left:3px solid #D4AF37;">
      <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.65);line-height:1.6;">${esc(formData.message)}</p>
    </div>
    ${goldButton("Reply to Lead", `mailto:${esc(formData.email)}`)}
  `);
}
