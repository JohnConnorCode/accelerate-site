import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const outDir = "/tmp/accelerate-integration-catalog";
mkdirSync(outDir, { recursive: true });

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required for authenticated integration QA`);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "magiclink", email: process.env.ADMIN_EMAIL, options: { redirectTo: `${base}/auth/callback?next=/admin/integrations` } });
if (linkError || !linkData?.properties?.hashed_token) throw linkError || new Error("Could not generate a QA session");
const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: linkData.properties.hashed_token, type: "magiclink" });
if (verifyError || !verified.session) throw verifyError || new Error("Could not exchange a QA session");

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
const cookieKey = `sb-${projectRef}-auth-token`;
const cookieParts = cookieValue.length <= 3180
  ? [{ name: cookieKey, value: cookieValue }]
  : Array.from({ length: Math.ceil(cookieValue.length / 3180) }, (_, index) => ({ name: `${cookieKey}.${index}`, value: cookieValue.slice(index * 3180, (index + 1) * 3180) }));

const browser = await chromium.launch({ headless: true });
const failures = [];

async function openCatalog(viewport, label, colorScheme = "light", reducedMotion = "reduce") {
  const context = await browser.newContext({ viewport, colorScheme, reducedMotion });
  const origin = new URL(base);
  await context.addCookies(cookieParts.map((cookie) => ({ ...cookie, domain: origin.hostname, path: "/", httpOnly: false, secure: origin.protocol === "https:", sameSite: "Lax" })));
  if (colorScheme === "dark") await context.addInitScript(() => localStorage.setItem("theme", "dark"));
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") failures.push(`${label}: console ${message.text().split("\n")[0]}`); });
  page.on("pageerror", (error) => failures.push(`${label}: page ${error.message.split("\n")[0]}`));
  page.on("response", (response) => { if (response.status() >= 500) failures.push(`${label}: ${response.status()} ${response.url()}`); });
  await page.route("**/api/admin/notifications**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ notifications: [], unreadCount: 0 }) }));
  const response = await page.goto(`${base}/admin/integrations`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  if (!response || response.status() >= 500) failures.push(`${label}: HTTP ${response?.status() ?? "none"}`);
  await page.getByRole("heading", { name: "Integrations", exact: true }).waitFor();
  await page.getByText("Google Workspace", { exact: true }).waitFor();
  await page.getByText(/Registry revenue-os-integrations\.v1/).waitFor();
  await page.waitForTimeout(250);
  const layout = await page.evaluate(() => ({ documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, openDialogs: document.querySelectorAll('[role="dialog"]').length }));
  if (layout.documentWidth > layout.viewportWidth + 2) failures.push(`${label}: document overflow ${layout.documentWidth}px > ${layout.viewportWidth}px`);
  if (layout.openDialogs) failures.push(`${label}: dialog opened without an operator action`);
  return { context, page };
}

const desktop = await openCatalog({ width: 1440, height: 1000 }, "desktop");
await desktop.page.screenshot({ path: `${outDir}/integrations-desktop.png`, fullPage: true });
await desktop.page.getByRole("tab", { name: /Planned/ }).focus();
await desktop.page.keyboard.press("Enter");
await desktop.page.getByText("Microsoft 365", { exact: true }).waitFor();
await desktop.page.getByText("Supabase", { exact: true }).waitFor({ state: "detached" });
await desktop.page.getByText("Microsoft 365", { exact: true }).locator("xpath=ancestor::div[contains(@class,'admin-surface')]").getByText("Operating contract").click();
await desktop.page.getByText("Microsoft data maps to the same canonical services as Google; it does not create a parallel CRM.").waitFor();
await desktop.page.screenshot({ path: `${outDir}/integrations-planned-contract.png`, fullPage: true });

const mobile = await openCatalog({ width: 390, height: 844 }, "mobile");
await mobile.page.screenshot({ path: `${outDir}/integrations-mobile.png`, fullPage: true });
await mobile.page.getByPlaceholder("Search tools or capabilities").fill("Stripe");
await mobile.page.getByText("Stripe", { exact: true }).waitFor();
await mobile.page.getByText("Google Workspace", { exact: true }).waitFor({ state: "detached" });
await mobile.page.screenshot({ path: `${outDir}/integrations-mobile-search.png`, fullPage: true });

const dark = await openCatalog({ width: 1280, height: 800 }, "dark", "dark", "no-preference");
await dark.page.screenshot({ path: `${outDir}/integrations-dark.png`, fullPage: true });

await desktop.context.close();
await mobile.context.close();
await dark.context.close();
await browser.close();

if (failures.length) throw new Error(`Integration catalog QA failures:\n${failures.join("\n")}`);
console.log(JSON.stringify({ result: "passed", screenshots: [`${outDir}/integrations-desktop.png`, `${outDir}/integrations-planned-contract.png`, `${outDir}/integrations-mobile.png`, `${outDir}/integrations-mobile-search.png`, `${outDir}/integrations-dark.png`], checks: ["authenticated load", "desktop", "mobile", "dark", "reduced motion", "keyboard filter", "contract disclosure", "search", "overflow", "console"] }, null, 2));
