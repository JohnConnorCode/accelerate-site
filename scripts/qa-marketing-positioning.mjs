import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.QA_BASE ?? "http://localhost:3011";
const output = "/tmp/accelerate-positioning-qa";
const routes = [
  "/",
  "/services",
  "/industries",
  "/industries/home-services",
  "/command-center",
  "/about",
  "/contact",
  "/roofing",
];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "short-phone", width: 390, height: 667 },
  { name: "phone", width: 390, height: 844 },
  { name: "tall-phone", width: 430, height: 932 },
];

mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const failures = [];

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const value = message.text();
    // Existing Framer Motion SSR transforms and Calendly's blocked third-party
    // storage request are development-only diagnostics, not page failures.
    if (value.includes("A tree hydrated but some attributes") || value.includes("requestStorageAccess: Permission denied")) return;
    runtimeErrors.push(`console: ${value}`);
  });
  page.on("pageerror", (error) => {
    if (error.message.includes("Hydration failed because the server rendered HTML didn't match")) return;
    runtimeErrors.push(`page: ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(base)) {
      runtimeErrors.push(`request: ${request.method()} ${request.url()} (${request.failure()?.errorText ?? "failed"})`);
    }
  });

  for (const route of routes) {
    const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 60_000 });
    if (!response?.ok()) failures.push(`${viewport.name} ${route}: HTTP ${response?.status() ?? "no response"}`);

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    if (dimensions.page > dimensions.viewport + 1) {
      failures.push(`${viewport.name} ${route}: horizontal overflow ${dimensions.page}px > ${dimensions.viewport}px`);
    }

    if (route === "/") {
      // The letter scramble is JavaScript-driven and intentionally finishes
      // even when CSS motion is reduced. Capture the settled copy, not its
      // intermediate placeholder glyphs.
      await page.waitForTimeout(1_600);
      await page.screenshot({ path: `${output}/home-${viewport.name}.png`, fullPage: false });
      const visibility = await page.evaluate(() => ({
        profit: Number.parseFloat(getComputedStyle(document.querySelector(".hero-profit")).opacity),
        cta: Number.parseFloat(getComputedStyle(document.querySelector(".hero-inline-cta")).opacity),
      }));
      if (visibility.profit < 0.99 || visibility.cta < 0.99) {
        failures.push(`${viewport.name} /: reduced-motion hero content is not fully visible`);
      }
    }
  }

  await page.goto(`${base}/`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.keyboard.press("Tab");
  const focusTag = await page.evaluate(() => document.activeElement?.tagName ?? "");
  if (!focusTag || focusTag === "BODY") failures.push(`${viewport.name} /: keyboard focus did not enter the page`);
  failures.push(...runtimeErrors.map((error) => `${viewport.name}: ${error}`));
  await context.close();
}

const motionContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
  reducedMotion: "no-preference",
});
const motionPage = await motionContext.newPage();
await motionPage.goto(`${base}/`, { waitUntil: "networkidle", timeout: 60_000 });
await motionPage.waitForTimeout(4_200);
const hero = await motionPage.evaluate(() => {
  const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
  const header = rect(".site-header");
  const eyebrow = rect(".eyebrow-anim");
  const struck = rect(".strike");
  const profit = rect(".hero-profit");
  const cta = rect(".hero-inline-cta");
  const statement = rect(".hero-statement");
  return {
    headerGap: eyebrow.top - header.bottom,
    outcomeGap: profit.top - struck.bottom,
    actionGap: cta.top - profit.bottom,
    profitOpacity: Number.parseFloat(getComputedStyle(document.querySelector(".hero-profit")).opacity),
    ctaOpacity: Number.parseFloat(getComputedStyle(document.querySelector(".hero-inline-cta")).opacity),
    statementTop: statement.top,
    viewportHeight: innerHeight,
  };
});
if (hero.headerGap < 20) failures.push(`phone hero: only ${hero.headerGap.toFixed(1)}px below the header`);
if (hero.outcomeGap > 48) failures.push(`phone hero: ${hero.outcomeGap.toFixed(1)}px between productivity and PROFIT`);
if (hero.actionGap > 40) failures.push(`phone hero: ${hero.actionGap.toFixed(1)}px between PROFIT and CTA`);
if (hero.profitOpacity < 0.99 || hero.ctaOpacity < 0.99) failures.push("phone hero: outcome or CTA still hidden after 4.2s");
if (hero.statementTop < hero.viewportHeight - 1) failures.push(`phone hero: explanatory statement begins ${hero.statementTop.toFixed(1)}px into the opening viewport instead of below the fold`);
await motionPage.screenshot({ path: `${output}/home-phone-motion-settled.png`, fullPage: false });
await motionPage.locator(".hero-statement").scrollIntoViewIfNeeded();
await motionPage.waitForTimeout(1100);
const statement = await motionPage.evaluate(() => ({
  revealed: document.querySelector(".hero-statement")?.classList.contains("is-revealed"),
  copyAnimation: getComputedStyle(document.querySelector(".hero-statement-copy")).animationName,
}));
if (!statement.revealed || !statement.copyAnimation.includes("hero-statement-copy-in")) failures.push("phone hero statement: custom scroll reveal did not run");
await motionPage.screenshot({ path: `${output}/home-phone-statement.png`, fullPage: false });
await motionContext.close();
await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Marketing positioning QA passed across ${routes.length} routes and ${viewports.length} viewports.`);
console.log(`Screenshots: ${output}`);
