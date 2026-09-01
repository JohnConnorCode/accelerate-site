import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const shellOutput = "/tmp/accelerate-admin-shell-qa";
mkdirSync(shellOutput, { recursive: true });
const allRoutes = [
  "/admin/today",
  "/admin/pipeline",
  "/admin/conversations",
  "/admin/emails",
  "/admin/campaigns",
  "/admin/proposals",
  "/admin/email-sequences",
  "/admin/analytics",
  "/admin/revenue",
  "/admin/activity",
  "/admin/features",
  "/admin/ai",
  "/admin/ai-operations",
  "/admin/integrations",
  "/admin/setup",
  "/admin/settings",
  "/admin/leads",
  "/admin/contacts",
  "/admin/inbox",
  "/admin/bookings",
  "/admin/clients",
  "/admin/chat-leads",
  "/admin/subscribers",
  "/admin/content",
  "/admin/resources",
  "/admin/partners",
  "/admin/website-grades",
];
const routes = process.env.QA_ROUTE
  ? [process.env.QA_ROUTE]
  : process.argv.includes("--chat")
    ? ["/admin/chat-leads"]
    : process.argv.includes("--ai")
      ? ["/admin/ai", "/admin/ai-operations"]
      : process.argv.includes("--today")
        ? ["/admin/today"]
        : process.argv.includes("--integrations")
          ? ["/admin/integrations"]
          : allRoutes;
const appearanceThemes = process.argv.includes("--appearances")
  ? ["dark", "signal", "studio"]
  : [null];

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"]) {
  if (!process.env[key]) throw new Error(`${key} is required for authenticated admin parity QA`);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
  type: "magiclink",
  email: process.env.ADMIN_EMAIL,
  options: { redirectTo: `${base}/auth/callback?next=/admin/today` },
});
if (linkError || !linkData?.properties?.hashed_token)
  throw linkError || new Error("Could not generate a QA session");
const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "magiclink",
});
if (verifyError || !verified.session)
  throw verifyError || new Error("Could not exchange a QA session");

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const cookieValue = `base64-${Buffer.from(JSON.stringify(verified.session)).toString("base64url")}`;
const cookieKey = `sb-${projectRef}-auth-token`;
const cookies =
  cookieValue.length <= 3180
    ? [{ name: cookieKey, value: cookieValue }]
    : Array.from({ length: Math.ceil(cookieValue.length / 3180) }, (_, index) => ({
        name: `${cookieKey}.${index}`,
        value: cookieValue.slice(index * 3180, (index + 1) * 3180),
      }));

const browser = await chromium.launch({ headless: true });
const failures = new Set();

function channelToLinear(channel) {
  const normalized = channel / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(cssColor) {
  const channels = cssColor
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number);
  if (!channels || channels.length !== 3) return null;
  const [red, green, blue] = channels.map(channelToLinear);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  if (foregroundLuminance === null || backgroundLuminance === null) return null;
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

async function verifyRoutes(viewport, label, appearance = null) {
  const runLabel = appearance ? `${label}-${appearance}` : label;
  const context = await browser.newContext({
    viewport,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const origin = new URL(base);
  await context.addCookies(
    cookies.map((cookie) => ({
      ...cookie,
      domain: origin.hostname,
      path: "/",
      httpOnly: false,
      secure: origin.protocol === "https:",
      sameSite: "Lax",
    })),
  );
  // The appearance picker persists through next-themes. Set it before any app
  // script runs so this sweep proves every retained route against the exact
  // Signal and Studio rendering path, not a one-off post-hydration preview.
  if (appearance)
    await context.addInitScript((theme) => {
      if (window.top === window) window.localStorage.setItem("theme", theme);
    }, appearance);
  const page = await context.newPage();
  await page.route("**/api/admin/notifications**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        notifications: [],
        unreadCount: 3,
        urgentCount: 1,
        priority: { status: "ready", summary: { total: 0, urgent: 0, critical: 0 }, items: [] },
      }),
    }),
  );
  // Route parity validates shell/layout behavior independently of an unapplied
  // feature-batch migration. Runtime persistence has its own service and QA
  // contract; an empty conversation list keeps every admin route deterministic.
  await page.route("**/api/admin/revenue-os/ai/conversations**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemaReady: true, conversations: [] }),
    }),
  );
  let activeRoute = "";
  page.on("console", (message) => {
    if (message.type() === "error")
      failures.add(`${runLabel} ${activeRoute}: console ${message.text().split("\n")[0]}`);
  });
  page.on("pageerror", (error) =>
    failures.add(`${runLabel} ${activeRoute}: page ${error.message.split("\n")[0]}`),
  );

  for (const route of routes) {
    activeRoute = route;
    const response = await page.goto(`${base}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    if (!response || response.status() >= 500)
      failures.add(`${runLabel} ${route}: HTTP ${response?.status() ?? "none"}`);
    await page.locator(".admin-shell").waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(120);
    const portalText = await page.locator("nextjs-portal").allTextContents();
    if (
      portalText.some((text) =>
        /Build Error|Unhandled Runtime Error|Runtime TypeError|Compilation failed/i.test(text),
      )
    )
      failures.add(`${runLabel} ${route}: Next.js error overlay is present`);
    const state = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      dialogs: document.querySelectorAll('[role="dialog"]').length,
      mainVisible: Boolean(document.querySelector(".admin-main")),
      overflowers: [...document.querySelectorAll("body *")]
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          classes: element.className,
          right: Math.round(element.getBoundingClientRect().right),
          width: Math.round(element.getBoundingClientRect().width),
          scrollWidth: element.scrollWidth,
        }))
        .filter((item) => item.right > window.innerWidth + 2 && item.width > 0)
        .slice(0, 5),
      overflowChain: (() => {
        const chain = [];
        let element = document.querySelector("table.min-w-\\[720px\\]");
        while (element && chain.length < 6) {
          const style = getComputedStyle(element);
          chain.push({
            tag: element.tagName.toLowerCase(),
            classes: element.className,
            width: Math.round(element.getBoundingClientRect().width),
            overflowX: style.overflowX,
            minWidth: style.minWidth,
          });
          element = element.parentElement;
        }
        return chain;
      })(),
      activeNavigation: (() => {
        const link = document.querySelector(".admin-sidebar a[aria-current='page']");
        if (!link) return null;
        const style = getComputedStyle(link);
        return { color: style.color, backgroundColor: style.backgroundColor };
      })(),
    }));
    if (appearance && state.theme !== appearance)
      failures.add(
        `${runLabel} ${route}: expected ${appearance} theme, found ${state.theme || "none"}`,
      );
    if (!state.mainVisible) failures.add(`${runLabel} ${route}: admin main region is missing`);
    if (state.width > state.viewport + 2)
      failures.add(
        `${runLabel} ${route}: document overflow ${state.width}px > ${state.viewport}px; ${JSON.stringify(state.overflowers)}; chain ${JSON.stringify(state.overflowChain)}`,
      );
    if (state.dialogs)
      failures.add(
        `${runLabel} ${route}: ${state.dialogs} dialog(s) opened without an operator action`,
      );
    if (state.activeNavigation) {
      const ratio = contrastRatio(
        state.activeNavigation.color,
        state.activeNavigation.backgroundColor,
      );
      if (ratio !== null && ratio < 4.5)
        failures.add(
          `${runLabel} ${route}: active navigation contrast ${ratio.toFixed(2)}:1 is below 4.5:1 (${state.activeNavigation.color} on ${state.activeNavigation.backgroundColor})`,
        );
    }

    if (route === routes[0]) {
      const demoLink = page.locator("[data-admin-demo-link]");
      if ((await demoLink.count()) !== 1)
        failures.add(`${runLabel} ${route}: shared demo workspace link is missing`);
      else {
        const href = await demoLink.getAttribute("href");
        const target = await demoLink.getAttribute("target");
        if (href !== "/demo/command-center" || target !== "_blank")
          failures.add(`${runLabel} ${route}: demo workspace link is not safely routed`);
      }

      if (viewport.width >= 1024) {
        const expandControl = page.getByRole("button", { name: "Expand sidebar" });
        if (await expandControl.isVisible().catch(() => false)) await expandControl.click();
        await page.waitForTimeout(450);
        const containment = await page.evaluate(() => {
          const sidebar = document.querySelector("[data-admin-sidebar]")?.getBoundingClientRect();
          const controls = document
            .querySelector("[data-admin-sidebar-controls]")
            ?.getBoundingClientRect();
          const badge = document.querySelector(".admin-notification-trigger span");
          return {
            contained: Boolean(
              sidebar &&
              controls &&
              controls.left >= sidebar.left &&
              controls.right <= sidebar.right,
            ),
            pulsing: badge?.classList.contains("animate-pulse") ?? false,
          };
        });
        if (!containment.contained)
          failures.add(
            `${runLabel} ${route}: expanded notification/collapse controls overflow the sidebar`,
          );
        if (containment.pulsing)
          failures.add(`${runLabel} ${route}: notification badge still flashes`);
        await page.screenshot({ path: `${shellOutput}/expanded-${runLabel}.png`, fullPage: true });

        await page.getByRole("button", { name: "Collapse sidebar" }).click();
        await page.waitForTimeout(360);
        const collapsedContainment = await page.evaluate(() => {
          const sidebar = document.querySelector("[data-admin-sidebar]")?.getBoundingClientRect();
          const controls = document
            .querySelector("[data-admin-sidebar-controls]")
            ?.getBoundingClientRect();
          return Boolean(
            sidebar && controls && controls.left >= sidebar.left && controls.right <= sidebar.right,
          );
        });
        if (!collapsedContainment)
          failures.add(`${runLabel} ${route}: collapsed controls overflow the sidebar`);
        if (!(await page.getByRole("link", { name: "Open demo workspace" }).isVisible()))
          failures.add(
            `${runLabel} ${route}: demo workspace is unavailable in collapsed navigation`,
          );
        await page.screenshot({ path: `${shellOutput}/collapsed-${runLabel}.png`, fullPage: true });
      } else {
        await page.waitForTimeout(2_000);
        const openMore = page.getByRole("button", { name: "Open More" });
        if (!(await openMore.isVisible().catch(() => false))) {
          const controls = await page.getByRole("button").allTextContents();
          failures.add(
            `${runLabel} ${route}: mobile More control is missing at ${page.url()} (buttons: ${controls.join(", ") || "none"})`,
          );
        } else {
          await openMore.click();
        }
        const demoLink = page.getByRole("link", { name: "Open demo workspace" });
        if (
          !(await demoLink
            .waitFor({ state: "visible", timeout: 3_000 })
            .then(() => true)
            .catch(() => false))
        )
          failures.add(`${runLabel} ${route}: demo workspace is unavailable in mobile navigation`);
        await page.screenshot({
          path: `${shellOutput}/navigation-${runLabel}.png`,
          fullPage: true,
        });
        const closeNavigation = page.getByRole("button", { name: "Close navigation" });
        if (await closeNavigation.isVisible()) await closeNavigation.click();
      }
    }
  }
  await context.close();
}

const onlyDesktop = process.argv.includes("--desktop");
const onlyMobile = process.argv.includes("--mobile");
for (const appearance of appearanceThemes) {
  if (!onlyMobile) await verifyRoutes({ width: 1440, height: 1000 }, "desktop", appearance);
  if (!onlyDesktop) await verifyRoutes({ width: 390, height: 844 }, "mobile", appearance);
}
await browser.close();

if (failures.size) throw new Error(`Admin route parity failures:\n${[...failures].join("\n")}`);
console.log(
  `Admin route parity passed for ${routes.length} registered routes on ${onlyDesktop ? "desktop" : onlyMobile ? "mobile" : "desktop and mobile"}${appearanceThemes[0] ? " across Night, Signal, and Studio" : ""}.`,
);
