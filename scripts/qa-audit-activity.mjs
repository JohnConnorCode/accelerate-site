import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const output = "/tmp/accelerate-audit-activity";
const scenario = "northline-roofing";
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];

async function assertNoOverflow(page, label) {
  const width = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, view: innerWidth }));
  if (width.doc > width.view + 2) failures.push(`${label}: overflow ${width.doc}px > ${width.view}px`);
}

async function openActivity(viewport, label, reducedMotion = "reduce") {
  const context = await browser.newContext({ viewport, reducedMotion, colorScheme: "light" });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") failures.push(`${label} console: ${message.text().split("\n")[0]}`); });
  page.on("pageerror", (error) => failures.push(`${label} page: ${error.message.split("\n")[0]}`));
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/admin") || path.startsWith("/api/cron") || path.startsWith("/api/webhooks") || path === "/api/chat") {
      failures.push(`${label}: protected request escaped demo runtime: ${path}`);
    }
  });
  await page.goto(`${base}/demo/command-center/${scenario}/activity`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator(".admin-shell").waitFor({ timeout: 30_000 });
  await page.waitForFunction((expected) => window.__accelerateAdminDemoRuntime === expected, scenario, { timeout: 30_000 });
  await page.getByRole("heading", { name: "Activity", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Narrow the ledger without leaving this page" }).waitFor();
  return { context, page };
}

{
  const desktop = await openActivity({ width: 1440, height: 1000 }, "desktop");
  const entity = desktop.page.getByLabel("Entity");
  await entity.selectOption("proposal");
  await desktop.page.waitForFunction(() => new URL(location.href).searchParams.get("entity") === "proposal");
  await desktop.page.getByRole("heading", { name: "proposal · viewed", exact: false }).first().waitFor();
  const source = desktop.page.getByLabel("Source");
  await source.selectOption("public");
  await desktop.page.waitForFunction(() => new URL(location.href).searchParams.get("source") === "public");
  const rows = desktop.page.locator("article");
  const count = await rows.count();
  if (count < 1) failures.push("desktop: filtered proposal/public history is empty");
  const actions = await rows.evaluateAll((nodes) => nodes.map((node) => node.querySelector("h2")?.textContent || ""));
  if (actions.some((action) => !action.includes("proposal") || !action.includes("viewed"))) failures.push(`desktop: filter leaked non-proposal rows (${actions.join(" | ")})`);
  await desktop.page.getByRole("button", { name: /Clear \d+ filters/ }).click();
  await desktop.page.waitForFunction(() => !new URL(location.href).searchParams.get("entity") && !new URL(location.href).searchParams.get("source"));
  await desktop.page.goBack();
  await desktop.page.waitForFunction(() => new URL(location.href).searchParams.get("entity") === "proposal" && new URL(location.href).searchParams.get("source") === "public");
  await assertNoOverflow(desktop.page, "desktop");
  await desktop.page.screenshot({ path: `${output}/activity-desktop.png`, fullPage: true });
  await desktop.context.close();
}

{
  const mobile = await openActivity({ width: 390, height: 844 }, "mobile");
  await mobile.page.getByLabel("Action").selectOption("calendar.synced");
  await mobile.page.waitForFunction(() => new URL(location.href).searchParams.get("action") === "calendar.synced");
  await mobile.page.getByRole("heading", { name: "calendar · synced", exact: false }).first().waitFor();
  await assertNoOverflow(mobile.page, "mobile");
  const target = await mobile.page.getByLabel("Entity").evaluate((node) => node.getBoundingClientRect().height);
  if (target < 40) failures.push(`mobile: entity filter target is ${target}px`);
  await mobile.page.screenshot({ path: `${output}/activity-mobile.png`, fullPage: true });
  await mobile.context.close();
}

{
  const motion = await openActivity({ width: 1440, height: 1000 }, "reduced-motion", "reduce");
  const animated = await motion.page.evaluate(() => [...document.querySelectorAll(".admin-demo-enter, .demo-scenario-mark")].filter((node) => getComputedStyle(node).animationName !== "none").length);
  if (animated) failures.push(`reduced-motion: ${animated} decorative entrances still animate`);
  await motion.page.getByLabel("Source").selectOption("automation");
  await motion.page.waitForFunction(() => new URL(location.href).searchParams.get("source") === "automation");
  await motion.page.getByRole("heading", { name: "calendar · synced", exact: false }).first().waitFor();
  await motion.context.close();
}

await browser.close();
if (failures.length) {
  console.error(JSON.stringify({ result: "failed", failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ result: "passed", screenshots: [`${output}/activity-desktop.png`, `${output}/activity-mobile.png`], checks: ["demo-activity-filters", "query-backed-back", "mobile-targets", "reduced-motion", "no-overflow", "no-console", "no-protected-requests"] }, null, 2));
