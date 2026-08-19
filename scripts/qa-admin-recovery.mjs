import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const outDir = "/tmp/accel-shots";
mkdirSync(outDir, { recursive: true });

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required for authenticated admin recovery QA`);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "magiclink", email: process.env.ADMIN_EMAIL, options: { redirectTo: `${base}/auth/callback?next=/admin/emails` } });
if (linkError || !linkData?.properties?.hashed_token) throw linkError || new Error("Could not generate QA session");
const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: linkData.properties.hashed_token, type: "magiclink" });
if (verifyError || !verified.session) throw verifyError || new Error("Could not exchange QA session");
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
const cookieKey = `sb-${projectRef}-auth-token`;
const cookies = cookieValue.length <= 3180
  ? [{ name: cookieKey, value: cookieValue }]
  : Array.from({ length: Math.ceil(cookieValue.length / 3180) }, (_, index) => ({ name: `${cookieKey}.${index}`, value: cookieValue.slice(index * 3180, (index + 1) * 3180) }));

const emailList = [
  { id: "contact-confirmation", name: "Contact confirmation", description: "Confirms a revenue-leak audit request.", category: "Transactional", subject: "Your audit request", variables: ["name"], hasDraft: false, source: "built_in", updatedAt: null },
  { id: "manual-audit-followup-1", name: "Manual Audit Followup · Email 1", description: "Immediate sequence message.", category: "Automated sequences", subject: "We received your request", delayDays: 0, variables: ["name"], hasDraft: true, source: "published", updatedAt: "2026-08-16T12:00:00.000Z" },
];
let detail = {
  schemaReady: true, id: "contact-confirmation", name: "Contact confirmation", description: "Confirms a revenue-leak audit request.", category: "Transactional", variables: ["name"], subjectTemplate: "Your audit request — Accelerate", bodyTemplate: "Hi {{name}},\n\nJohn will review your company and reply personally.", previewText: "", subject: "Your audit request — Accelerate", html: "<!doctype html><html><body style='margin:0;background:#0a0a0a;color:#eee;font-family:Arial;padding:40px'><div style='max-width:560px;margin:auto;background:#151515;padding:32px;border-radius:14px'><h1>Your request is with John</h1><p style='line-height:1.7;color:#bbb'>John will review your company and reply personally.</p></div></body></html>", source: "built_in", hasDraft: false, updatedAt: null,
};
const sentHistory = [{ id: "legacy:1", to: "sarah@example.com", toName: "Sarah", subject: "A practical next step", body: "Hi Sarah,\n\nI reviewed the company and found the first place to focus.", status: "sent", providerId: "resend_qa_1", template: "plan-review", sentAt: "2026-08-16T12:00:00.000Z", source: "operator" }];

const browser = await chromium.launch({ headless: true });
const errors = [];
async function contextFor(viewport, reducedMotion = "no-preference", colorScheme = "light") {
  const context = await browser.newContext({ viewport, colorScheme, reducedMotion });
  if (colorScheme === "dark") await context.addInitScript(() => localStorage.setItem("theme", "dark"));
  const origin = new URL(base);
  await context.addCookies(cookies.map((cookie) => ({ ...cookie, domain: origin.hostname, path: "/", httpOnly: false, secure: origin.protocol === "https:", sameSite: "Lax" })));
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`); });
  await page.route("**/api/admin/emails/preview**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "PATCH") {
      const body = request.postDataJSON();
      detail = { ...detail, subjectTemplate: body.subjectTemplate, bodyTemplate: body.bodyTemplate, subject: body.subjectTemplate, hasDraft: true, source: "draft" };
      emailList[0] = { ...emailList[0], hasDraft: true };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    }
    if (request.method() === "POST") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, to: process.env.ADMIN_EMAIL }) });
    if (request.method() === "DELETE") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(url.searchParams.get("id") ? detail : { schemaReady: true, emails: emailList }) });
  });
  await page.route("**/api/admin/emails/history**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ history: sentHistory }) }));
  await page.route("**/api/admin/notifications**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ notifications: [], unreadCount: 0 }) }));
  await page.route("**/api/admin/send-email", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) }));
  await page.route("**/api/admin/revenue-os/pipeline**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schemaReady: true, opportunities: [] }) }));
  await page.route("**/api/admin/revenue-os/campaigns**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schemaReady: true, campaigns: [] }) }));
  await page.route("**/api/admin/leads**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ leads: [], total: 0, totalPages: 1 }) }));
  await page.route("**/api/admin/content**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) }));
  await page.route("**/api/admin/contacts/timeline**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    email: "sarah@example.com",
    timeline: [{ type: "opportunity", title: "Pipeline: Sarah Co", description: "Stage: qualified · Next: Send audit", timestamp: "2026-08-16T12:00:00.000Z", sourceId: "opp-1", link: "/admin/pipeline?search=sarah%40example.com" }],
    canonical: { schemaReady: true, status: "connected", contact: { id: "contact-1", full_name: "Sarah Owner", lifecycle_stage: "prospect", communication_status: "active", next_action: "Send audit", next_action_at: "2026-08-17" }, company: { id: "company-1", name: "Sarah Co", domain: "example.com", industry: "services" }, opportunities: [{ id: "opp-1", stage: "qualified", estimated_value: 5000, won_value: 0 }] },
  }) }));
  return { context, page };
}

async function assertDialogFits(page, viewport) {
  const box = await page.getByRole("dialog").boundingBox();
  if (!box || box.x < 0 || box.y < 0 || box.x + box.width > viewport.width || box.y + box.height > viewport.height) throw new Error(`Dialog is outside the ${viewport.width}x${viewport.height} viewport`);
}

const desktop = await contextFor({ width: 1440, height: 1000 });
await desktop.page.goto(`${base}/admin/emails`, { waitUntil: "networkidle", timeout: 60_000 });
await desktop.page.getByRole("heading", { name: "Email Studio", exact: true }).waitFor();
await desktop.page.getByText("Contact confirmation", { exact: true }).first().waitFor();
await desktop.page.screenshot({ path: `${outDir}/admin-email-studio-desktop.png`, fullPage: true });

// Client-side admin navigation must retain the application shell. A pathname-
// keyed root transition would replace this element and replay its entrance
// animation, which presents to operators as a flashing side navigation.
await desktop.page.evaluate(() => { window.__adminSidebarForQa = document.querySelector("[data-admin-sidebar]"); });
await desktop.page.getByRole("link", { name: "Campaigns", exact: true }).click();
await desktop.page.getByRole("heading", { name: "Campaigns", exact: true }).waitFor();
const sidebarPersistedAcrossNavigation = await desktop.page.evaluate(() =>
  window.__adminSidebarForQa === document.querySelector("[data-admin-sidebar]"),
);
if (!sidebarPersistedAcrossNavigation) throw new Error("Admin sidebar remounted during client-side navigation");
await desktop.page.getByRole("link", { name: "Email Studio", exact: true }).click();
await desktop.page.getByRole("heading", { name: "Email Studio", exact: true }).waitFor();

await desktop.page.getByRole("button", { name: "Collapse sidebar" }).click();
await desktop.page.getByRole("button", { name: "Expand sidebar" }).waitFor();
await desktop.page.waitForTimeout(360);
await desktop.page.screenshot({ path: `${outDir}/admin-sidebar-collapsed.png`, fullPage: true });
await desktop.page.getByRole("button", { name: "Expand sidebar" }).click();

await desktop.page.getByRole("button", { name: "Edit" }).click();
await desktop.page.getByLabel("Subject", { exact: true }).fill("Updated audit request — Accelerate");
await desktop.page.getByRole("button", { name: "Save draft" }).click();
await desktop.page.getByText("draft", { exact: true }).waitFor();
await desktop.page.getByRole("button", { name: "Publish" }).click();
await desktop.page.getByRole("heading", { name: "Publish this email draft?" }).waitFor();
const dialogBox = await desktop.page.getByRole("dialog").boundingBox();
if (!dialogBox || dialogBox.x < 0 || dialogBox.y < 0 || dialogBox.x + dialogBox.width > 1440 || dialogBox.y + dialogBox.height > 1000) throw new Error("Publish dialog is outside the desktop viewport");
await desktop.page.screenshot({ path: `${outDir}/admin-email-publish-dialog.png`, fullPage: true });
await desktop.page.keyboard.press("Escape");

await desktop.page.getByRole("heading", { name: "Publish this email draft?" }).waitFor({ state: "detached" });

await desktop.page.getByRole("button", { name: "Compose" }).click();
await desktop.page.getByRole("heading", { name: "Compose email" }).waitFor();
await desktop.page.getByLabel("To", { exact: true }).fill("qa@example.com");
await desktop.page.screenshot({ path: `${outDir}/admin-compose-dialog.png`, fullPage: true });
await desktop.page.keyboard.press("Escape");

await desktop.page.getByRole("tab", { name: "Sent history" }).click();
await desktop.page.getByText("sarah@example.com", { exact: true }).click();
await desktop.page.getByText("Provider receipt resend_qa_1", { exact: true }).waitFor();
await desktop.page.screenshot({ path: `${outDir}/admin-sent-history.png`, fullPage: true });

await desktop.page.keyboard.press("Meta+k");
await desktop.page.getByRole("dialog", { name: "Admin command palette" }).waitFor();
await assertDialogFits(desktop.page, { width: 1440, height: 1000 });
await desktop.page.keyboard.press("Escape");

await desktop.page.goto(`${base}/admin/pipeline`, { waitUntil: "networkidle" });
await desktop.page.getByRole("button", { name: "New opportunity" }).click();
await desktop.page.getByRole("heading", { name: "New opportunity" }).waitFor();
await assertDialogFits(desktop.page, { width: 1440, height: 1000 });
await desktop.page.keyboard.press("Escape");

await desktop.page.goto(`${base}/admin/campaigns`, { waitUntil: "networkidle" });
await desktop.page.getByRole("button", { name: "New campaign" }).click();
await desktop.page.getByRole("heading", { name: "Create campaign draft" }).waitFor();
await assertDialogFits(desktop.page, { width: 1440, height: 1000 });
await desktop.page.keyboard.press("Escape");

await desktop.page.goto(`${base}/admin/leads`, { waitUntil: "networkidle" });
await desktop.page.getByRole("button", { name: "New Lead" }).click();
await desktop.page.getByRole("heading", { name: "Add New Lead" }).waitFor();
await assertDialogFits(desktop.page, { width: 1440, height: 1000 });
await desktop.page.keyboard.press("Escape");

await desktop.page.goto(`${base}/admin/content`, { waitUntil: "networkidle" });
await desktop.page.getByRole("button", { name: "New Content" }).click();
await desktop.page.getByRole("heading", { name: "New Content", exact: true }).waitFor();
await assertDialogFits(desktop.page, { width: 1440, height: 1000 });
await desktop.page.keyboard.press("Escape");

await desktop.page.goto(`${base}/admin/contacts/sarah%40example.com`, { waitUntil: "networkidle" });
await desktop.page.getByText("Revenue OS connected", { exact: true }).waitFor();
await desktop.page.getByRole("link", { name: /Open in Pipeline/ }).click();
await desktop.page.waitForURL(/\/admin\/pipeline\?search=sarah%40example\.com/);
await desktop.page.getByPlaceholder("Search company, person, or email").waitFor();
if (await desktop.page.getByPlaceholder("Search company, person, or email").inputValue() !== "sarah@example.com") throw new Error("Pipeline deep-link did not restore the contact search");

const mobile = await contextFor({ width: 390, height: 844 });
await mobile.page.goto(`${base}/admin/emails`, { waitUntil: "networkidle", timeout: 60_000 });
await mobile.page.getByRole("heading", { name: "Email Studio", exact: true }).waitFor();
await mobile.page.getByRole("button", { name: "Open navigation" }).click();
await mobile.page.getByRole("complementary").getByRole("link", { name: "Email Studio", exact: true }).waitFor();
await mobile.page.getByRole("button", { name: "Close navigation" }).click();
await mobile.page.getByRole("button", { name: "Close navigation" }).waitFor({ state: "detached" });
await mobile.page.screenshot({ path: `${outDir}/admin-email-studio-mobile.png`, fullPage: true });
await mobile.page.getByRole("button", { name: "Compose" }).click();
await mobile.page.getByRole("heading", { name: "Compose email" }).waitFor();
await assertDialogFits(mobile.page, { width: 390, height: 844 });
await mobile.page.keyboard.press("Escape");
await mobile.page.goto(`${base}/admin/contacts/sarah%40example.com`, { waitUntil: "networkidle" });
await mobile.page.getByText("Revenue OS connected", { exact: true }).waitFor();
const mobileOverflow = await mobile.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
if (mobileOverflow > 1) throw new Error(`Contact command view overflows mobile by ${mobileOverflow}px`);
await mobile.page.screenshot({ path: `${outDir}/admin-contact-command-mobile.png`, fullPage: true });

const reduced = await contextFor({ width: 1280, height: 800 }, "reduce");
await reduced.page.goto(`${base}/admin/emails`, { waitUntil: "networkidle", timeout: 60_000 });
await reduced.page.getByRole("heading", { name: "Email Studio", exact: true }).waitFor();

const dark = await contextFor({ width: 1280, height: 800 }, "no-preference", "dark");
await dark.page.goto(`${base}/admin/emails`, { waitUntil: "networkidle", timeout: 60_000 });
await dark.page.getByRole("heading", { name: "Email Studio", exact: true }).waitFor();
await dark.page.getByRole("button", { name: "Compose" }).click();
await dark.page.getByRole("heading", { name: "Compose email" }).waitFor();
await assertDialogFits(dark.page, { width: 1280, height: 800 });
await dark.page.screenshot({ path: `${outDir}/admin-compose-dialog-dark.png`, fullPage: true });

await desktop.context.close();
await mobile.context.close();
await reduced.context.close();
await dark.context.close();
await browser.close();
if (errors.length) throw new Error(`Console/server errors during admin recovery QA:\n${errors.join("\n")}`);
console.log(`${outDir}/admin-email-studio-desktop.png`);
console.log(`${outDir}/admin-sidebar-collapsed.png`);
console.log(`${outDir}/admin-email-publish-dialog.png`);
console.log(`${outDir}/admin-compose-dialog.png`);
console.log(`${outDir}/admin-sent-history.png`);
console.log(`${outDir}/admin-email-studio-mobile.png`);
console.log(`${outDir}/admin-compose-dialog-dark.png`);
console.log(`${outDir}/admin-contact-command-mobile.png`);
console.log("Admin shell, responsive sidebar, Email Studio, canonical contact handoff, history, and modal QA passed.");
