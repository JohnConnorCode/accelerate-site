import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const outDir = "/tmp/accel-shots";
mkdirSync(outDir, { recursive: true });

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required for authenticated Today QA`);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "magiclink", email: process.env.ADMIN_EMAIL, options: { redirectTo: `${base}/auth/callback?next=/admin/today` } });
if (linkError || !linkData?.properties?.hashed_token) throw linkError || new Error("Could not generate a QA sign-in token");
const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: linkData.properties.hashed_token, type: "magiclink" });
if (verifyError || !verified.session) throw verifyError || new Error("Could not exchange the QA sign-in token");

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
const cookies = [{ name: `sb-${projectRef}-auth-token`, value: cookieValue }];
const overview = {
  schemaReady: true,
  generatedAt: "2026-08-16T12:00:00.000Z",
  metrics: { openOpportunities: 12, pipelineValue: 185000, weightedValue: 82400, wonRevenue: 42000, unreadConversations: 4, activeCampaigns: 2, pendingProposals: 3 },
  queue: [
    { id: "conversation:1", kind: "reply", title: "Apex Roofing needs a proposal revision", summary: "2 unread messages · buying", urgency: "high", dueAt: "2026-08-16T08:00:00.000Z", priorityReason: "Buying signal needs a reply", href: "/admin/conversations?thread=1" },
    { id: "task:1", kind: "task", title: "Confirm discovery call objectives", summary: "Capture decision makers and desired outcomes before Monday.", urgency: "critical", dueAt: "2026-08-15", priorityReason: "Overdue commitment", href: "/admin/pipeline?opportunity=1" },
    { id: "action:1", kind: "approval", title: "Approve follow-up to Summit Mechanical", summary: "A concise, founder-reviewed response is ready to send.", urgency: "high", dueAt: "2026-08-16T09:00:00.000Z", priorityReason: "Approval required before execution", href: "/admin/today?focus=approvals" },
    { id: "proposal:1", kind: "proposal", title: "Westlake automation proposal", summary: "Viewed and awaiting a response.", urgency: "normal", dueAt: "2026-08-21T12:00:00.000Z", priorityReason: "Proposal expires within seven days", href: "/admin/proposals" },
  ],
  integrations: [],
  health: {
    status: "attention", attentionCount: 1,
    integrations: [{ provider: "gmail", status: "connected", lastSuccessAt: "2026-08-16T10:00:00.000Z", lastError: null }],
    sourceRuns: [{ key: "gmail-sync", status: "success", startedAt: "2026-08-16T10:00:00.000Z", finishedAt: "2026-08-16T10:01:00.000Z", error: null }],
    jobRuns: [{ key: "campaign-sends", status: "partial", startedAt: "2026-08-16T09:00:00.000Z", finishedAt: "2026-08-16T09:01:00.000Z", error: "One recipient needs review" }],
  },
};
const actions = { actions: [{ id: "1", action_type: "send_email", title: "Approve follow-up to Summit Mechanical", description: "A concise, founder-reviewed response is ready to send.", urgency: "high", reasoning: null, status: "pending", created_at: "2026-08-16T09:00:00.000Z" }] };
const aiRuns = { schemaReady: true, feedback: { helpful: 3, notHelpful: 1 }, runs: [{ id: "qa-agent-run", surface: "admin_command", model: "claude-haiku", status: "completed", tool_names: ["get_today_snapshot", "propose_task"], input_tokens: 720, output_tokens: 190, result_preview: "Focus first on the overdue discovery-call commitment, then reply to Apex Roofing.", error: null, started_at: "2026-08-16T10:00:00.000Z", finished_at: "2026-08-16T10:00:04.000Z", feedback: "helpful" }] };
const analytics = { schemaReady: true, windowDays: 30, cohort: "Opportunities created in the selected window and their current furthest stage.", funnel: { opportunities: 24, qualified: 15, meetings: 9, proposals: 5, won: 3, wonRevenue: 42000, pipelineValue: 185000 }, rates: { qualified: 62.5, meeting: 60, proposal: 55.6, win: 60, inquiryToWin: 12.5 }, attribution: { missing: 2 }, sources: [{ source: "Google", opportunities: 10, won: 2, revenue: 30000 }, { source: "Direct", opportunities: 8, won: 1, revenue: 12000 }], web: { status: "ready", pageViews: 320, visitors: 186, conversions: 24, conversionRate: 7.5, topPages: [{ label: "/", count: 110 }, { label: "/services", count: 65 }], sources: [{ label: "google", count: 120 }, { label: "Direct / unknown", count: 86 }], conversionEvents: [{ label: "contact_form_submitted", count: 12 }, { label: "strategy_call_cta_clicked", count: 8 }], eventCount: 344, lastCapturedAt: "2026-08-16T12:00:00.000Z" } };
let mutableQueue = [...overview.queue];

const browser = await chromium.launch({ headless: true });
const errors = [];
async function pageFor(viewport) {
  const context = await browser.newContext({ viewport, colorScheme: "light", deviceScaleFactor: 1 });
  const origin = new URL(base);
  await context.addCookies(cookies.map((cookie) => ({ ...cookie, domain: origin.hostname, path: "/", httpOnly: false, secure: origin.protocol === "https:", sameSite: "Lax" })));
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`); });
  // The production analytics proxy intentionally has no local provider during QA.
  // Stub it so the test continues to fail on product-console errors, not telemetry setup.
  await page.route("**/js/script.js", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await page.route("**/api/admin/revenue-os/overview", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...overview, queue: mutableQueue }) }));
  await page.route("**/api/admin/revenue-os/actions", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(actions) }));
  await page.route("**/api/admin/revenue-os/ai", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "Focus first on the overdue discovery-call commitment, then reply to Apex Roofing.", runId: "qa-agent-run" }) }));
  await page.route("**/api/admin/revenue-os/ai/feedback", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) }));
  await page.route("**/api/admin/revenue-os/ai/runs", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(aiRuns) }));
  await page.route("**/api/admin/revenue-os/analytics?days=*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(analytics) }));
  await page.route("**/api/admin/revenue-os/tasks", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "complete") mutableQueue = mutableQueue.filter((item) => item.id !== `task:${body.id}`);
    if (body.action === "snooze") mutableQueue = mutableQueue.filter((item) => item.id !== `task:${body.id}`);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ task: { id: body.id, status: body.action === "complete" ? "completed" : "snoozed" } }) });
  });
  return { context, page };
}

const desktop = await pageFor({ width: 1440, height: 1000 });
await desktop.page.goto(`${base}/admin/today`, { waitUntil: "networkidle", timeout: 60_000 });
await desktop.page.getByRole("heading", { name: "Today", exact: true }).waitFor();
await desktop.page.getByText("Apex Roofing needs a proposal revision", { exact: true }).waitFor();
await desktop.page.getByRole("button", { name: "Replies" }).click();
await desktop.page.getByText("Apex Roofing needs a proposal revision", { exact: true }).waitFor();
if (await desktop.page.getByText("Westlake automation proposal", { exact: true }).count()) throw new Error("Reply focus did not filter the operator queue");
await desktop.page.getByRole("button", { name: "All work" }).click();
await desktop.page.screenshot({ path: `${outDir}/today-command-center-desktop.png`, fullPage: true });
await desktop.page.getByRole("button", { name: "Complete Confirm discovery call objectives" }).click();
await desktop.page.getByText("Confirm discovery call objectives", { exact: true }).waitFor({ state: "detached" });
await desktop.page.getByPlaceholder("Ask about pipeline, replies, campaigns, or next actions…").fill("What should I do next?");
await desktop.page.getByRole("button", { name: "Send command" }).click();
await desktop.page.getByText("Focus first on the overdue discovery-call commitment, then reply to Apex Roofing.", { exact: true }).waitFor();
await desktop.page.getByRole("button", { name: "Mark response helpful" }).click();
await desktop.page.screenshot({ path: `${outDir}/today-command-center-feedback.png`, fullPage: true });
await desktop.page.goto(`${base}/admin/ai-operations`, { waitUntil: "networkidle", timeout: 60_000 });
await desktop.page.getByRole("heading", { name: "AI Operations", exact: true }).waitFor();
await desktop.page.getByText("Recent agent decisions", { exact: true }).waitFor();
await desktop.page.screenshot({ path: `${outDir}/ai-operations-desktop.png`, fullPage: true });
await desktop.page.goto(`${base}/admin/analytics`, { waitUntil: "networkidle", timeout: 60_000 });
await desktop.page.getByRole("heading", { name: "Analytics", exact: true }).waitFor();
await desktop.page.getByText("Traffic and conversion signals", { exact: true }).waitFor();
await desktop.page.getByText("Source to revenue", { exact: true }).waitFor();
await desktop.page.screenshot({ path: `${outDir}/analytics-command-center-desktop.png`, fullPage: true });

const mobile = await pageFor({ width: 390, height: 844 });
await mobile.page.goto(`${base}/admin/today`, { waitUntil: "networkidle", timeout: 60_000 });
await mobile.page.getByRole("heading", { name: "Today", exact: true }).waitFor();
await mobile.page.getByRole("button", { name: "Proposals" }).click();
await mobile.page.getByText("Westlake automation proposal", { exact: true }).waitFor();
await mobile.page.screenshot({ path: `${outDir}/today-command-center-mobile.png`, fullPage: true });
await mobile.page.goto(`${base}/admin/analytics`, { waitUntil: "networkidle", timeout: 60_000 });
await mobile.page.getByRole("heading", { name: "Analytics", exact: true }).waitFor();
await mobile.page.getByText("Top landing pages", { exact: true }).waitFor();
await mobile.page.screenshot({ path: `${outDir}/analytics-command-center-mobile.png`, fullPage: true });

await desktop.context.close();
await mobile.context.close();
await browser.close();
if (errors.length) throw new Error(`Console errors during Today QA:\n${errors.join("\n")}`);
console.log(`${outDir}/today-command-center-desktop.png`);
console.log(`${outDir}/today-command-center-mobile.png`);
console.log(`${outDir}/today-command-center-feedback.png`);
console.log(`${outDir}/ai-operations-desktop.png`);
console.log(`${outDir}/analytics-command-center-desktop.png`);
console.log(`${outDir}/analytics-command-center-mobile.png`);
console.log("Today command-center desktop/mobile render and focus-filter QA passed.");
