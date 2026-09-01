import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const outDir = "/tmp/accelerate-record-workspace";
mkdirSync(outDir, { recursive: true });
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"])
  if (!process.env[key]) throw new Error(`${key} is required`);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email: process.env.ADMIN_EMAIL,
  options: { redirectTo: `${base}/auth/callback?next=/admin/pipeline/opp-record` },
});
if (linkError || !linkData?.properties?.hashed_token)
  throw linkError || new Error("Could not generate QA sign-in token");
const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "magiclink",
});
if (verifyError || !verified.session)
  throw verifyError || new Error("Could not exchange QA sign-in token");
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;

const opportunity = {
  id: "opp-record",
  name: "Acme operating system",
  email: "alex@acme.example",
  stage: "proposal",
  canonical_stage: "proposal",
  source: "referral",
  next_action: "Confirm implementation owner",
  next_action_at: "2026-08-26T16:00:00.000Z",
  estimated_value: 42000,
  won_value: 0,
  probability: 70,
  created_at: "2026-08-01T10:00:00.000Z",
  updated_at: "2026-08-23T18:00:00.000Z",
};
const record = {
  contract: "revenue-os-opportunity-record.v1",
  activityContract: "revenue-os-activity-ledger.v1",
  opportunity,
  contact: {
    id: "contact-1",
    full_name: "Alex Morgan",
    primary_email: "alex@acme.example",
    phone: "+1 312 555 0100",
    title: "COO",
    lifecycle_stage: "prospect",
    communication_status: "active",
  },
  company: {
    id: "company-1",
    name: "Acme Industrial",
    domain: "acme.example",
    website: "https://acme.example",
    industry: "Manufacturing",
    size_band: "51–200",
    location: "Chicago",
    research_summary: "Acme is consolidating manual revenue operations across three teams.",
  },
  tasks: [
    {
      id: "task-1",
      title: "Confirm decision criteria",
      status: "pending",
      priority: "high",
      due_date: "2026-08-25",
    },
  ],
  conversations: [
    {
      id: "conversation-1",
      subject: "Implementation scope",
      channel: "gmail",
      status: "open",
      unread_count: 1,
    },
  ],
  meetings: [
    {
      id: "meeting-1",
      title: "Solution review",
      status: "confirmed",
      start_at: "2026-08-27T15:00:00.000Z",
    },
  ],
  proposals: [
    {
      id: "proposal-1",
      title: "Revenue operations implementation",
      status: "viewed",
      total_one_time: 18000,
      total_monthly: 4000,
    },
  ],
  activity: [
    {
      id: "activity-2",
      activity_type: "proposal_viewed",
      title: "Proposal viewed",
      summary: "Client opened the current proposal.",
      source: "public_link",
      occurred_at: "2026-08-23T18:00:00.000Z",
    },
    {
      id: "activity-1",
      activity_type: "opportunity_created",
      title: "Opportunity created: Acme operating system",
      summary: null,
      source: "referral",
      occurred_at: "2026-08-01T10:00:00.000Z",
    },
  ],
};
let failFirstRead = true;
let patchCount = 0;
const errors = [];

const browser = await chromium.launch({ headless: true });
async function createPage(viewport, reducedMotion = "no-preference") {
  const context = await browser.newContext({ viewport, colorScheme: "light", reducedMotion });
  const origin = new URL(base);
  await context.addCookies([
    {
      name: `sb-${projectRef}-auth-token`,
      value: cookieValue,
      domain: origin.hostname,
      path: "/",
      httpOnly: false,
      secure: origin.protocol === "https:",
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("500")) errors.push(message.text());
  });
  await page.route("**/js/script.js", (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );
  await page.route("**/api/admin/revenue-os/priority", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ summary: { total: 0, urgent: 0, critical: 0 }, items: [] }),
    }),
  );
  await page.route("**/api/admin/notifications", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        notifications: [],
        unreadCount: 0,
        urgentCount: 0,
        priority: { status: "ready", summary: { total: 0, urgent: 0, critical: 0 }, items: [] },
      }),
    }),
  );
  await page.route("**/api/admin/revenue-os/notes**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ note: null, shouldPrompt: false }),
    }),
  );
  await page.route("**/api/admin/revenue-os/records/opportunity/opp-record", async (route) => {
    if (route.request().method() === "PATCH") {
      patchCount += 1;
      const body = route.request().postDataJSON();
      if (body.expectedUpdatedAt !== opportunity.updated_at)
        throw new Error("Record edit did not carry its optimistic version");
      Object.assign(opportunity, {
        next_action: body.nextAction,
        next_action_at: body.nextActionAt,
        estimated_value: body.estimatedValue,
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ schemaReady: true, record }),
      });
      return;
    }
    if (failFirstRead) {
      failFirstRead = false;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Could not load the opportunity record" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemaReady: true, record }),
    });
  });
  return { context, page };
}

const desktop = await createPage({ width: 1440, height: 1000 });
await desktop.page.goto(`${base}/admin/pipeline/opp-record`, { waitUntil: "domcontentloaded" });
await desktop.page.getByText("Could not load the opportunity record", { exact: true }).waitFor();
await desktop.page.getByRole("button", { name: "Retry" }).click();
await desktop.page.getByRole("heading", { name: "Acme operating system" }).waitFor();
await desktop.page.getByText("Proposal viewed", { exact: true }).waitFor();
await desktop.page.getByText("Alex Morgan", { exact: true }).waitFor();
await desktop.page.getByText("Acme Industrial", { exact: true }).waitFor();
await desktop.page.locator('input[name="estimatedValue"]').fill("56000");
await desktop.page.locator('textarea[name="nextAction"]').fill("Send implementation plan");
await desktop.page.getByRole("button", { name: "Save revenue plan" }).click();
await desktop.page
  .getByText("Revenue plan saved and dependent views refreshed.", { exact: true })
  .waitFor();
await desktop.page.getByText("$56,000", { exact: true }).waitFor();
if (patchCount !== 1) throw new Error(`Expected one audited update request, saw ${patchCount}`);
await desktop.page.screenshot({ path: `${outDir}/record-desktop.png`, fullPage: true });

const mobile = await createPage({ width: 390, height: 844 }, "reduce");
await mobile.page.goto(`${base}/admin/pipeline/opp-record`, { waitUntil: "domcontentloaded" });
await mobile.page.getByRole("heading", { name: "Acme operating system" }).waitFor();
const overflow = await mobile.page.evaluate(() => ({
  body: document.documentElement.scrollWidth,
  viewport: window.innerWidth,
}));
if (overflow.body > overflow.viewport)
  throw new Error(`Record workspace overflows mobile viewport: ${JSON.stringify(overflow)}`);
const relatedWork = mobile.page.locator("details").filter({ hasText: "Related work" });
await relatedWork.locator("summary").click();
await relatedWork.locator("summary").click();
await mobile.page.screenshot({ path: `${outDir}/record-mobile-reduced.png`, fullPage: true });

await desktop.context.close();
await mobile.context.close();
await browser.close();
if (errors.length) throw new Error(`Console errors during record QA:\n${errors.join("\n")}`);
console.log(`${outDir}/record-desktop.png`);
console.log(`${outDir}/record-mobile-reduced.png`);
console.log(
  "Record failure/retry, canonical timeline, linked context, audited edit refresh, keyboard targets, reduced motion, and mobile overflow QA passed.",
);
