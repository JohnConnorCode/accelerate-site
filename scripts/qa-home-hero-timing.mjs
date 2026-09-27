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
]) {
  const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(`${label}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`${label}: console ${message.text()}`);
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const firstPaint = await page.evaluate(() => {
    const cta = document.querySelector(".hero-inline-cta");
    return {
      opacity: Number(getComputedStyle(cta).opacity),
      aboveFold: cta.getBoundingClientRect().bottom <= innerHeight,
      fullText: document.querySelector(".hero .h1")?.getAttribute("aria-label"),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  if (firstPaint.opacity < 0.99 || !firstPaint.aboveFold || firstPaint.overflow)
    failures.push(`${label}: CTA is hidden, below the fold, or page overflows at first paint`);
  if (!firstPaint.fullText?.includes("PROFIT"))
    failures.push(`${label}: headline is not complete in server HTML`);
  await page.screenshot({ path: `${output}/${label}-first.png`, fullPage: false });
  await page.locator(".hero.loaded").waitFor({ timeout: 5_000 });
  await page.waitForTimeout(1_600);
  const settled = await page.evaluate(() => ({
    cta: Number(getComputedStyle(document.querySelector(".hero-inline-cta")).opacity),
    profit: Number(getComputedStyle(document.querySelector(".hero-profit")).opacity),
    strike: getComputedStyle(document.querySelector(".strike"), "::after").transform,
    word: document.querySelector(".hero-scramble-display")?.textContent?.trim(),
  }));
  if (settled.cta < 0.99 || settled.profit < 0.99 || settled.strike === "matrix(0, 0, 0, 1, 0, 0)")
    failures.push(`${label}: hero did not settle within 1.6 seconds`);
  if (settled.word !== "the right AI") failures.push(`${label}: scramble did not resolve`);
  await page.screenshot({ path: `${output}/${label}-settled.png`, fullPage: false });
  await context.close();
}

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
const reduced = await page.evaluate(() => ({
  word: document.querySelector(".hero-scramble-display")?.textContent?.trim(),
  animations: [...document.querySelectorAll(".hero .word > span")].map((node) => getComputedStyle(node).animationName),
  cta: Number(getComputedStyle(document.querySelector(".hero-inline-cta")).opacity),
}));
if (reduced.word !== "the right AI" || reduced.cta < 0.99 || reduced.animations.some((name) => name !== "none"))
  failures.push("reduced motion did not render the full static hero");
await page.screenshot({ path: `${output}/mobile-reduced.png`, fullPage: false });
await context.close();
await browser.close();

if (failures.length) {
  console.error(JSON.stringify({ result: "failed", failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ result: "passed", screenshots: output }, null, 2));
