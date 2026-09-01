import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const output = "/tmp/accelerate-home-hero-timing";
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];
const timelines = {};

function timingSnapshot() {
  const style = (selector, pseudo = null) => getComputedStyle(document.querySelector(selector), pseudo);
  const words = [...document.querySelectorAll(".hero .word > span")].map((node) => {
    const value = getComputedStyle(node);
    return { name: value.animationName, duration: value.animationDuration, delay: value.animationDelay };
  });
  const strike = style(".hero .strike", "::after");
  const profit = style(".hero-profit");
  const rule = style(".hero-profit", "::after");
  const cta = style(".hero-inline-cta");
  return {
    words,
    strike: { duration: strike.transitionDuration, delay: strike.transitionDelay },
    profit: { duration: profit.transitionDuration, delay: profit.transitionDelay },
    rule: { duration: rule.transitionDuration, delay: rule.transitionDelay },
    cta: { duration: cta.transitionDuration, delay: cta.transitionDelay },
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  };
}

for (const [label, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const context = await browser.newContext({ viewport, reducedMotion: "no-preference" });
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(`${label}: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") failures.push(`${label}: console ${message.text()}`); });
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator(".hero.loaded").waitFor({ timeout: 5_000 });
  timelines[label] = await page.evaluate(timingSnapshot);
  if (timelines[label].overflow) failures.push(`${label}: horizontal overflow`);
  await page.waitForTimeout(1_000);
  await page.screenshot({ path: `${output}/${label}-headline.png`, fullPage: false });
  await page.waitForTimeout(3_850);
  await page.screenshot({ path: `${output}/${label}-profit.png`, fullPage: false });
  await page.waitForTimeout(1_350);
  await page.screenshot({ path: `${output}/${label}-cta.png`, fullPage: false });
  await page.waitForTimeout(1_200);
  const settled = await page.evaluate(() => ({ profit: Number(getComputedStyle(document.querySelector(".hero-profit")).opacity), cta: Number(getComputedStyle(document.querySelector(".hero-inline-cta")).opacity) }));
  if (settled.profit < 0.99 || settled.cta < 0.99) failures.push(`${label}: hero did not settle after the shared sequence`);
  await context.close();
}

const comparable = (value) => JSON.stringify({ words: value.words, strike: value.strike, profit: value.profit, rule: value.rule, cta: value.cta });
if (comparable(timelines.desktop) !== comparable(timelines.mobile)) failures.push(`desktop/mobile timing mismatch: ${comparable(timelines.desktop)} !== ${comparable(timelines.mobile)}`);

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const reduced = await page.evaluate(() => ({
    words: [...document.querySelectorAll(".hero .word > span")].every((node) => getComputedStyle(node).animationName === "none"),
    profit: Number(getComputedStyle(document.querySelector(".hero-profit")).opacity),
    cta: Number(getComputedStyle(document.querySelector(".hero-inline-cta")).opacity),
  }));
  if (!reduced.words || reduced.profit < 0.99 || reduced.cta < 0.99) failures.push("mobile reduced motion did not render the complete hero immediately");
  await context.close();
}

await browser.close();
if (failures.length) {
  console.error(JSON.stringify({ result: "failed", failures, timelines }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ result: "passed", timelines, screenshots: output }, null, 2));
