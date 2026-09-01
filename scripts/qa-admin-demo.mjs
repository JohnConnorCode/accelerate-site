import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const output = "/tmp/accelerate-full-admin-demo";
const scenarios = process.argv.includes("--one") ? ["northline-roofing"] : ["northline-roofing", "alder-ridge-law", "ledgerstone-advisory", "hearthline-realty", "common-table-network"];
const defaultAppearances = { "northline-roofing": "studio", "alder-ridge-law": "dark", "ledgerstone-advisory": "frost", "hearthline-realty": "signal", "common-table-network": "light" };
const routes = ["today", "pipeline", "conversations", "inbox", "contacts", "contact-imports", "emails", "campaigns", "proposals", "email-sequences", "revenue", "clients", "bookings", "content", "resources", "ai", "ai-operations", "analytics", "activity", "integrations", "setup", "features", "settings", "leads", "chat-leads", "subscribers", "partners", "website-grades"];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];

async function readStablePageState(page) {
  const handle = await page.waitForFunction(() => {
    const root = document.documentElement;
    const main = document.querySelector("main");
    if (!root || !main || !document.querySelector(".admin-shell")) return null;
    return { width: root.scrollWidth, viewport: innerWidth, overlay: document.querySelector("nextjs-portal")?.textContent || "", mainText: main.textContent?.replace(/\s+/g, " ").trim().length || 0, logo: Boolean(document.querySelector(".demo-scenario-mark")), title: document.title, heading: document.querySelector(".admin-main h1")?.textContent?.replace(/\s+/g, " ").trim() || "" };
  }, undefined, { timeout: 30_000 });
  const state = await handle.jsonValue();
  await handle.dispose();
  return state;
}

{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
  const page = await context.newPage();
  await page.goto(`${base}/demo/command-center`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const launcher = await page.locator('a[href^="/demo/command-center/"][href$="/today"]').count();
  if (launcher !== scenarios.length && !process.argv.includes("--one")) failures.push(`launcher: expected ${scenarios.length} scenario cards, found ${launcher}`);
  if (!await page.getByText("Browser-only fictional workspaces", { exact: false }).count()) failures.push("launcher: missing fictional-data disclosure");
  if (await page.getByText("Command Center overview", { exact: false }).count()) failures.push("launcher: duplicate local navigation chrome remains");
  if (await page.locator(".demo-launcher-theme-toggle").count()) failures.push("launcher: duplicate local appearance control remains");
  await page.getByRole("button", { name: "Switch to dark mode" }).waitFor();
  await page.waitForTimeout(1_300);
  const lightTheme = await page.evaluate(() => {
    const launcher = getComputedStyle(document.querySelector(".demo-launcher"));
    const card = getComputedStyle(document.querySelector(".demo-launcher-card"));
    const preview = getComputedStyle(document.querySelector(".demo-workspace-preview"));
    return { theme: document.documentElement.dataset.theme, canvas: launcher.backgroundColor, card: card.backgroundColor, ink: card.color, preview: preview.backgroundColor };
  });
  await page.screenshot({ path: `${output}/launcher-desktop-light.png`, fullPage: true });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  await page.waitForTimeout(500);
  const darkTheme = await page.evaluate(() => {
    const launcher = getComputedStyle(document.querySelector(".demo-launcher"));
    const card = getComputedStyle(document.querySelector(".demo-launcher-card"));
    const preview = getComputedStyle(document.querySelector(".demo-workspace-preview"));
    return { theme: document.documentElement.dataset.theme, canvas: launcher.backgroundColor, card: card.backgroundColor, ink: card.color, preview: preview.backgroundColor };
  });
  if (lightTheme.theme !== "light" || darkTheme.theme !== "dark" || lightTheme.canvas === darkTheme.canvas || lightTheme.card === darkTheme.card || lightTheme.ink === darkTheme.ink || lightTheme.preview === darkTheme.preview) failures.push("launcher: shared light/dark appearance did not adapt every primary surface");
  await page.reload({ waitUntil: "domcontentloaded" });
  const stableLauncherThemes = [];
  for (let sample = 0; sample < 12; sample += 1) {
    stableLauncherThemes.push(await page.evaluate(() => document.documentElement.dataset.theme));
    await page.waitForTimeout(50);
  }
  if (stableLauncherThemes.some((theme) => theme !== "dark")) failures.push(`launcher: shared dark appearance flickered during reload (${stableLauncherThemes.join(",")})`);
  const marks = await page.locator(".demo-scenario-mark").evaluateAll((nodes) => nodes.map((node) => ({ classes: node.getAttribute("class"), animation: getComputedStyle(node).animationName, animatedParts: [...node.querySelectorAll("*")].filter((part) => getComputedStyle(part).animationName !== "none").length })));
  if (marks.length !== 5 || new Set(marks.map((mark) => mark.classes)).size !== 5 || marks.some((mark) => mark.animation === "none" && !mark.animatedParts)) failures.push("launcher: scenario logos are not five distinct animated marks");
  const entrances = await page.locator(".admin-demo-enter").evaluateAll((nodes) => nodes.map((node) => ({ name: getComputedStyle(node).animationName, delay: getComputedStyle(node).animationDelay })));
  if (entrances.length < 9 || entrances.some((item) => !item.name.includes("admin-demo-enter")) || new Set(entrances.map((item) => item.delay)).size < 6) failures.push("launcher: hero and scenario cards do not use a complete staggered entrance sequence");
  await page.waitForTimeout(1_300);
  const firstCard = page.locator('a[href^="/demo/command-center/"][href$="/today"]').first();
  await firstCard.hover();
  await page.waitForTimeout(180);
  const hoverState = await firstCard.evaluate((node) => ({ translate: getComputedStyle(node).translate, transition: getComputedStyle(node).transitionProperty }));
  if (hoverState.translate === "none" || !hoverState.transition.includes("translate") || !hoverState.transition.includes("box-shadow")) failures.push("launcher: scenario card hover is not a smooth compositor-led transition");
  await page.screenshot({ path: `${output}/launcher-desktop-dark.png`, fullPage: true });
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${base}/demo/command-center`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const facts = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 2, animated: [...document.querySelectorAll(".admin-demo-enter, .demo-scenario-mark, .demo-scenario-mark *")].filter((node) => getComputedStyle(node).animationName !== "none").length }));
  if (facts.overflow) failures.push("launcher mobile: horizontal overflow");
  if (facts.animated) failures.push(`launcher mobile: ${facts.animated} entrances remained animated under reduced motion`);
  await page.screenshot({ path: `${output}/launcher-mobile.png`, fullPage: true });
  await context.close();
}

for (const scenario of scenarios) {
  for (const [label, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    let activeRoute = "launcher";
    page.on("console", (message) => { if (message.type() === "error") failures.push(`${scenario} ${label} ${activeRoute}: console ${message.text().split("\n")[0]}`); });
    page.on("pageerror", (error) => failures.push(`${scenario} ${label} ${activeRoute}: page ${error.message.split("\n")[0]}`));
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith("/api/admin") || path.startsWith("/api/cron") || path.startsWith("/api/webhooks") || path === "/api/chat") failures.push(`${scenario} ${label}: protected request escaped demo runtime: ${path}`);
    });
    for (const route of routes) {
      activeRoute = route;
      await page.goto(`${base}/demo/command-center/${scenario}/${route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.locator(".admin-shell").waitFor({ timeout: 30_000 });
      await page.locator("[data-admin-demo-bar]").first().waitFor({ state: "attached", timeout: 30_000 });
      await page.waitForFunction((expected) => window.__accelerateAdminDemoRuntime === expected, scenario, { timeout: 30_000 });
      await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, defaultAppearances[scenario], { timeout: 30_000 });
      await page.waitForTimeout(350);
      const state = await readStablePageState(page);
      if (state.width > state.viewport + 2) failures.push(`${scenario} ${label} ${route}: overflow ${state.width} > ${state.viewport}`);
      if (/Build Error|Unhandled Runtime Error|Runtime TypeError|Compilation failed/i.test(state.overlay)) failures.push(`${scenario} ${label} ${route}: Next error overlay`);
      if (state.mainText < 120) failures.push(`${scenario} ${label} ${route}: view is not credibly populated`);
      if (!state.logo) failures.push(`${scenario} ${label} ${route}: shared animated logo is missing`);
      if (!state.heading || !state.title.startsWith(`${state.heading} | `) || !state.title.endsWith(" Demo")) failures.push(`${scenario} ${label} ${route}: contextual title does not match its page heading (${state.title})`);
      if (route === "integrations" && label === "desktop") {
        if (await page.getByRole("navigation", { name: "Breadcrumb" }).count()) failures.push(`${scenario} desktop integrations: redundant top-level breadcrumb repeats the page title`);
      }
      const expectedActiveHref = `/demo/command-center/${scenario}/${route}`;
      if (await page.locator(`.admin-nav-link[href="${expectedActiveHref}"]`).count()) {
        const activeHref = await page.locator('.admin-nav-link[aria-current="page"]').first().getAttribute("href");
        if (activeHref !== expectedActiveHref) failures.push(`${scenario} ${label} ${route}: active navigation is ${activeHref || "missing"}, expected ${expectedActiveHref}`);
        if (!page.url().includes(`/demo/command-center/${scenario}/${route}`)) failures.push(`${scenario} ${label} ${route}: public URL did not retain the active demo route`);
      }
      if (route === "contacts") {
        const toggles = page.locator("[data-contact-row-toggle]");
        const contactCount = await toggles.count();
        if (!contactCount) {
          failures.push(`${scenario} ${label} contacts: demo has no populated contact rows`);
        } else {
          await toggles.first().click();
          await page.getByText("Full message", { exact: true }).first().waitFor();
          const profile = await page.evaluate(async () => {
            const contacts = await fetch("/api/admin/contacts").then((response) => response.json());
            const email = contacts.contacts?.[0]?.email;
            return fetch(`/api/admin/contacts/timeline?email=${encodeURIComponent(email)}`).then((response) => response.json());
          });
          if ((profile.timeline?.length || 0) < 4 || profile.canonical?.status !== "connected") failures.push(`${scenario} ${label} contacts: relationship data is incomplete`);
        }
      }
      if (route === "inbox") {
        const refresh = page.locator("[data-inbox-refresh]");
        await refresh.waitFor({ state: "visible", timeout: 30_000 });
        await page.waitForFunction(() => {
          const button = document.querySelector("[data-inbox-refresh]");
          return button instanceof HTMLButtonElement && !button.disabled && button.textContent?.trim() === "Refresh";
        }, undefined, { timeout: 5_000 });
        await page.evaluate(() => {
          const browserWindow = window;
          const originalFetch = browserWindow.fetch.bind(browserWindow);
          browserWindow.__accelerateInboxRefreshCount = 0;
          browserWindow.fetch = async (input, init) => {
            const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            const url = new URL(raw, location.origin);
            if (url.pathname === "/api/admin/inbox") {
              browserWindow.__accelerateInboxRefreshCount += 1;
              await new Promise((resolve) => setTimeout(resolve, 120));
            }
            return originalFetch(input, init);
          };
        });
        await refresh.click();
        await page.waitForFunction(() => document.querySelector("[data-inbox-refresh]")?.getAttribute("aria-busy") === "true", undefined, { timeout: 2_000 });
        await page.waitForFunction(() => {
          const button = document.querySelector("[data-inbox-refresh]");
          return button instanceof HTMLButtonElement && !button.disabled && button.textContent?.trim() === "Refresh";
        }, undefined, { timeout: 5_000 });
        const refreshCount = await page.evaluate(() => window.__accelerateInboxRefreshCount);
        if (refreshCount !== 1) failures.push(`${scenario} ${label} inbox: one refresh click issued ${refreshCount} reads`);
      }
      if (route === "settings") {
        const switches = page.getByRole("switch");
        if (await switches.count() !== 6) failures.push(`${scenario} ${label} settings: expected six semantic notification switches`);
        const geometry = await switches.evaluateAll((nodes) => nodes.map((button) => {
          const track = button.firstElementChild;
          const thumb = track?.firstElementChild;
          const buttonRect = button.getBoundingClientRect();
          const trackRect = track?.getBoundingClientRect();
          const thumbRect = thumb?.getBoundingClientRect();
          return {
            button: { width: buttonRect.width, height: buttonRect.height },
            track: trackRect ? { width: trackRect.width, height: trackRect.height } : null,
            thumb: thumbRect ? { width: thumbRect.width, height: thumbRect.height } : null,
            contained: Boolean(trackRect && thumbRect && thumbRect.left >= trackRect.left && thumbRect.right <= trackRect.right && thumbRect.top >= trackRect.top && thumbRect.bottom <= trackRect.bottom),
          };
        }));
        if (geometry.some((item) => item.button.width < 40 || item.button.height < 40 || item.track?.width !== 48 || item.track?.height !== 28 || item.thumb?.width !== 20 || item.thumb?.height !== 20 || !item.contained)) failures.push(`${scenario} ${label} settings: switch geometry is distorted (${JSON.stringify(geometry)})`);
        if (label === "desktop" && await page.getByRole("navigation", { name: "Breadcrumb" }).count()) failures.push(`${scenario} desktop settings: duplicate Settings breadcrumb remains above the Settings heading`);
        const firstSwitch = switches.first();
        const before = await firstSwitch.getAttribute("aria-checked");
        await firstSwitch.focus();
        await page.keyboard.press("Space");
        await page.waitForFunction((value) => document.querySelector('[role="switch"]')?.getAttribute("aria-checked") !== value, before);
        if (scenario === "northline-roofing") await page.screenshot({ path: `${output}/${scenario}-${label}-settings.png`, fullPage: false });
      }
      if (route === "today") {
        for (const label of ["All work", "Replies", "Commitments", "Approvals", "Proposals"]) {
          await page.getByRole("button", { name: label, exact: true }).click();
          const visibleCount = Number(await page.locator("[data-today-workspace] .admin-surface").first().locator("span.rounded-full").first().textContent());
          if (!Number.isFinite(visibleCount) || visibleCount < 1) failures.push(`${scenario} ${label}: Today filter has no credible fictional work`);
        }
        await page.getByRole("button", { name: "All work", exact: true }).click();
        await page.screenshot({ path: `${output}/${scenario}-${label}.png`, fullPage: true });
        if (await page.locator("[data-admin-demo-link]").count()) failures.push(`${scenario} ${label}: duplicate demo chooser remains in shared navigation`);
        if (label === "desktop") {
          const alertTrigger = page.getByRole("button", { name: /Open command center alerts/ });
          const triggerBounds = await alertTrigger.boundingBox();
          await alertTrigger.click();
          const alertPanel = page.locator('.admin-notification-panel[data-placement="sidebar"]');
          await alertPanel.waitFor();
          await page.waitForTimeout(350);
          const panelBounds = await alertPanel.evaluate((node) => { const rect = node.getBoundingClientRect(); return { top: rect.top, right: innerWidth - rect.right, bottom: innerHeight - rect.bottom, width: rect.width, position: getComputedStyle(node).position }; });
          const anchored = triggerBounds ? Math.abs(panelBounds.top - Math.max(12, triggerBounds.y - 8)) <= 3 : false;
          if (panelBounds.position !== "fixed" || !anchored || panelBounds.right < 8 || panelBounds.bottom < 8 || panelBounds.width > 370) failures.push(`${scenario} desktop: notification panel is not a contained, trigger-anchored viewport overlay`);
          await page.screenshot({ path: `${output}/${scenario}-desktop-notifications.png`, fullPage: false });
          await page.keyboard.press("Escape");
          await alertPanel.waitFor({ state: "detached" });
        }
        if (label === "mobile") {
          const alertTrigger = page.getByRole("button", { name: /Open command center alerts/ });
          await alertTrigger.click();
          const alertSheet = page.locator('[data-admin-mobile-alerts]');
          await alertSheet.waitFor();
          await page.waitForTimeout(350);
          const alertOverlay = await page.evaluate(() => {
            const dock = document.querySelector(".admin-mobile-dock");
            const sheet = document.querySelector("[data-admin-mobile-alerts]");
            if (!(dock instanceof HTMLElement) || !(sheet instanceof HTMLElement)) return null;
            const dockStyle = getComputedStyle(dock);
            const sheetRect = sheet.getBoundingClientRect();
            const dockRect = dock.getBoundingClientRect();
            return {
              bodyState: document.body.classList.contains("admin-notifications-open"),
              dockOpacity: Number(dockStyle.opacity),
              dockPointerEvents: dockStyle.pointerEvents,
              overlaps: sheetRect.bottom > dockRect.top && sheetRect.top < dockRect.bottom && Number(dockStyle.opacity) > 0.01,
              sheetBottom: Math.round(innerHeight - sheetRect.bottom),
            };
          });
          if (!alertOverlay?.bodyState || alertOverlay.dockOpacity > 0.01 || alertOverlay.dockPointerEvents !== "none" || alertOverlay.overlaps || Math.abs(alertOverlay.sheetBottom - 8) > 2) failures.push(`${scenario} mobile: notification sheet and dock do not share one collision-free inset overlay state`);
          await page.screenshot({ path: `${output}/${scenario}-mobile-notifications.png`, fullPage: false });
          await page.keyboard.press("Escape");
          await alertSheet.waitFor({ state: "detached" });
          if (await page.evaluate(() => document.body.classList.contains("admin-notifications-open"))) failures.push(`${scenario} mobile: notification overlay state remained after close`);

          await page.getByRole("button", { name: "Open More" }).click();
          await page.locator('aside[role="dialog"][aria-label="Admin navigation"]').waitFor();
          await page.waitForTimeout(420);
          const drawerA11y = await page.evaluate(() => {
            const ids = [...document.querySelectorAll("[id]")].map((node) => node.id).filter(Boolean);
            const dock = document.querySelector(".admin-mobile-dock");
            const dockStyle = dock ? getComputedStyle(dock) : null;
            const backdrop = document.querySelector('button[aria-label="Dismiss navigation"]');
            return {
              duplicateIds: [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))],
              focusInside: Boolean(document.activeElement?.closest('aside[role="dialog"][aria-label="Admin navigation"]')),
              focusLabel: document.activeElement?.getAttribute("aria-label"),
              bodyState: document.body.classList.contains("admin-mobile-nav-open"),
              dockOpacity: dockStyle ? Number(dockStyle.opacity) : 1,
              dockPointerEvents: dockStyle?.pointerEvents,
              backdropBlur: backdrop ? getComputedStyle(backdrop).backdropFilter : "none",
            };
          });
          if (drawerA11y.duplicateIds.length) failures.push(`${scenario} mobile: duplicate ids while navigation is open: ${drawerA11y.duplicateIds.join(", ")}`);
          if (!drawerA11y.focusInside || drawerA11y.focusLabel !== "Close navigation") failures.push(`${scenario} mobile: navigation did not move focus to its close control`);
          if (!drawerA11y.bodyState || drawerA11y.dockOpacity > 0.01 || drawerA11y.dockPointerEvents !== "none") failures.push(`${scenario} mobile: More drawer did not take exclusive ownership from the dock`);
          if (drawerA11y.backdropBlur === "none") failures.push(`${scenario} mobile: More drawer does not use the shared blurred overlay backdrop`);
        }
        let controlsScope = label === "mobile" ? page.locator('aside[role="dialog"][aria-label="Admin navigation"]') : page.locator("[data-admin-sidebar]");
        const demoControlPlacement = await controlsScope.locator("[data-admin-demo-bar]").evaluate((node) => ({ insideFooter: Boolean(node.closest(".admin-nav-footer")), position: getComputedStyle(node).position }));
        if (!demoControlPlacement.insideFooter || demoControlPlacement.position === "fixed") failures.push(`${scenario} ${label}: demo controls are not integrated into the sidebar footer`);
        if (label === "mobile" && await page.evaluate(() => document.body.style.overflow !== "hidden")) failures.push(`${scenario} mobile: open navigation did not lock background scrolling`);

        if (scenario === "northline-roofing") {
          const revenueToggle = controlsScope.getByRole("button", { name: "Revenue", exact: true });
          const revenuePanelId = await revenueToggle.getAttribute("aria-controls");
          const revenuePanel = controlsScope.locator(`[id="${revenuePanelId}"]`);
          await revenueToggle.click();
          await revenuePanel.waitFor();
          if (await revenuePanel.getAttribute("aria-hidden") !== "false") failures.push(`${scenario} ${label}: Revenue disclosure did not expose its links`);
          await revenueToggle.click();
          if (await revenuePanel.getAttribute("aria-hidden") !== "true") failures.push(`${scenario} ${label}: Revenue disclosure did not hide its links`);
          await revenueToggle.click();
          if (await revenuePanel.getAttribute("aria-hidden") !== "false") failures.push(`${scenario} ${label}: Revenue disclosure did not reopen`);

          const inboxHref = `/demo/command-center/${scenario}/inbox`;
          const todayHref = `/demo/command-center/${scenario}/today`;
          await controlsScope.locator(`a.admin-nav-link[href="${inboxHref}"]`).click();
          await page.waitForURL(new RegExp(`/demo/command-center/${scenario}/inbox$`));
          if (await page.locator('.admin-nav-link[aria-current="page"]').first().getAttribute("href") !== inboxHref) failures.push(`${scenario} ${label}: client navigation left the wrong sidebar item active`);
          if (label === "desktop" && await page.getByRole("navigation", { name: "Breadcrumb" }).count()) failures.push(`${scenario} ${label}: top-level Inbox navigation rendered a redundant breadcrumb`);
          await page.goBack({ waitUntil: "domcontentloaded" });
          await page.waitForURL(new RegExp(`/demo/command-center/${scenario}/today$`));
          if (await page.locator('.admin-nav-link[aria-current="page"]').first().getAttribute("href") !== todayHref) failures.push(`${scenario} ${label}: back navigation left the wrong sidebar item active`);
          if (label === "mobile") {
            await page.getByRole("button", { name: "Open More" }).click();
            await page.locator('aside[role="dialog"][aria-label="Admin navigation"]').waitFor();
            controlsScope = page.locator('aside[role="dialog"][aria-label="Admin navigation"]');
          }
        }

        if (await controlsScope.locator('[data-admin-demo-bar][data-state="collapsed"]').count() !== 1) failures.push(`${scenario} ${label}: demo controls do not start collapsed`);
        await controlsScope.getByRole("button", { name: "Open demo controls" }).click();
        await controlsScope.locator('[data-admin-demo-bar][data-state="open"]').waitFor();
        if (label === "mobile") {
          const mobileControlFacts = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 2, undersized: [...document.querySelectorAll('aside[role="dialog"][aria-label="Admin navigation"] button, aside[role="dialog"][aria-label="Admin navigation"] select, aside[role="dialog"][aria-label="Admin navigation"] a')].filter((node) => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && (rect.width < 40 || rect.height < 40); }).length }));
          if (mobileControlFacts.overflow) failures.push(`${scenario} mobile: open integrated controls caused horizontal overflow`);
          if (mobileControlFacts.undersized) failures.push(`${scenario} mobile: ${mobileControlFacts.undersized} visible navigation controls are below the 40px hit-area minimum`);
          const drawerFocusableCount = await controlsScope.locator('a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])').count();
          for (let index = 0; index < drawerFocusableCount + 2; index += 1) await page.keyboard.press("Tab");
          if (!await page.evaluate(() => Boolean(document.activeElement?.closest('aside[role="dialog"][aria-label="Admin navigation"]')))) failures.push(`${scenario} mobile: keyboard focus escaped the navigation dialog`);
        }
        if (label === "mobile") {
          await page.screenshot({ path: `${output}/${scenario}-mobile-navigation.png`, fullPage: false });
        }
        await controlsScope.getByRole("button", { name: "Hide demo controls" }).click();
        await controlsScope.locator('[data-admin-demo-bar][data-state="collapsed"]').waitFor();
      }
    }
    if (scenario === "northline-roofing" && label === "desktop") {
      await page.goto(`${base}/demo/command-center/northline-roofing/today`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__accelerateAdminDemoRuntime === "northline-roofing");
      const desktopSidebar = page.locator("[data-admin-sidebar]");
      if (await desktopSidebar.locator('[data-admin-demo-bar][data-state="collapsed"]').count()) await desktopSidebar.getByRole("button", { name: "Open demo controls" }).click();
      await desktopSidebar.getByRole("combobox", { name: "Demo business" }).selectOption("alder-ridge-law");
      await page.waitForURL(/\/alder-ridge-law\/today$/);
      await page.waitForFunction(() => window.__accelerateAdminDemoRuntime === "alder-ridge-law");
      await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
      if (await desktopSidebar.getByRole("button", { name: "Open demo controls" }).count()) await desktopSidebar.getByRole("button", { name: "Open demo controls" }).click();
      await desktopSidebar.getByRole("combobox", { name: "Demo business" }).selectOption("northline-roofing");
      await page.waitForURL(/\/northline-roofing\/today$/);
      await page.waitForFunction(() => window.__accelerateAdminDemoRuntime === "northline-roofing");
      await page.waitForFunction(() => document.documentElement.dataset.theme === "studio");

      await page.goto(`${base}/demo/command-center/northline-roofing/ai?view=runs`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__accelerateAdminDemoRuntime === "northline-roofing");
      await page.getByText("Trace ledger", { exact: true }).waitFor();
      await page.getByText("Ordered trace", { exact: true }).waitFor();
      await page.getByRole("button", { name: /Capabilities Understand tools and safeguards/ }).click();
      await page.getByRole("heading", { name: "Read capabilities", exact: true }).waitFor();
      if (!page.url().includes("/demo/command-center/northline-roofing/ai?view=capabilities")) failures.push("AI workspace: tab navigation escaped the public demo URL");
      const mutation = await page.evaluate(async () => {
        const before = await fetch("/api/admin/revenue-os/priority").then((response) => response.json());
        const actions = await fetch("/api/admin/revenue-os/actions").then((response) => response.json());
        await fetch("/api/admin/revenue-os/actions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: actions.actions[0].id, decision: "approve" }) });
        const after = await fetch("/api/admin/revenue-os/priority").then((response) => response.json());
        const ai = await fetch("/api/admin/revenue-os/ai/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "What matters now?" }) }).then((response) => response.text());
        return { before: before.summary.total, after: after.summary.total, stored: Boolean(sessionStorage.getItem("accelerate:admin-demo:northline-roofing:v3")), aiFinal: ai.includes('"type":"final"'), aiDisclosure: ai.includes("stage—not send") };
      });
      if (mutation.after >= mutation.before || !mutation.stored) failures.push("northline-roofing desktop: simulated queue work did not persist coherently");
      if (!mutation.aiFinal || !mutation.aiDisclosure) failures.push("northline-roofing desktop: simulated AI stream is incomplete or unsafe");
      await page.goto(`${base}/demo/command-center/alder-ridge-law/today`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__accelerateAdminDemoRuntime === "alder-ridge-law");
      await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
      const isolated = await page.evaluate(async () => (await fetch("/api/admin/revenue-os/priority").then((response) => response.json())).summary.total);
      if (isolated !== mutation.before) failures.push("scenario switch: fictional workspace state leaked between businesses");
      await page.goto(`${base}/demo/command-center/northline-roofing/today`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__accelerateAdminDemoRuntime === "northline-roofing");
      await page.waitForFunction(() => document.documentElement.dataset.theme === "studio");
      await page.getByRole("button", { name: /^Appearance:/ }).click();
      await page.getByRole("radio", { name: /Frost/ }).click();
      await page.waitForFunction(() => document.documentElement.dataset.theme === "frost");
      await desktopSidebar.getByRole("button", { name: "Open demo controls" }).click();
      await desktopSidebar.getByRole("combobox", { name: "Demo business" }).selectOption("alder-ridge-law");
      await page.waitForURL(/\/alder-ridge-law\/today$/);
      await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
      if (await desktopSidebar.locator('[data-admin-demo-bar][data-state="collapsed"]').count()) await desktopSidebar.getByRole("button", { name: "Open demo controls" }).click();
      await desktopSidebar.getByRole("combobox", { name: "Demo business" }).selectOption("northline-roofing");
      await page.waitForURL(/\/northline-roofing\/today$/);
      await page.waitForFunction(() => document.documentElement.dataset.theme === "frost");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("[data-admin-demo-bar]").waitFor();
      await page.waitForFunction(() => window.__accelerateAdminDemoRuntime === "northline-roofing");
      await page.waitForFunction(() => document.documentElement.dataset.theme === "frost");
      const persisted = await page.evaluate(async () => (await fetch("/api/admin/revenue-os/priority").then((response) => response.json())).summary.total);
      if (persisted !== mutation.after) failures.push("northline-roofing desktop: demo mutation did not survive refresh");
      await page.getByRole("button", { name: "Open demo controls" }).click();
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        page.getByRole("button", { name: "Reset this demo" }).click(),
      ]);
      await page.locator("[data-admin-demo-bar]").waitFor();
      await page.waitForFunction(() => window.__accelerateAdminDemoRuntime === "northline-roofing");
      const reset = await page.evaluate(() => ({ data: sessionStorage.getItem("accelerate:admin-demo:northline-roofing:v3"), appearance: sessionStorage.getItem("accelerate:admin-demo:northline-roofing:appearance:v1"), theme: document.documentElement.dataset.theme }));
      if (reset.data !== null || reset.appearance !== null || reset.theme !== "studio") failures.push("northline-roofing desktop: reset did not restore clean data and default appearance");
    }
    await context.close();
  }
}

for (const scenario of scenarios) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/admin") || path.startsWith("/api/cron") || path.startsWith("/api/webhooks") || path === "/api/chat") failures.push(`${scenario} operations: protected request escaped demo runtime: ${path}`);
  });
  await page.goto(`${base}/demo/command-center/${scenario}/today`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction((expected) => window.__accelerateAdminDemoRuntime === expected, scenario, { timeout: 30_000 });
  const operation = await page.evaluate(async (activeScenario) => {
    const [actionsBefore, tasksBefore, pipelineBefore, conversationsBefore] = await Promise.all([
      fetch("/api/admin/revenue-os/actions").then((response) => response.json()),
      fetch("/api/admin/revenue-os/tasks").then((response) => response.json()),
      fetch("/api/admin/revenue-os/pipeline").then((response) => response.json()),
      fetch("/api/admin/revenue-os/conversations").then((response) => response.json()),
    ]);
    const action = actionsBefore.actions[0];
    const task = tasksBefore.tasks[0];
    const opportunity = pipelineBefore.opportunities[0];
    const conversation = conversationsBefore.conversations[0];
    const [approval, taskCompletion, stageChange, reply, ai] = await Promise.all([
      fetch("/api/admin/revenue-os/actions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: action.id, decision: "approve" }) }).then((response) => response.json()),
      fetch("/api/admin/revenue-os/tasks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: task.id }) }).then((response) => response.json()),
      fetch("/api/admin/revenue-os/pipeline", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: opportunity.id, stage: "proposal" }) }).then((response) => response.json()),
      fetch("/api/admin/revenue-os/conversations/reply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: conversation.id, body: "This is a safe fictional demo reply." }) }).then((response) => response.json()),
      fetch("/api/admin/revenue-os/ai/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "What matters now?" }) }).then((response) => response.text()),
    ]);
    const [actionsAfter, tasksAfter, pipelineAfter, conversationAfter] = await Promise.all([
      fetch("/api/admin/revenue-os/actions").then((response) => response.json()),
      fetch("/api/admin/revenue-os/tasks").then((response) => response.json()),
      fetch("/api/admin/revenue-os/pipeline").then((response) => response.json()),
      fetch(`/api/admin/revenue-os/conversations?id=${encodeURIComponent(conversation.id)}`).then((response) => response.json()),
    ]);
    return {
      approval: approval.simulated === true && actionsAfter.actions.length === actionsBefore.actions.length - 1,
      task: taskCompletion.simulated === true && tasksAfter.tasks.length === tasksBefore.tasks.length - 1,
      pipeline: stageChange.simulated === true && pipelineAfter.opportunities.find((item) => item.id === opportunity.id)?.stage === "proposal",
      reply: reply.simulated === true && JSON.stringify(conversationAfter).includes("This is a safe fictional demo reply."),
      ai: ai.includes('"type":"final"') && ai.includes("stage—not send"),
      stored: Boolean(sessionStorage.getItem(`accelerate:admin-demo:${activeScenario}:v3`)),
    };
  }, scenario);
  for (const [name, passed] of Object.entries(operation)) {
    if (!passed) failures.push(`${scenario} operations: simulated ${name} did not complete coherently`);
  }
  await context.close();
}

// Deep-link identity matrix. Top-level route health is insufficient: every list row
// must open the exact record it names, and an unknown ID must never borrow fixture data.
for (const scenario of scenarios) {
  for (const [label, viewport] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", (error) => failures.push(`${scenario} ${label} deep links: ${error.message.split("\n")[0]}`));
    await page.goto(`${base}/demo/command-center/${scenario}/clients`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForFunction((expected) => window.__accelerateAdminDemoRuntime === expected, scenario);
    const contract = await page.evaluate(async () => {
      const [clientList, pipelineList] = await Promise.all([
        fetch("/api/admin/clients").then((response) => response.json()),
        fetch("/api/admin/revenue-os/pipeline").then((response) => response.json()),
      ]);
      const firstContact = pipelineList.opportunities[0]?.email;
      const [unknownClient, unknownOpportunity, unknownContact, unknownRun, unknownProposal, unknownCampaign, unknownEmail, unknownImport, unknownConversation] = await Promise.all([
        fetch("/api/admin/clients?id=missing-client").then(async (response) => ({ status: response.status, body: await response.json() })),
        fetch("/api/admin/revenue-os/records/opportunity/missing-opportunity").then(async (response) => ({ status: response.status, body: await response.json() })),
        fetch("/api/admin/contacts/timeline?email=missing%40example.test").then((response) => response.json()),
        fetch("/api/admin/revenue-os/ai/runs/missing-run").then((response) => response.json()),
        fetch("/api/admin/proposals?id=missing-proposal").then((response) => response.json()),
        fetch("/api/admin/revenue-os/campaigns/preview?id=missing-campaign").then((response) => response.status),
        fetch("/api/admin/emails/preview?id=missing-email").then((response) => response.status),
        fetch("/api/admin/revenue-os/contact-imports?id=missing-import").then((response) => response.json()),
        fetch("/api/admin/revenue-os/ai/conversations/missing-conversation").then((response) => response.status),
      ]);
      const knownContact = firstContact ? await fetch(`/api/admin/contacts/timeline?email=${encodeURIComponent(firstContact)}`).then((response) => response.json()) : null;
      return { clients: clientList.clients, opportunities: pipelineList.opportunities, unknownClient, unknownOpportunity, unknownContact, unknownRun, unknownProposal, unknownCampaign, unknownEmail, unknownImport, unknownConversation, knownContact };
    });
    if (contract.unknownClient.body.client !== null || contract.unknownOpportunity.body.record !== null || contract.unknownContact.canonical.contact !== null || contract.unknownRun.run !== null || contract.unknownProposal.proposal !== null || contract.unknownCampaign !== 404 || contract.unknownEmail !== 404 || contract.unknownImport.batch !== null || contract.unknownConversation !== 404) failures.push(`${scenario} ${label} deep links: an unknown ID substituted or exposed another entity`);
    if (contract.knownContact?.canonical?.status !== "connected" || contract.knownContact.canonical.contact?.full_name !== contract.opportunities[0]?.contact?.full_name) failures.push(`${scenario} ${label} deep links: known contact identity did not reconcile`);
    for (const client of contract.clients) {
      await page.goto(`${base}/demo/command-center/${scenario}/clients/${encodeURIComponent(client.id)}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.getByRole("heading", { name: client.business_name, exact: true }).waitFor({ timeout: 30_000 });
      if (await page.getByRole("heading", { name: "Client Not Found", exact: true }).count()) failures.push(`${scenario} ${label}: valid client ${client.id} rendered not found`);
    }
    for (const opportunity of contract.opportunities) {
      await page.goto(`${base}/demo/command-center/${scenario}/pipeline/${encodeURIComponent(opportunity.id)}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.getByRole("heading", { name: opportunity.name, exact: true }).waitFor({ timeout: 30_000 });
      if (await page.getByText("Opportunity not found", { exact: false }).count()) failures.push(`${scenario} ${label}: valid opportunity ${opportunity.id} rendered not found`);
      if (await page.locator('a[href$="/admin/tasks"], a[href*="/admin/tasks?"]').count()) failures.push(`${scenario} ${label}: opportunity ${opportunity.id} exposes the nonexistent Tasks route`);
    }
    await context.close();
  }
}

const appearanceFingerprints = new Map();
for (const appearance of ["light", "dark", "signal", "studio", "frost"]) {
  for (const [label, viewport] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript((theme) => {
      localStorage.setItem("theme", theme);
      sessionStorage.setItem("accelerate:admin-demo:northline-roofing:appearance:v1", theme);
    }, appearance);
    const page = await context.newPage();
    page.on("pageerror", (error) => failures.push(`appearance ${appearance} ${label}: ${error.message.split("\n")[0]}`));
    await page.goto(`${base}/demo/command-center/northline-roofing/today`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForFunction((expected) => window.__accelerateAdminDemoRuntime === expected, "northline-roofing");
    await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, appearance);
    await page.locator(".admin-shell").waitFor({ state: "attached", timeout: 15_000 });
    await page.locator('.admin-nav-link[aria-current="page"]').first().waitFor({ state: "attached", timeout: 15_000 });
    await page.locator(".admin-surface").first().waitFor({ state: "attached", timeout: 15_000 });
    const tokens = await page.evaluate(() => {
      const styles = getComputedStyle(document.querySelector(".admin-shell"));
      const sidebar = getComputedStyle(document.querySelector(".admin-sidebar"));
      const card = getComputedStyle(document.querySelector(".admin-surface"));
      const active = getComputedStyle(document.querySelector('.admin-nav-link[aria-current="page"]'));
      return {
        ink: styles.getPropertyValue("--admin-ink").trim(), canvas: styles.getPropertyValue("--admin-canvas").trim(), surface: styles.getPropertyValue("--admin-surface").trim(), action: styles.getPropertyValue("--admin-action").trim(),
        navInk: styles.getPropertyValue("--admin-nav-ink").trim(), sidebar: sidebar.backgroundColor, cardShadow: card.boxShadow, activeBackground: active.backgroundColor, activeColor: active.color,
        overflow: document.documentElement.scrollWidth > innerWidth + 2,
      };
    });
    if (!tokens.ink || !tokens.canvas || tokens.ink === tokens.canvas || tokens.ink === tokens.surface) failures.push(`appearance ${appearance} ${label}: incoherent foreground/background tokens`);
    if (tokens.overflow) failures.push(`appearance ${appearance} ${label}: horizontal overflow`);
    if (label === "desktop") appearanceFingerprints.set(appearance, [tokens.canvas, tokens.surface, tokens.action, tokens.sidebar, tokens.navInk, tokens.activeBackground].join("|"));
    if (appearance === "frost" && tokens.cardShadow.includes("0px 0px 0px 1px")) failures.push(`appearance frost ${label}: cards still use a visible outline ring`);
    if (appearance === "frost" && (tokens.activeBackground === "rgba(0, 0, 0, 0)" || tokens.activeColor === tokens.navInk)) failures.push(`appearance frost ${label}: navigation does not have a distinct violet active treatment`);
    await context.close();
  }
}
if (new Set(appearanceFingerprints.values()).size !== appearanceFingerprints.size) failures.push("appearances: two or more themes still resolve to the same shell treatment");
await browser.close();
if (failures.length) throw new Error(`Full admin demo QA failures:\n${[...new Set(failures)].join("\n")}`);
console.log(JSON.stringify({ result: "passed", scenarios, routes, screenshots: output }, null, 2));
