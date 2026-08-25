import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const allRoutes = [
  "/admin/today", "/admin/pipeline", "/admin/conversations", "/admin/emails",
  "/admin/campaigns", "/admin/proposals", "/admin/email-sequences", "/admin/analytics",
  "/admin/revenue", "/admin/activity", "/admin/features", "/admin/ai", "/admin/ai-operations",
  "/admin/integrations", "/admin/setup", "/admin/settings", "/admin/leads", "/admin/contacts", "/admin/inbox",
  "/admin/bookings", "/admin/clients", "/admin/chat-leads", "/admin/subscribers",
  "/admin/content", "/admin/resources", "/admin/partners", "/admin/website-grades",
];
const routes = process.argv.includes("--chat")
  ? ["/admin/chat-leads"]
  : process.argv.includes("--ai")
    ? ["/admin/ai", "/admin/ai-operations"]
  : process.argv.includes("--today")
    ? ["/admin/today"]
  : process.argv.includes("--integrations")
    ? ["/admin/integrations"]
    : allRoutes;

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required for authenticated admin parity QA`);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({ type: "magiclink", email: process.env.ADMIN_EMAIL, options: { redirectTo: `${base}/auth/callback?next=/admin/today` } });
if (linkError || !linkData?.properties?.hashed_token) throw linkError || new Error("Could not generate a QA session");
const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: linkData.properties.hashed_token, type: "magiclink" });
if (verifyError || !verified.session) throw verifyError || new Error("Could not exchange a QA session");

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
const cookieKey = `sb-${projectRef}-auth-token`;
const cookies = cookieValue.length <= 3180
  ? [{ name: cookieKey, value: cookieValue }]
  : Array.from({ length: Math.ceil(cookieValue.length / 3180) }, (_, index) => ({ name: `${cookieKey}.${index}`, value: cookieValue.slice(index * 3180, (index + 1) * 3180) }));

const browser = await chromium.launch({ headless: true });
const failures = new Set();

async function verifyRoutes(viewport, label) {
  const context = await browser.newContext({ viewport, colorScheme: "light", reducedMotion: "reduce" });
  const origin = new URL(base);
  await context.addCookies(cookies.map((cookie) => ({ ...cookie, domain: origin.hostname, path: "/", httpOnly: false, secure: origin.protocol === "https:", sameSite: "Lax" })));
  const page = await context.newPage();
  await page.route("**/api/admin/notifications**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ notifications: [], unreadCount: 0 }) }));
  // Route parity validates shell/layout behavior independently of an unapplied
  // feature-batch migration. Runtime persistence has its own service and QA
  // contract; an empty conversation list keeps every admin route deterministic.
  await page.route("**/api/admin/revenue-os/ai/conversations**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ schemaReady: true, conversations: [] }) }));
  let activeRoute = "";
  page.on("console", (message) => {
    if (message.type() === "error") failures.add(`${label} ${activeRoute}: console ${message.text().split("\n")[0]}`);
  });
  page.on("pageerror", (error) => failures.add(`${label} ${activeRoute}: page ${error.message.split("\n")[0]}`));

  for (const route of routes) {
    activeRoute = route;
    const response = await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (!response || response.status() >= 500) failures.add(`${label} ${route}: HTTP ${response?.status() ?? "none"}`);
    await page.locator(".admin-shell").waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(120);
    const portalText = await page.locator("nextjs-portal").allTextContents();
    if (portalText.some((text) => /Build Error|Unhandled Runtime Error|Runtime TypeError|Compilation failed/i.test(text))) failures.add(`${label} ${route}: Next.js error overlay is present`);
    const state = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      dialogs: document.querySelectorAll('[role="dialog"]').length,
      mainVisible: Boolean(document.querySelector(".admin-main")),
      overflowers: [...document.querySelectorAll("body *")]
        .map((element) => ({ tag: element.tagName.toLowerCase(), classes: element.className, right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width), scrollWidth: element.scrollWidth }))
        .filter((item) => item.right > window.innerWidth + 2 && item.width > 0)
        .slice(0, 5),
      overflowChain: (() => {
        const chain = [];
        let element = document.querySelector("table.min-w-\\[720px\\]");
        while (element && chain.length < 6) {
          const style = getComputedStyle(element);
          chain.push({ tag: element.tagName.toLowerCase(), classes: element.className, width: Math.round(element.getBoundingClientRect().width), overflowX: style.overflowX, minWidth: style.minWidth });
          element = element.parentElement;
        }
        return chain;
      })(),
    }));
    if (!state.mainVisible) failures.add(`${label} ${route}: admin main region is missing`);
    if (state.width > state.viewport + 2) failures.add(`${label} ${route}: document overflow ${state.width}px > ${state.viewport}px; ${JSON.stringify(state.overflowers)}; chain ${JSON.stringify(state.overflowChain)}`);
    if (state.dialogs) failures.add(`${label} ${route}: ${state.dialogs} dialog(s) opened without an operator action`);
  }
  await context.close();
}

const onlyDesktop = process.argv.includes("--desktop");
const onlyMobile = process.argv.includes("--mobile");
if (!onlyMobile) await verifyRoutes({ width: 1440, height: 1000 }, "desktop");
if (!onlyDesktop) await verifyRoutes({ width: 390, height: 844 }, "mobile");
await browser.close();

if (failures.size) throw new Error(`Admin route parity failures:\n${[...failures].join("\n")}`);
console.log(`Admin route parity passed for ${routes.length} registered routes on ${onlyDesktop ? "desktop" : onlyMobile ? "mobile" : "desktop and mobile"}.`);
