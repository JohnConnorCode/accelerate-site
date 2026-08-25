import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const outDir = "/tmp/accelerate-analytics-workspace";
mkdirSync(outDir, { recursive: true });
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) if (!process.env[key]) throw new Error(`${key} is required`);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "magiclink", email: process.env.ADMIN_EMAIL, options: { redirectTo: `${base}/auth/callback?next=/admin/analytics` } });
if (linkError || !linkData?.properties?.hashed_token) throw linkError || new Error("Could not create sign-in token");
const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: linkData.properties.hashed_token, type: "magiclink" });
if (verifyError || !verified.session) throw verifyError || new Error("Could not exchange sign-in token");
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookies = [{ name: `sb-${projectRef}-auth-token`, value: `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}` }];
const errors = [];
const browser = await chromium.launch({ headless: true });

const responseFor = (url) => {
  const params = new URL(url).searchParams;
  const filtered = params.get("source") === "Referral";
  return {
    schemaReady: true, windowDays: Number(params.get("days") || 30),
    cohort: `Opportunities created in the last ${params.get("days") || 30} days, filtered by current record fields. Funnel steps show the furthest stage each selected opportunity has reached.`,
    funnel: { opportunities: filtered ? 4 : 24, qualified: filtered ? 3 : 15, meetings: filtered ? 2 : 9, proposals: filtered ? 1 : 5, won: filtered ? 1 : 3, wonRevenue: filtered ? 12000 : 42000, pipelineValue: filtered ? 36000 : 185000 },
    rates: { qualified: 62.5, meeting: 60, proposal: 55.6, win: 60, inquiryToWin: filtered ? 25 : 12.5 },
    attribution: { missing: filtered ? 0 : 2 }, forecast: { weightedPipeline: filtered ? 17400 : 78250, unweightedPipeline: filtered ? 36000 : 185000, method: "Open estimated value multiplied by each opportunity's recorded probability. This is a planning estimate, not booked revenue." },
    communication: { status: "ready", inboundConversations: filtered ? 3 : 12, repliedConversations: filtered ? 3 : 9, replyRate: filtered ? 100 : 75, medianResponseHours: filtered ? 1.5 : 3.2 },
    quality: { missingAttribution: filtered ? 0 : 2, missingOwner: filtered ? 0 : 3, missingNextAction: filtered ? 1 : 5, unrecognizedStage: 0, impossibleStageSequences: 0 },
    filterOptions: { sources: ["Referral", "Website"], owners: ["founder@acceleratewith.us", "Unassigned"], campaigns: ["August outreach", "Unassigned"], stages: ["qualified", "proposal", "won"] },
    appliedFilters: { source: params.get("source"), owner: params.get("owner"), campaign: params.get("campaign"), stage: params.get("stage") },
    sources: filtered ? [{ source: "Referral", opportunities: 4, won: 1, revenue: 12000 }] : [{ source: "Referral", opportunities: 4, won: 1, revenue: 12000 }, { source: "Website", opportunities: 20, won: 2, revenue: 30000 }],
    web: { status: "ready", pageViews: 320, visitors: 186, conversions: 24, engagementEvents: 75, conversionRate: 7.5, topPages: [{ label: "/", count: 110 }], sources: [{ label: "google", count: 120 }], conversionEvents: [{ label: "contact form submitted", count: 12 }], eventCount: 344, lastCapturedAt: "2026-08-24T12:00:00Z" },
  };
};

async function makePage(viewport, reducedMotion = "no-preference") {
  const context = await browser.newContext({ viewport, colorScheme: "light", reducedMotion });
  const origin = new URL(base);
  await context.addCookies(cookies.map((cookie) => ({ ...cookie, domain: origin.hostname, path: "/", secure: origin.protocol === "https:", httpOnly: false, sameSite: "Lax" })));
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`); });
  await page.route("**/js/script.js", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await page.route("**/api/admin/revenue-os/analytics**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(responseFor(route.request().url())) }));
  await page.route("**/api/admin/revenue-os/priority", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ summary: { urgent: 0 }, items: [] }) }));
  await page.route("**/api/admin/notifications", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ notifications: [], unreadCount: 0, urgentCount: 0 }) }));
  await page.route("**/api/admin/revenue-os/notes**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ note: null, shouldPrompt: false }) }));
  await page.route("**/api/admin/revenue-os/ai/conversations**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ conversations: [] }) }));
  return { context, page };
}

const desktop = await makePage({ width: 1440, height: 1000 });
await desktop.page.goto(`${base}/admin/analytics`, { waitUntil: "domcontentloaded" });
await desktop.page.getByRole("heading", { name: "Analytics", exact: true }).waitFor();
await desktop.page.getByText("$78,250", { exact: true }).waitFor();
await desktop.page.getByText("$42,000", { exact: true }).first().waitFor();
await desktop.page.getByLabel("Source").selectOption("Referral");
await desktop.page.getByText("$17,400", { exact: true }).waitFor();
await desktop.page.getByText("100%", { exact: true }).first().waitFor();
await desktop.page.getByLabel("Owner").selectOption("founder@acceleratewith.us");
await desktop.page.getByRole("button", { name: /Clear 2 filters/ }).waitFor();
await desktop.page.screenshot({ path: `${outDir}/analytics-decision-layer-desktop.png`, fullPage: true });
await desktop.page.reload({ waitUntil: "domcontentloaded" });
if (await desktop.page.getByLabel("Source").inputValue() !== "Referral") throw new Error("Analytics source filter did not persist");
if (await desktop.page.getByLabel("Owner").inputValue() !== "founder@acceleratewith.us") throw new Error("Analytics owner filter did not persist");
await desktop.page.getByRole("button", { name: /Clear 2 filters/ }).click();
await desktop.page.getByText("$78,250", { exact: true }).waitFor();

const mobile = await makePage({ width: 390, height: 844 }, "reduce");
await mobile.page.goto(`${base}/admin/analytics`, { waitUntil: "domcontentloaded" });
await mobile.page.getByRole("heading", { name: "Analytics", exact: true }).waitFor();
const overflow = await mobile.page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
if (overflow.scroll > overflow.client) throw new Error(`Analytics escaped mobile viewport: ${JSON.stringify(overflow)}`);
await mobile.page.screenshot({ path: `${outDir}/analytics-decision-layer-mobile.png`, fullPage: true });

await desktop.context.close(); await mobile.context.close(); await browser.close();
if (errors.length) throw new Error(`Analytics QA errors:\n${errors.join("\n")}`);
console.log(`${outDir}/analytics-decision-layer-desktop.png`);
console.log(`${outDir}/analytics-decision-layer-mobile.png`);
console.log("Analytics filters, persistence, facts-vs-forecast, reply evidence, data quality, reduced motion, and mobile containment passed.");
