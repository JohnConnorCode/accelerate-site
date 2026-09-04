/**
 * Public roadmap explorer: search, status filters, expand, empty state,
 * desktop/mobile, reduced motion, overflow, console.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3015";
const outDir = "/tmp/accelerate-qa-roadmap";
mkdirSync(outDir, { recursive: true });

const failures = [];
const browser = await chromium.launch({ headless: true });

async function openRoadmap(page, path = "/roadmap") {
  const response = await page.goto(path, { waitUntil: "load", timeout: 60_000 });
  if (!response || response.status() >= 400)
    failures.push(`roadmap HTTP ${response?.status()} at ${path}`);
  await page.getByLabel("Search the roadmap").waitFor({ state: "visible", timeout: 20_000 });
  await page.getByRole("heading", { name: /shipped, in progress, and planned/i }).waitFor({
    state: "visible",
    timeout: 20_000,
  });
}

for (const [label, viewport] of [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const context = await browser.newContext({
    baseURL: base,
    viewport,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(`${label}: ${error.message.split("\n")[0]}`));

  await openRoadmap(page);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );
  if (overflow) failures.push(`${label}: document overflows horizontally`);

  const search = page.getByLabel("Search the roadmap");
  const activeChip = page.getByRole("button", { name: /^Active \(/ });
  if ((await activeChip.getAttribute("aria-pressed")) !== "true") {
    failures.push(`${label}: Active chip should be the default`);
  }

  await page.getByRole("heading", { name: /^In progress/i }).waitFor({ timeout: 10_000 });

  await page.getByRole("button", { name: /^All \(/ }).click();
  await page.getByRole("heading", { name: /^Shipped$/, exact: true }).waitFor({ timeout: 20_000 });
  await page.getByRole("heading", { name: /^Backlog$/, exact: true }).waitFor({ timeout: 20_000 });

  await search.fill("zzzzqqqxyz");
  await page.getByText(/No cards match this search/i).waitFor({ timeout: 10_000 });

  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await page.getByRole("heading", { name: /^In progress/i }).waitFor({ timeout: 10_000 });

  await page.getByRole("button", { name: /^All \(/ }).click();
  await search.fill("gmail");
  const match = page.locator("details").filter({ hasText: /gmail/i }).first();
  await match.waitFor({ timeout: 10_000 });
  await match.locator("summary").click();
  const openCount = await page.locator("details[open]").count();
  if (openCount < 1) failures.push(`${label}: expanding a matching card did not open details`);

  await page.getByRole("button", { name: /^Ready to pick up/ }).click();
  if ((await page.getByRole("button", { name: /^Ready to pick up/ }).getAttribute("aria-pressed")) !== "true") {
    failures.push(`${label}: Ready to pick up did not stay pressed`);
  }

  await page.screenshot({ path: `${outDir}/${label}.png`, fullPage: true });
  await context.close();
}

{
  const context = await browser.newContext({
    baseURL: base,
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(`query: ${error.message.split("\n")[0]}`));
  await openRoadmap(page, "/roadmap?status=shipped&q=feature");
  await page.getByRole("heading", { name: /^Shipped/i }).waitFor({ timeout: 10_000 });
  const inProgress = await page.getByRole("heading", { name: /^In progress/i }).count();
  if (inProgress > 0) failures.push("query: shipped filter still shows in progress");
  await page.screenshot({ path: `${outDir}/query-shipped.png`, fullPage: true });
  await context.close();
}

await browser.close();
if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log(`roadmap qa ok → ${outDir}`);
