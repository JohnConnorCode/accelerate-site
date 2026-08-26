import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const output = "/tmp/accelerate-full-admin-demo";
const scenarios = process.argv.includes("--one") ? ["sprout-and-spark"] : ["sprout-and-spark", "northline-roofing", "harborline-growth"];
const routes = ["today", "pipeline", "conversations", "inbox", "contacts", "contact-imports", "emails", "campaigns", "proposals", "email-sequences", "revenue", "clients", "bookings", "content", "resources", "ai", "ai-operations", "analytics", "activity", "integrations", "setup", "features", "settings", "leads", "chat-leads", "subscribers", "partners", "website-grades"];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];

{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${base}/demo/command-center`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const launcher = await page.locator('a[href^="/demo/command-center/"][href$="/today"]').count();
  if (launcher !== scenarios.length && !process.argv.includes("--one")) failures.push(`launcher: expected ${scenarios.length} scenario cards, found ${launcher}`);
  if (!await page.getByText("Browser-only fictional workspaces", { exact: false }).count()) failures.push("launcher: missing fictional-data disclosure");
  const marks = await page.locator(".demo-scenario-mark").evaluateAll((nodes) => nodes.map((node) => ({ classes: node.getAttribute("class"), animation: getComputedStyle(node).animationName, animatedParts: [...node.querySelectorAll("*")].filter((part) => getComputedStyle(part).animationName !== "none").length })));
  if (marks.length !== 3 || new Set(marks.map((mark) => mark.classes)).size !== 3 || marks.some((mark) => mark.animation === "none" && !mark.animatedParts)) failures.push("launcher: scenario logos are not distinct animated marks");
  const entrances = await page.locator(".admin-demo-enter").evaluateAll((nodes) => nodes.map((node) => ({ name: getComputedStyle(node).animationName, delay: getComputedStyle(node).animationDelay })));
  if (entrances.length < 9 || entrances.some((item) => !item.name.includes("admin-demo-enter")) || new Set(entrances.map((item) => item.delay)).size < 6) failures.push("launcher: hero and scenario cards do not use a complete staggered entrance sequence");
  await page.waitForTimeout(1_300);
  const firstCard = page.locator('a[href^="/demo/command-center/"][href$="/today"]').first();
  await firstCard.hover();
  await page.waitForTimeout(180);
  const hoverState = await firstCard.evaluate((node) => ({ translate: getComputedStyle(node).translate, transition: getComputedStyle(node).transitionProperty }));
  if (hoverState.translate === "none" || !hoverState.transition.includes("translate") || !hoverState.transition.includes("box-shadow")) failures.push("launcher: scenario card hover is not a smooth compositor-led transition");
  await page.screenshot({ path: `${output}/launcher-desktop.png`, fullPage: true });
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
      await page.locator("[data-admin-demo-bar]").waitFor({ timeout: 30_000 });
      await page.waitForFunction((expected) => window.__accelerateAdminDemoRuntime === expected, scenario, { timeout: 30_000 });
      await page.waitForTimeout(350);
      const state = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, overlay: document.querySelector("nextjs-portal")?.textContent || "", mainText: document.querySelector("main")?.textContent?.replace(/\s+/g, " ").trim().length || 0, logo: Boolean(document.querySelector(".demo-scenario-mark")) }));
      if (state.width > state.viewport + 2) failures.push(`${scenario} ${label} ${route}: overflow ${state.width} > ${state.viewport}`);
      if (/Build Error|Unhandled Runtime Error|Runtime TypeError|Compilation failed/i.test(state.overlay)) failures.push(`${scenario} ${label} ${route}: Next error overlay`);
      if (state.mainText < 120) failures.push(`${scenario} ${label} ${route}: view is not credibly populated`);
      if (!state.logo) failures.push(`${scenario} ${label} ${route}: shared animated logo is missing`);
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
      if (route === "today") {
        await page.screenshot({ path: `${output}/${scenario}-${label}.png`, fullPage: true });
        if (await page.locator("[data-admin-demo-link]").count()) failures.push(`${scenario} ${label}: duplicate demo chooser remains in shared navigation`);
        if (await page.locator('[data-admin-demo-bar][data-state="collapsed"]').count() !== 1) failures.push(`${scenario} ${label}: demo controls do not start collapsed`);
        await page.getByRole("button", { name: "Open demo controls" }).click();
        await page.locator('[data-admin-demo-bar][data-state="open"]').waitFor();
        if (label === "desktop") {
          await page.getByRole("button", { name: "Open guided demo" }).click();
          await page.locator("[data-admin-demo-guide]").waitFor();
          for (const [index, guidedRoute] of ["today", "conversations", "pipeline", "revenue", "analytics"].entries()) {
            if (!await page.locator("[data-admin-demo-guide]").count()) {
              if (await page.getByRole("button", { name: "Open demo controls" }).count()) await page.getByRole("button", { name: "Open demo controls" }).click();
              await page.getByRole("button", { name: "Open guided demo" }).click();
              await page.locator("[data-admin-demo-guide]").waitFor();
            }
            await page.getByRole("button", { name: `Open story step ${index + 1}` }).click();
            await page.waitForURL(new RegExp(`/${scenario}/${guidedRoute}$`));
          }
        } else {
          await page.getByRole("button", { name: "Hide demo controls" }).click();
          await page.locator('[data-admin-demo-bar][data-state="collapsed"]').waitFor();
        }
      }
    }
    if (scenario === "sprout-and-spark" && label === "desktop") {
      await page.goto(`${base}/demo/command-center/sprout-and-spark/ai?view=runs`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__accelerateAdminDemoRuntime === "sprout-and-spark");
      await page.getByText("Trace ledger", { exact: true }).waitFor();
      await page.getByText("Ordered trace", { exact: true }).waitFor();
      await page.getByRole("button", { name: /Capabilities Understand tools and safeguards/ }).click();
      await page.getByText("Registered policy", { exact: true }).first().waitFor();
      if (!page.url().includes("/demo/command-center/sprout-and-spark/ai?view=capabilities")) failures.push("AI workspace: tab navigation escaped the public demo URL");
      const mutation = await page.evaluate(async () => {
        const before = await fetch("/api/admin/revenue-os/priority").then((response) => response.json());
        const actions = await fetch("/api/admin/revenue-os/actions").then((response) => response.json());
        await fetch("/api/admin/revenue-os/actions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: actions.actions[0].id, decision: "approve" }) });
        const after = await fetch("/api/admin/revenue-os/priority").then((response) => response.json());
        const ai = await fetch("/api/admin/revenue-os/ai/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "What matters now?" }) }).then((response) => response.text());
        return { before: before.summary.total, after: after.summary.total, stored: Boolean(sessionStorage.getItem("accelerate:admin-demo:sprout-and-spark:v1")), aiFinal: ai.includes('"type":"final"'), aiDisclosure: ai.includes("stage—not send") };
      });
      if (mutation.after !== mutation.before - 1 || !mutation.stored) failures.push("sprout-and-spark desktop: simulated approval did not persist coherently");
      if (!mutation.aiFinal || !mutation.aiDisclosure) failures.push("sprout-and-spark desktop: simulated AI stream is incomplete or unsafe");
      await page.goto(`${base}/demo/command-center/northline-roofing/today`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__accelerateAdminDemoRuntime === "northline-roofing");
      const isolated = await page.evaluate(async () => (await fetch("/api/admin/revenue-os/priority").then((response) => response.json())).summary.total);
      if (isolated !== mutation.before) failures.push("scenario switch: fictional workspace state leaked between businesses");
      await page.goto(`${base}/demo/command-center/sprout-and-spark/today`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__accelerateAdminDemoRuntime === "sprout-and-spark");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator("[data-admin-demo-bar]").waitFor();
      await page.waitForFunction(() => window.__accelerateAdminDemoRuntime === "sprout-and-spark");
      const persisted = await page.evaluate(async () => (await fetch("/api/admin/revenue-os/priority").then((response) => response.json())).summary.total);
      if (persisted !== mutation.after) failures.push("sprout-and-spark desktop: demo mutation did not survive refresh");
      await page.getByRole("button", { name: "Open demo controls" }).click();
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        page.getByRole("button", { name: "Reset this demo" }).click(),
      ]);
      await page.locator("[data-admin-demo-bar]").waitFor();
      await page.waitForFunction(() => window.__accelerateAdminDemoRuntime === "sprout-and-spark");
      const reset = await page.evaluate(() => sessionStorage.getItem("accelerate:admin-demo:sprout-and-spark:v1"));
      if (reset !== null) failures.push("sprout-and-spark desktop: reset did not restore clean scenario state");
      await page.getByRole("button", { name: "Open demo controls" }).click();
      await page.getByRole("button", { name: "Open guided demo" }).click();
      await page.locator("[data-admin-demo-guide]").waitFor();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page.waitForURL(/\/sprout-and-spark\/conversations$/);
    }
    await context.close();
  }
}

const appearanceFingerprints = new Map();
for (const appearance of ["light", "dark", "signal", "studio", "frost"]) {
  for (const [label, viewport] of [["desktop", { width: 1280, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript((theme) => localStorage.setItem("theme", theme), appearance);
    const page = await context.newPage();
    page.on("pageerror", (error) => failures.push(`appearance ${appearance} ${label}: ${error.message.split("\n")[0]}`));
    await page.goto(`${base}/demo/command-center/sprout-and-spark/today`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForFunction((expected) => window.__accelerateAdminDemoRuntime === expected, "sprout-and-spark");
    await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, appearance);
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
