import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tenant, analyticsDomain, fromEmail, siteUrl } from "../src/config/tenant";
import { contactConfirmationEmail, emailWrapper } from "../src/lib/email/templates";
import { emailComposeTemplates } from "../src/components/admin/EmailComposeModal";
import { hasScheduler } from "../src/lib/booking";

const originalBrand = { ...tenant.brand };
const originalFounder = { ...tenant.founder };
const originalCapabilities = { ...tenant.capabilities };
const originalAi = { ...tenant.ai };
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalFromEmail = process.env.RESEND_FROM_EMAIL;
const originalPlausible = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

let harborEmailHtml = "";
let harborCompose = "";

try {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.RESEND_FROM_EMAIL;
  delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  Object.assign(tenant.brand, {
    name: "Harbor Pipe Co",
    domain: "harborpipe.example",
    siteUrl: "https://harborpipe.example",
    accentColor: "#125e8a",
    tagline: "Plumbing operations",
    emailFooter: "Harbor Pipe Co · Practical plumbing systems",
  });
  Object.assign(tenant.founder, { name: "Mara", fullName: "Mara Chen", email: "mara@harborpipe.example" });
  Object.assign(tenant.ai, {
    businessDescriptor: "Harbor Pipe Co, a plumbing operations partner",
    voice: "Be practical and specific about pipes.",
    positioning: "Harbor Pipe Co helps plumbing companies run their dispatch.",
  });
  const html = emailWrapper("<p>Hello</p>");
  harborEmailHtml = html;
  assert.match(html, /Harbor Pipe Co/);
  assert.match(html, /harborpipe\.example/);
  assert.match(html, /#125e8a/);
  assert.match(html, /Plumbing operations/);
  assert.doesNotMatch(html, /Accelerate/);
  assert.doesNotMatch(html, /acceleratewith/);
  const confirmation = contactConfirmationEmail("Alex");
  assert.match(confirmation, /with Mara/);
  assert.match(confirmation, /Mara will review/);
  assert.doesNotMatch(confirmation, /John/);
  assert.match(fromEmail(), /Harbor Pipe Co <mara@harborpipe\.example>/);
  assert.equal(analyticsDomain(), "harborpipe.example");
  assert.equal(siteUrl(), "https://harborpipe.example");
  const compose = emailComposeTemplates().map((template) => template.body).join("\n");
  harborCompose = compose;
  assert.match(compose, /Mara\nHarbor Pipe Co/);
  assert.doesNotMatch(compose, /\bJohn\b/);
  assert.doesNotMatch(compose, /Accelerate/);
} finally {
  Object.assign(tenant.brand, originalBrand);
  Object.assign(tenant.founder, originalFounder);
  Object.assign(tenant.capabilities, originalCapabilities);
  Object.assign(tenant.ai, originalAi);
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  if (originalFromEmail === undefined) delete process.env.RESEND_FROM_EMAIL;
  else process.env.RESEND_FROM_EMAIL = originalFromEmail;
  if (originalPlausible === undefined) delete process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  else process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = originalPlausible;
}

assert.equal(tenant.brand.name, originalBrand.name, "tenant mutation in this test must be restored");

mkdirSync("/tmp/accelerate-tenant-rebrand", { recursive: true });
writeFileSync("/tmp/accelerate-tenant-rebrand/harbor-email.html", harborEmailHtml);

const chrome = readFileSync("src/components/admin/AdminShell.tsx", "utf8");
assert.match(chrome, /tenant\.brand\.name/);
assert.match(chrome, /tenant\.brand\.domain/);

const auth = readFileSync("src/components/admin/AdminAuthLayout.tsx", "utf8");
assert.match(auth, /tenant\.brand\.name/);

const copilot = readFileSync("src/lib/revenue-os/ai-agent.ts", "utf8");
assert.match(copilot, /tenant\.brand\.name/);
assert.match(copilot, /tenant\.ai\.voice/);

const chat = readFileSync("src/lib/chat/system-prompt.ts", "utf8");
assert.match(chat, /tenant\.brand\.name/);
assert.match(chat, /tenant\.ai\.positioning/);
assert.match(chat, /tenant\.founder\.name/);
assert.doesNotMatch(chat, /session with John/);

const booking = readFileSync("src/lib/booking.ts", "utf8");
assert.match(booking, /tenant\.capabilities\.publicBooking/);
assert.match(booking, /export function bookingMode/);
assert.equal(typeof hasScheduler(), "boolean");

assert.match(readFileSync("src/app/api/admin/revenue-os/campaigns/route.ts", "utf8"), /sender_name:[\s\S]*tenant\.brand\.name/);
const communications = readFileSync("src/lib/revenue-os/communications.ts", "utf8");
assert.match(communications, /tenantScopeForDatabase\(supabase\)/, "campaign unsubscribe links must resolve the database tenant scope");
assert.match(communications, /\/api\/public\/\$\{scope\.slug\}\/unsubscribe\//, "tenant campaign unsubscribe links must remain tenant-scoped");
assert.match(communications, /getTenantFromEmail\(supabase\)/, "the canonical sender must resolve the workspace sender identity");
assert.match(communications, /getTenantReplyToEmail\(supabase\)/, "campaign replies must resolve the workspace reply inbox");
assert.match(readFileSync("src/lib/email/resend.ts", "utf8"), /export async function getTenantFromEmail/, "tenant sender identity must be resolved at the provider boundary");
assert.match(readFileSync("src/lib/email/resend.ts", "utf8"), /export async function getTenantReplyToEmail/, "tenant reply routing must be resolved at the provider boundary");
assert.doesNotMatch(readFileSync("src/lib/revenue-os/campaigns.ts", "utf8"), /replyTo: campaign\.sender_email/, "campaign delivery identity must not silently become the reply inbox");
assert.match(readFileSync("src/lib/revenue-os/campaigns.ts", "utf8"), /getTenantReplyToEmail\(supabase\)/, "campaign activation must verify a monitored reply inbox before members become due");
assert.match(readFileSync("src/app/api/admin/tenant/providers/route.ts", "utf8"), /replyToEmail/, "provider configuration must collect a monitored workspace reply inbox");
assert.match(readFileSync("src/app/api/admin/plausible/route.ts", "utf8"), /analyticsDomain\(\)/);
assert.match(readFileSync("src/app/admin/setup/page.tsx", "utf8"), /tenant\.external\.vercelProjectUrl/);
assert.match(harborCompose, /Mara/);

for (const file of [
  "src/lib/email/templates.ts",
  "src/lib/chat/fallbacks.ts",
  "src/lib/chat/lead-capture.ts",
  "src/app/admin/setup/page.tsx",
  "src/components/admin/EmailComposeModal.tsx",
]) {
  const source = readFileSync(file, "utf8");
  assert.match(source, /tenant\.founder\.name/, `${file} must name the founder from config`);
  assert.doesNotMatch(source, /\bJohn\b/, `${file} still hard-codes the founder name`);
}

const ratchet = readFileSync("scripts/verify-agent-contract.mjs", "utf8");
assert.match(ratchet, /const BRAND_BUDGET = \{\n  \/\/ Empty on purpose/);
assert.match(ratchet, /src\/components\/admin/);
assert.doesNotMatch(ratchet, /BRAND_BUDGET = \{[\s\S]*?"src\//);

console.log(JSON.stringify({
  result: "passed",
  checks: [
    "email-chrome-rebrand",
    "founder-name-rebrand",
    "compose-signature-rebrand",
    "sender-and-analytics-rebrand",
    "admin-chrome-reads-tenant",
    "auth-chrome-reads-tenant",
    "copilot-persona-reads-tenant",
    "chat-persona-reads-tenant",
    "public-booking-capability",
    "campaign-sender-unsubscribe-plausible-setup-links",
    "empty-literal-budget",
    "admin-components-in-ratchet",
  ],
}, null, 2));
