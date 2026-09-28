import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const output = "/tmp/accelerate-home-hero-timing";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];

for (const [label, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
  ["short-mobile", { width: 390, height: 667 }],
]) {
  const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(`${label}: ${error.message}`));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const opening = await page.evaluate(() => {
    const heading = document.querySelector(".home-hero-heading");
    const cta = document.querySelector(".home-hero-cta");
    return {
      heading: heading?.textContent?.trim(),
      cta: cta?.textContent?.trim(),
      aboveFold: cta?.getBoundingClientRect().bottom <= innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  if (!opening.heading || !opening.cta || !opening.aboveFold || opening.overflow)
    failures.push(`${label}: headline or CTA is missing, below the fold, or page overflows`);
  await page.screenshot({ path: `${output}/${label}-first.png` });
  await page.waitForTimeout(850);
  const settled = await page.evaluate(() => ({
    heading: getComputedStyle(document.querySelector(".home-hero-heading")).transform,
    cta: getComputedStyle(document.querySelector(".home-hero-cta")).opacity,
  }));
  if (settled.heading !== "none" && settled.heading !== "matrix(1, 0, 0, 1, 0, 0)")
    failures.push(`${label}: short entrance did not settle`);
  if (settled.cta !== "1") failures.push(`${label}: CTA is not visible`);
  await page.screenshot({ path: `${output}/${label}-settled.png` });
  await context.close();
}

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
const reduced = await page.evaluate(() => ({
  heading: document.querySelector(".home-hero-heading")?.textContent?.trim(),
  animation: getComputedStyle(document.querySelector(".home-hero-heading")).animationName,
  cta: getComputedStyle(document.querySelector(".home-hero-cta")).opacity,
}));
if (!reduced.heading || reduced.animation !== "none" || reduced.cta !== "1")
  failures.push("reduced motion did not render the complete static hero");
await page.screenshot({ path: `${output}/mobile-reduced.png` });
await context.close();
await browser.close();

if (failures.length) {
  console.error(JSON.stringify({ result: "failed", failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ result: "passed", screenshots: output }, null, 2));
