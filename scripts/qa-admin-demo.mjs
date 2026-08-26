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
      const state = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, overlay: document.querySelector("nextjs-portal")?.textContent || "", mainText: document.querySelector("main")?.textContent?.replace(/\s+/g, " ").trim().length || 0, logo: Boolean(document.querySelector(".logo-link, [aria-label*='Revenue OS home']")) }));
      if (state.width > state.viewport + 2) failures.push(`${scenario} ${label} ${route}: overflow ${state.width} > ${state.viewport}`);
      if (/Build Error|Unhandled Runtime Error|Runtime TypeError|Compilation failed/i.test(state.overlay)) failures.push(`${scenario} ${label} ${route}: Next error overlay`);
      if (state.mainText < 120) failures.push(`${scenario} ${label} ${route}: view is not credibly populated`);
      if (!state.logo) failures.push(`${scenario} ${label} ${route}: shared animated logo is missing`);
      if (route === "today") {
        await page.screenshot({ path: `${output}/${scenario}-${label}.png`, fullPage: true });
        if (label === "desktop") {
          await page.getByRole("button", { name: "Open guided demo" }).click();
          await page.locator("[data-admin-demo-guide]").waitFor();
          for (const [index, guidedRoute] of ["today", "conversations", "pipeline", "revenue", "analytics"].entries()) {
            if (!await page.locator("[data-admin-demo-guide]").count()) {
              await page.getByRole("button", { name: "Open guided demo" }).click();
              await page.locator("[data-admin-demo-guide]").waitFor();
            }
            await page.getByRole("button", { name: `Open story step ${index + 1}` }).click();
            await page.waitForURL(new RegExp(`/${scenario}/${guidedRoute}$`));
          }
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
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        page.getByRole("button", { name: "Reset this demo" }).click(),
      ]);
      await page.locator("[data-admin-demo-bar]").waitFor();
      await page.waitForFunction(() => window.__accelerateAdminDemoRuntime === "sprout-and-spark");
      const reset = await page.evaluate(() => sessionStorage.getItem("accelerate:admin-demo:sprout-and-spark:v1"));
      if (reset !== null) failures.push("sprout-and-spark desktop: reset did not restore clean scenario state");
      await page.getByRole("button", { name: "Open guided demo" }).click();
      await page.locator("[data-admin-demo-guide]").waitFor();
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await page.waitForURL(/\/sprout-and-spark\/conversations$/);
    }
    await context.close();
  }
}

for (const appearance of ["light", "dark", "signal", "studio"]) {
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
      return { ink: styles.getPropertyValue("--admin-ink").trim(), canvas: styles.getPropertyValue("--admin-canvas").trim(), surface: styles.getPropertyValue("--admin-surface").trim(), overflow: document.documentElement.scrollWidth > innerWidth + 2 };
    });
    if (!tokens.ink || !tokens.canvas || tokens.ink === tokens.canvas || tokens.ink === tokens.surface) failures.push(`appearance ${appearance} ${label}: incoherent foreground/background tokens`);
    if (tokens.overflow) failures.push(`appearance ${appearance} ${label}: horizontal overflow`);
    await context.close();
  }
}
await browser.close();
if (failures.length) throw new Error(`Full admin demo QA failures:\n${[...new Set(failures)].join("\n")}`);
console.log(JSON.stringify({ result: "passed", scenarios, routes, screenshots: output }, null, 2));
