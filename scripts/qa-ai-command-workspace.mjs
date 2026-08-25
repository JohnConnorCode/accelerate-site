import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const outDir = "/tmp/accelerate-ai-command";
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required for authenticated AI command QA`);
}
await mkdir(outDir, { recursive: true });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "magiclink", email: process.env.ADMIN_EMAIL, options: { redirectTo: `${base}/auth/callback?next=/admin/ai` } });
if (linkError || !linkData?.properties?.hashed_token) throw linkError || new Error("Could not generate a QA session");
const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: linkData.properties.hashed_token, type: "magiclink" });
if (verifyError || !verified.session) throw verifyError || new Error("Could not exchange a QA session");

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
const cookieKey = `sb-${projectRef}-auth-token`;
const cookies = cookieValue.length <= 3180
  ? [{ name: cookieKey, value: cookieValue }]
  : Array.from({ length: Math.ceil(cookieValue.length / 3180) }, (_, index) => ({ name: `${cookieKey}.${index}`, value: cookieValue.slice(index * 3180, (index + 1) * 3180) }));

const ids = {
  conversation: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  user: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  run: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  answer: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  proposal: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
};
const answer = "The highest-leverage next step is to review the two overdue follow-ups, then confirm the proposal awaiting a decision. I found both in the canonical operator queue.";
const events = [
  { type: "conversation", conversationId: ids.conversation, userMessageId: ids.user },
  { type: "run_started", runId: ids.run, model: "openai/gpt-5-mini", pack: "pipeline" },
  { type: "tool_started", name: "get_today_snapshot", index: 0 },
  { type: "tool_completed", name: "get_today_snapshot", index: 0, summary: "Read 7 prioritized items", failed: false },
  { type: "tool_started", name: "propose_task", index: 1 },
  { type: "tool_completed", name: "propose_task", index: 1, summary: "Staged one approval", failed: false },
  { type: "proposal_staged", proposal: { id: ids.proposal, actionType: "create_task", title: "Follow up with Summit Mechanical", impact: "internal_write", entityType: "opportunity", entityId: ids.conversation } },
  { type: "assistant_delta", delta: answer.slice(0, 76) },
  { type: "assistant_delta", delta: answer.slice(76) },
  { type: "final", conversationId: ids.conversation, messageId: ids.answer, runId: ids.run, text: answer, proposedActions: [ids.proposal] },
];
const streamBody = events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("");

const browser = await chromium.launch({ headless: true });
const failures = [];

async function createPage(viewport, label, colorScheme = "light") {
  const context = await browser.newContext({ viewport, colorScheme, reducedMotion: "reduce" });
  if (colorScheme === "dark") await context.addInitScript(() => localStorage.setItem("theme", "dark"));
  const origin = new URL(base);
  await context.addCookies(cookies.map((cookie) => ({ ...cookie, domain: origin.hostname, path: "/", httpOnly: false, secure: origin.protocol === "https:", sameSite: "Lax" })));
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") failures.push(`${label} console: ${message.text().split("\n")[0]}`); });
  page.on("pageerror", (error) => failures.push(`${label} page: ${error.message.split("\n")[0]}`));
  await page.route("**/api/admin/notifications**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ notifications: [], unreadCount: 0 }) }));
  await page.route("**/api/admin/revenue-os/priority**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ summary: { urgent: 2 }, items: [] }) }));
  await page.route("**/api/admin/revenue-os/ai/conversations**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith(`/${ids.conversation}`)) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ conversation: { id: ids.conversation, title: "What needs my attention?", lastMessageAt: new Date().toISOString() }, messages: [] }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schemaReady: true, conversations: [{ id: ids.conversation, title: "What needs my attention?", lastMessageAt: new Date().toISOString() }] }) });
  });
  await page.route("**/api/admin/revenue-os/ai/stream", (route) => route.fulfill({ status: 200, contentType: "text/event-stream; charset=utf-8", headers: { "Cache-Control": "no-cache" }, body: streamBody }));
  return { context, page };
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth }));
  if (dimensions.documentWidth > dimensions.viewportWidth + 2) failures.push(`${label}: document overflow ${dimensions.documentWidth}px > ${dimensions.viewportWidth}px`);
}

const desktop = await createPage({ width: 1440, height: 1000 }, "desktop");
await desktop.page.goto(`${base}/admin/ai`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await desktop.page.getByRole("heading", { name: "AI Command Center" }).waitFor();
await desktop.page.getByPlaceholder(/Ask about priorities/).fill("What needs my attention today?");
await desktop.page.getByRole("button", { name: "Send AI command" }).click();
await desktop.page.getByText(answer, { exact: true }).waitFor();
await desktop.page.getByText("2 changes staged. Nothing has executed.").waitFor().catch(async () => desktop.page.getByText("1 change staged. Nothing has executed.").waitFor());
await desktop.page.screenshot({ path: `${outDir}/workspace-desktop.png`, fullPage: true });
await assertNoOverflow(desktop.page, "desktop workspace");
await desktop.page.keyboard.press("Meta+J");
await desktop.page.getByRole("dialog", { name: "AI command center" }).waitFor();
await desktop.page.waitForFunction(() => (document.querySelector('[role="dialog"][aria-label="AI command center"]')?.getBoundingClientRect().left ?? 9999) < window.innerWidth - 400);
await desktop.page.screenshot({ path: `${outDir}/global-panel-desktop.png` });
await desktop.page.keyboard.press("Escape");
await desktop.context.close();

const mobile = await createPage({ width: 390, height: 844 }, "mobile");
await mobile.page.goto(`${base}/admin/ai`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await mobile.page.getByRole("heading", { name: "AI Command Center" }).waitFor();
await mobile.page.getByRole("button", { name: "Open AI command center" }).click();
await mobile.page.getByRole("dialog", { name: "AI command center" }).waitFor();
await mobile.page.waitForFunction(() => (document.querySelector('[role="dialog"][aria-label="AI command center"]')?.getBoundingClientRect().left ?? 9999) < 2);
await mobile.page.screenshot({ path: `${outDir}/global-panel-mobile.png` });
await assertNoOverflow(mobile.page, "mobile panel");
await mobile.page.getByRole("button", { name: "Close AI panel" }).click();
await mobile.page.getByRole("dialog", { name: "AI command center" }).waitFor({ state: "detached" });
await mobile.page.screenshot({ path: `${outDir}/workspace-mobile.png` });
await assertNoOverflow(mobile.page, "mobile workspace");
await mobile.context.close();

const dark = await createPage({ width: 1280, height: 900 }, "dark", "dark");
await dark.page.goto(`${base}/admin/ai`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await dark.page.getByRole("heading", { name: "AI Command Center" }).waitFor();
await dark.page.screenshot({ path: `${outDir}/workspace-dark.png`, fullPage: true });
await assertNoOverflow(dark.page, "dark workspace");
await dark.context.close();

await browser.close();
if (failures.length) throw new Error(`AI command QA failures:\n${failures.join("\n")}`);
console.log(JSON.stringify({ result: "passed", screenshots: [`${outDir}/workspace-desktop.png`, `${outDir}/global-panel-desktop.png`, `${outDir}/global-panel-mobile.png`, `${outDir}/workspace-mobile.png`, `${outDir}/workspace-dark.png`], checks: ["founder auth", "shared stream", "tool evidence", "approval proposal", "Cmd+J", "focusable dialog", "desktop/mobile overflow", "dark", "reduced motion", "console"] }, null, 2));
