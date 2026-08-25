import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const outDir = "/tmp/accel-shots";
mkdirSync(outDir, { recursive: true });

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required for authenticated Pipeline QA`);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "magiclink", email: process.env.ADMIN_EMAIL, options: { redirectTo: `${base}/auth/callback?next=/admin/pipeline` } });
if (linkError || !linkData?.properties?.hashed_token) throw linkError || new Error("Could not generate a Pipeline QA sign-in token");
const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: linkData.properties.hashed_token, type: "magiclink" });
if (verifyError || !verified.session) throw verifyError || new Error("Could not exchange the Pipeline QA sign-in token");

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
const cookies = [{ name: `sb-${projectRef}-auth-token`, value: cookieValue }];
const stages = ["new", "contacted", "qualified", "meeting", "proposal", "negotiation", "won", "lost", "nurture"];
let opportunities = Array.from({ length: 27 }, (_, index) => {
  const stage = stages[index % stages.length];
  const company = index === 4 ? "Acme Industrial" : `Company ${String(index + 1).padStart(2, "0")}`;
  return {
    id: `opp-${index + 1}`,
    name: `${company} automation program`,
    email: `operator${index + 1}@example.com`,
    stage,
    canonical_stage: stage,
    estimated_value: 8000 + index * 1750,
    won_value: stage === "won" ? 8000 + index * 1750 : 0,
    probability: stage === "won" ? 100 : 35,
    next_action: index % 3 === 0 ? "Confirm decision criteria and implementation owner" : "Prepare the next grounded follow-up",
    next_action_at: new Date(Date.UTC(2026, 7, 24 + (index % 5), 15, 0)).toISOString(),
    owner_email: index % 2 ? "founder@acceleratewith.us" : null,
    last_activity_at: new Date(Date.UTC(2026, 7, index % 4 === 0 ? 1 : 20, 15, 0)).toISOString(),
    next_meeting_at: index % 6 === 0 ? new Date(Date.UTC(2026, 7, 27, 15, 0)).toISOString() : null,
    closed_at: stage === "won" ? new Date(Date.UTC(2026, 7, 20, 15, 0)).toISOString() : null,
    updated_at: new Date(Date.UTC(2026, 7, 22, 15, 0)).toISOString(),
    source: index % 2 ? "referral" : "website",
    created_at: new Date(Date.UTC(2026, 7, 1 + index)).toISOString(),
    contact: { full_name: `Operator ${index + 1}`, primary_email: `operator${index + 1}@example.com`, phone: null, title: index % 2 ? "Founder" : "Operations lead" },
    company: { name: company, domain: `company${index + 1}.example`, industry: index % 2 ? "Professional services" : "Manufacturing", website: null },
  };
});
let rejectNextTransition = true;
const errors = [];

const browser = await chromium.launch({ headless: true });
async function pageFor(viewport, reducedMotion = "no-preference") {
  const context = await browser.newContext({ viewport, colorScheme: "light", deviceScaleFactor: 1, reducedMotion });
  const origin = new URL(base);
  await context.addCookies(cookies.map((cookie) => ({ ...cookie, domain: origin.hostname, path: "/", httpOnly: false, secure: origin.protocol === "https:", sameSite: "Lax" })));
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("status of 409 (Conflict)")) errors.push(message.text()); });
  page.on("response", (response) => { if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`); });
  await page.route("**/js/script.js", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await page.route("**/api/admin/revenue-os/priority", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ generatedAt: new Date().toISOString(), summary: { total: 0, urgent: 0, critical: 0 }, items: [] }) }));
  await page.route("**/api/admin/notifications", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ notifications: [], unreadCount: 0, urgentCount: 0, priority: { status: "ready", summary: { total: 0, urgent: 0, critical: 0 }, items: [] } }) }));
  await page.route("**/api/admin/revenue-os/notes**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ note: null, shouldPrompt: false }) }));
  await page.route("**/api/admin/revenue-os/ai/conversations**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ conversations: [] }) }));
  await page.route("**/api/admin/revenue-os/pipeline**", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      if (rejectNextTransition) {
        rejectNextTransition = false;
        await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "Resolve the qualification requirement before moving this opportunity." }) });
        return;
      }
      opportunities = opportunities.map((item) => item.id === body.id ? { ...item, stage: body.stage, canonical_stage: body.stage } : item);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ opportunity: opportunities.find((item) => item.id === body.id) }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schemaReady: true, signalsReady: { calendar: true }, opportunities }) });
  });
  return { context, page };
}

const desktop = await pageFor({ width: 1440, height: 1000 });
await desktop.page.goto(`${base}/admin/pipeline`, { waitUntil: "domcontentloaded" });
await desktop.page.getByRole("heading", { name: "Pipeline", exact: true }).waitFor();
await desktop.page.getByLabel("Canonical opportunity stage board").waitFor();
await desktop.page.getByRole("heading", { name: "New", exact: true }).waitFor();
await desktop.page.getByRole("heading", { name: "Negotiation", exact: true }).waitFor();
await desktop.page.getByText("Acme Industrial automation program", { exact: true }).waitFor();
await desktop.page.getByRole("button", { name: /At risk/ }).click();
if (await desktop.page.locator("[data-opportunity-id]").count() < 1) throw new Error("At-risk operator view did not surface quiet opportunities");
await desktop.page.getByRole("button", { name: /^All\s/ }).click();
await desktop.page.getByLabel("Filter by owner").selectOption("founder@acceleratewith.us");
if (await desktop.page.locator("[data-opportunity-id]").count() !== 13) throw new Error("Owner view did not narrow to founder-owned opportunities");
await desktop.page.getByLabel("Filter by owner").selectOption("all");
await desktop.page.getByRole("button", { name: "Customize" }).click();
await desktop.page.getByRole("button", { name: "Owner" }).click();
await desktop.page.getByRole("button", { name: "Done" }).click();
await desktop.page.getByRole("button", { name: "Save view" }).click();
await desktop.page.getByLabel("View name").fill("Founder review");
await desktop.page.getByRole("button", { name: "Save view", exact: true }).last().click();
await desktop.page.getByRole("button", { name: "Founder review", exact: true }).waitFor();
await desktop.page.screenshot({ path: `${outDir}/pipeline-stage-board-desktop.png` });

await desktop.page.getByPlaceholder("Search company, person, or email").fill("Acme Industrial");
await desktop.page.getByText("Acme Industrial automation program", { exact: true }).waitFor();
if (await desktop.page.locator("[data-opportunity-id]").count() !== 1) throw new Error("Pipeline board search did not narrow to one canonical opportunity");
await desktop.page.getByPlaceholder("Search company, person, or email").fill("");
await desktop.page.getByLabel("Filter by stage").selectOption("proposal");
if (await desktop.page.locator("section[aria-labelledby='pipeline-stage-proposal'] [data-opportunity-id]").count() !== 3) throw new Error("Stage filter did not preserve the expected realistic-data count");
await desktop.page.getByLabel("Filter by stage").selectOption("all");

const firstStage = desktop.page.getByLabel("Stage for Company 01 automation program");
await firstStage.selectOption("qualified");
await desktop.page.getByText("Resolve the qualification requirement before moving this opportunity.", { exact: true }).waitFor();
if (await firstStage.inputValue() !== "new") throw new Error("A rejected transition changed the canonical stage in the UI");
await firstStage.selectOption("qualified");
await desktop.page.locator("section[aria-labelledby='pipeline-stage-qualified'] [data-opportunity-id='opp-1']").waitFor();

await desktop.page.getByRole("button", { name: "List view" }).click();
await desktop.page.getByRole("columnheader", { name: "Opportunity" }).waitFor();
await desktop.page.reload({ waitUntil: "domcontentloaded" });
await desktop.page.getByRole("columnheader", { name: "Opportunity" }).waitFor();
await desktop.page.getByRole("button", { name: "Founder review", exact: true }).waitFor();
await desktop.page.getByRole("button", { name: "Board view" }).click();

await desktop.page.goto(`${base}/admin/pipeline?opportunity=opp-5`, { waitUntil: "domcontentloaded" });
await desktop.page.locator("[data-opportunity-id='opp-5']").waitFor();
if (await desktop.page.locator("[data-opportunity-id]").count() !== 1) throw new Error("Deep-linked opportunity did not resolve to the exact canonical record");

const mobile = await pageFor({ width: 390, height: 844 }, "reduce");
await mobile.page.goto(`${base}/admin/pipeline`, { waitUntil: "domcontentloaded" });
const mobileBoard = mobile.page.getByLabel("Canonical opportunity stage board");
await mobileBoard.waitFor();
const mobileOverflow = await mobileBoard.evaluate((board) => {
  return { boardClient: board.clientWidth, boardScroll: board.scrollWidth, viewport: window.innerWidth };
});
if (mobileOverflow.boardClient > mobileOverflow.viewport || mobileOverflow.boardScroll <= mobileOverflow.boardClient) throw new Error(`Pipeline board did not contain horizontal navigation: ${JSON.stringify(mobileOverflow)}`);
await mobileBoard.evaluate((board) => {
  board.scrollLeft = 0;
  window.scrollTo({ top: board.getBoundingClientRect().top + window.scrollY - 150, behavior: "instant" });
});
await mobile.page.waitForTimeout(150);
await mobile.page.screenshot({ path: `${outDir}/pipeline-stage-board-mobile.png` });
await mobile.page.getByRole("button", { name: "List view" }).click();
await mobile.page.locator("article[data-opportunity-id]").first().waitFor();
const documentOverflow = await mobile.page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
if (documentOverflow.scroll > documentOverflow.client) throw new Error(`Mobile list escaped the viewport: ${JSON.stringify(documentOverflow)}`);
await mobile.page.screenshot({ path: `${outDir}/pipeline-list-mobile.png`, fullPage: true });

await desktop.context.close();
await mobile.context.close();
await browser.close();
if (errors.length) throw new Error(`Console errors during Pipeline QA:\n${errors.join("\n")}`);
console.log(`${outDir}/pipeline-stage-board-desktop.png`);
console.log(`${outDir}/pipeline-stage-board-mobile.png`);
console.log(`${outDir}/pipeline-list-mobile.png`);
console.log("Pipeline canonical board, list persistence, record deep-link, transition validation, search/filter, realistic-volume, and mobile overflow QA passed.");
