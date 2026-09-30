import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const output = "/tmp/accelerate-home-hero-timing";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];
const results = [];

for (const [label, viewport, colorScheme] of [
  ["desktop", { width: 1440, height: 900 }, "light"],
  ["desktop-dark", { width: 1440, height: 900 }, "dark"],
  ["mobile", { width: 390, height: 844 }, "light"],
  ["mobile-dark", { width: 390, height: 844 }, "dark"],
  ["short-mobile", { width: 390, height: 667 }, "light"],
  ["narrow-mobile", { width: 320, height: 667 }, "light"],
]) {
  const touch = viewport.width < 1000;
  const context = await browser.newContext({
    viewport,
    colorScheme,
    hasTouch: touch,
    reducedMotion: "no-preference",
  });
  await context.addInitScript((theme) => localStorage.setItem("theme", theme), colorScheme);
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(`${label}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`${label}: ${message.text()}`);
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const opening = await page.evaluate(() => {
    const heading = document.querySelector(".home-hero-heading");
    const cta = document.querySelector(".home-hero-cta");
    return {
      heading: heading?.textContent?.trim(),
      cta: cta?.textContent?.trim(),
      aboveFold: cta?.getBoundingClientRect().bottom <= innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      fullMessage: /make more money.*save more time/.test(
        heading?.textContent?.replace(/\s+/g, " ") ?? "",
      ),
    };
  });
  if (
    !opening.heading ||
    !opening.cta ||
    !opening.aboveFold ||
    opening.overflow ||
    !opening.fullMessage
  )
    failures.push(`${label}: headline or CTA is missing, below the fold, or page overflows`);
  await page.screenshot({ path: `${output}/${label}-first.png` });
  await page.waitForTimeout(850);
  const settled = await page.evaluate(() => ({
    heading: getComputedStyle(document.querySelector(".home-hero-heading")).transform,
    cta: getComputedStyle(document.querySelector(".home-hero-cta")).opacity,
    wordsComplete: [...document.querySelectorAll(".home-hero-word")].every((word) =>
      word.getAnimations().every((animation) => animation.playState === "finished"),
    ),
  }));
  if (settled.heading !== "none" && settled.heading !== "matrix(1, 0, 0, 1, 0, 0)")
    failures.push(`${label}: short entrance did not settle`);
  if (settled.cta !== "1") failures.push(`${label}: CTA is not visible`);
  if (!settled.wordsComplete) failures.push(`${label}: word entrance did not settle`);
  await page.waitForFunction(
    () => document.querySelector(".home-hero").dataset.heroActive === "true",
  );
  if (touch) {
    const idle = await page
      .locator(".home-hero-contours")
      .evaluate((element) => getComputedStyle(element).animationName);
    if (idle !== "none") failures.push(`${label}: continuous decoration runs on a touch device`);
    await page.touchscreen.tap(viewport.width - 18, 140);
    const pulseStarted = await page
      .locator(".home-hero-pulse")
      .evaluate((element) =>
        element.getAnimations().some((animation) => animation.playState === "running"),
      );
    if (!pulseStarted) failures.push(`${label}: touch response did not start`);
    await page.waitForTimeout(950);
    const pulseFinished = await page
      .locator(".home-hero-pulse")
      .evaluate((element) =>
        element.getAnimations().every((animation) => animation.playState === "finished"),
      );
    if (!pulseFinished) failures.push(`${label}: touch response kept running`);
  } else {
    const current = page.locator(".home-hero-currents path").first();
    const first = await current.evaluate((element) => getComputedStyle(element).strokeDashoffset);
    await page.waitForTimeout(150);
    if (first === (await current.evaluate((element) => getComputedStyle(element).strokeDashoffset)))
      failures.push(`${label}: flow is static on desktop`);
    await page.mouse.move(viewport.width * 0.85, 320);
    await page.waitForTimeout(200);
    const response = await page
      .locator(".home-hero-field")
      .evaluate((element) => parseFloat(element.style.getPropertyValue("--hero-x")));
    if (!response) failures.push(`${label}: pointer response is missing`);
    await page.locator("#selected-work").evaluate((element) => element.scrollIntoView());
    await page.waitForFunction(
      () => document.querySelector(".home-hero").dataset.heroActive === "false",
    );
    const paused = await current.evaluate(
      (element) => getComputedStyle(element).animationPlayState,
    );
    if (paused !== "paused") failures.push(`${label}: decoration kept running offscreen`);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.screenshot({ path: `${output}/${label}-settled.png` });
  if (label === "desktop" || label === "mobile") {
    const booking = page.locator(".home-hero-cta");
    await booking.focus();
    if (!(await booking.evaluate((element) => element === document.activeElement)))
      failures.push(`${label}: booking focus is missing`);
    await page.keyboard.press("Enter");
    await page.waitForURL(`${baseUrl}/contact`);
    await page.goBack({ waitUntil: "domcontentloaded" });
    if (!(await page.locator(".home-hero-cta").isVisible()))
      failures.push(`${label}: booking action missing after Back`);
  }
  results.push({ label, viewport, colorScheme, opening, settled });
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
  wordsStatic: [...document.querySelectorAll(".home-hero-word")].every(
    (word) => getComputedStyle(word).animationName === "none",
  ),
  backgroundStatic:
    getComputedStyle(document.querySelector(".home-hero-contours")).animationName === "none",
}));
if (
  !reduced.heading ||
  reduced.animation !== "none" ||
  reduced.cta !== "1" ||
  !reduced.wordsStatic ||
  !reduced.backgroundStatic
)
  failures.push("reduced motion did not render the complete static hero");
await page.screenshot({ path: `${output}/mobile-reduced.png` });
await context.close();
const noJS = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  javaScriptEnabled: false,
});
const staticPage = await noJS.newPage();
await staticPage.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
const staticHero = await staticPage.evaluate(() => ({
  heading: document.querySelector(".home-hero-heading")?.textContent?.replace(/\s+/g, " "),
  cta: getComputedStyle(document.querySelector(".home-hero-cta")).opacity,
  wordsStatic: [...document.querySelectorAll(".home-hero-word")].every(
    (word) => getComputedStyle(word).animationName === "none",
  ),
  backgroundPaused:
    getComputedStyle(document.querySelector(".home-hero-contours")).animationPlayState === "paused",
}));
if (
  !/make more money.*save more time/.test(staticHero.heading ?? "") ||
  staticHero.cta !== "1" ||
  !staticHero.wordsStatic ||
  !staticHero.backgroundPaused
)
  failures.push("No-JavaScript hero did not remain complete and static");
await staticPage.screenshot({ path: `${output}/desktop-no-js.png` });
await noJS.close();
await browser.close();
await writeFile(
  `${output}/results.json`,
  JSON.stringify(
    { result: failures.length ? "failed" : "passed", results, reduced, staticHero, failures },
    null,
    2,
  ),
);

if (failures.length) {
  console.error(JSON.stringify({ result: "failed", failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ result: "passed", screenshots: output }, null, 2));
