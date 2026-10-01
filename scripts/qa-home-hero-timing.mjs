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
  await context.addInitScript(() => {
    window.__heroEntrances = [];
    document.addEventListener("animationstart", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.closest(".home-hero")) return;
      const phase = target.matches(".home-hero-eyebrow")
        ? "eyebrow"
        : target.matches(".home-hero-lead .home-hero-word")
          ? "lead"
          : target.matches(".home-hero-heading em .home-hero-word")
            ? "outcome"
            : target.matches(".home-hero-support")
              ? "support"
              : target.matches(".home-hero-actions")
                ? "action"
                : target.matches(".home-hero-index > span")
                  ? `index-${[...target.parentElement.children].indexOf(target)}`
                  : null;
      if (phase) window.__heroEntrances.push({ phase, time: performance.now() });
    });
  });
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
  await page.screenshot({ caret: "initial", path: `${output}/${label}-first.png` });
  await page.waitForFunction(
    () => document.querySelector(".home-hero").dataset.revealState === "visible",
  );
  if (label === "desktop" || label === "mobile") {
    await page.screenshot({ caret: "initial", path: `${output}/${label}-entry.png` });
    await page.waitForTimeout(300);
    await page.screenshot({ caret: "initial", path: `${output}/${label}-sequence.png` });
  }
  await page.waitForTimeout(1600);
  const settled = await page.evaluate(() => ({
    heading: getComputedStyle(document.querySelector(".home-hero-heading")).transform,
    cta: getComputedStyle(document.querySelector(".home-hero-cta")).opacity,
    wordsComplete: [...document.querySelectorAll(".home-hero-word")].every((word) =>
      word.getAnimations().every((animation) => animation.playState === "finished"),
    ),
    phases: [
      "eyebrow",
      "lead",
      "outcome",
      "support",
      "action",
      "index-0",
      "index-1",
      "index-2",
    ].map((phase) => window.__heroEntrances.find((entry) => entry.phase === phase)),
    entriesComplete: [
      ...document.querySelectorAll(
        ".home-hero-eyebrow, .home-hero-support, .home-hero-actions, .home-hero-index > span",
      ),
    ].every((element) =>
      element.getAnimations().every((animation) => animation.playState === "finished"),
    ),
  }));
  if (settled.heading !== "none" && settled.heading !== "matrix(1, 0, 0, 1, 0, 0)")
    failures.push(`${label}: short entrance did not settle`);
  if (settled.cta !== "1") failures.push(`${label}: CTA is not visible`);
  if (!settled.wordsComplete) failures.push(`${label}: word entrance did not settle`);
  if (!settled.entriesComplete) failures.push(`${label}: hero sequence did not settle`);
  if (
    settled.phases.some((phase) => !phase) ||
    settled.phases.some(
      (phase, index, phases) =>
        index > 0 && phase && phases[index - 1] && phase.time - phases[index - 1].time < 30,
    )
  )
    failures.push(`${label}: hero phases did not enter in a perceptible sequence`);
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
    const touchLight = await page
      .locator(".home-hero-focus")
      .evaluate((element) =>
        element.getAnimations().some((animation) => animation.playState === "running"),
      );
    if (!touchLight) failures.push(`${label}: tap did not illuminate the nearby contours`);
    await page.screenshot({ caret: "initial", path: `${output}/${label}-touch.png` });
    await page.waitForTimeout(950);
    const pulseFinished = await page
      .locator(".home-hero-pulse")
      .evaluate((element) =>
        element.getAnimations().every((animation) => animation.playState === "finished"),
      );
    if (!pulseFinished) failures.push(`${label}: touch response kept running`);
    if (
      await page
        .locator(".home-hero-focus")
        .evaluate((element) => Number(getComputedStyle(element).opacity) > 0.01)
    )
      failures.push(`${label}: touch illumination did not return to rest`);
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
    await page.waitForTimeout(700);
    const depth = await page.evaluate(() => ({
      near: new DOMMatrix(
        getComputedStyle(document.querySelector(".home-hero-contour-near")).transform,
      ).m41,
      far: new DOMMatrix(
        getComputedStyle(document.querySelector(".home-hero-contour-far")).transform,
      ).m41,
      light: Number(getComputedStyle(document.querySelector(".home-hero-focus")).opacity),
      x: Number(document.querySelector(".home-hero-light").getAttribute("cx")),
      durations: new Set(
        [...document.querySelectorAll(".home-hero-currents path")].map(
          (path) => getComputedStyle(path).animationDuration,
        ),
      ).size,
    }));
    if (depth.near * depth.far >= 0 || depth.light < 0.9 || depth.x === 900 || depth.durations < 3)
      failures.push(
        `${label}: layered depth, local illumination or varied current timing is missing`,
      );
    await page.screenshot({ caret: "initial", path: `${output}/${label}-pointer.png` });
    await page.mouse.move(10, 880);
    await page.waitForTimeout(950);
    if (
      await page
        .locator(".home-hero-focus")
        .evaluate((element) => Number(getComputedStyle(element).opacity) > 0.01)
    )
      failures.push(`${label}: pointer illumination did not fade on leave`);
    await page.locator("#selected-work").evaluate((element) => element.scrollIntoView());
    await page.waitForFunction(
      () => document.querySelector(".home-hero").dataset.heroActive === "false",
    );
    const paused = await current.evaluate(
      (element) => getComputedStyle(element).animationPlayState,
    );
    if (paused !== "paused") failures.push(`${label}: decoration kept running offscreen`);
    if ((await page.locator(".home-hero").getAttribute("data-hero-focus")) === "true")
      failures.push(`${label}: interactive illumination stayed active offscreen`);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.screenshot({ caret: "initial", path: `${output}/${label}-settled.png` });
  if (label === "desktop" || label === "mobile") {
    const booking = page.locator(".home-hero-cta");
    await booking.focus();
    if (!(await booking.evaluate((element) => element === document.activeElement)))
      failures.push(`${label}: booking focus is missing`);
    await page.waitForFunction(
      () => document.querySelector(".home-hero").dataset.heroActive === "true",
    );
    await booking.evaluate((element) => element.blur());
    await booking.focus();
    if ((await page.locator(".home-hero").getAttribute("data-hero-focus")) !== "true")
      failures.push(`${label}: keyboard focus did not receive the contour response`);
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
  hasTouch: true,
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
  allContentStatic: [
    ...document.querySelectorAll("main [data-home-step], main .rv, main .item-rv"),
  ].every(
    (element) =>
      getComputedStyle(element).opacity === "1" &&
      getComputedStyle(element).animationName === "none",
  ),
}));
await page.touchscreen.tap(370, 140);
const reducedInteraction = await page.evaluate(() => ({
  pulse: document.querySelector(".home-hero-pulse").getAnimations().length,
  focus: getComputedStyle(document.querySelector(".home-hero-focus")).opacity,
}));
if (reducedInteraction.pulse !== 0 || reducedInteraction.focus !== "0")
  failures.push("reduced-motion touch started a decorative response");
if (
  !reduced.heading ||
  reduced.animation !== "none" ||
  reduced.cta !== "1" ||
  !reduced.wordsStatic ||
  !reduced.backgroundStatic ||
  !reduced.allContentStatic
)
  failures.push("reduced motion did not render the complete static hero");
await page.screenshot({ caret: "initial", path: `${output}/mobile-reduced.png` });
await context.close();
const delayedResults = [];
for (const [label, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const delayed = await browser.newContext({ viewport, hasTouch: viewport.width < 1000 });
  const delayedPage = await delayed.newPage();
  await delayedPage.route("**/_next/static/**/*.js*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await delayedPage.goto(baseUrl, { waitUntil: "commit", timeout: 60_000 });
  await delayedPage.waitForFunction(
    () =>
      document.querySelector(".home-hero-contours") &&
      getComputedStyle(document.querySelector(".home-hero-contours")).position === "absolute",
  );
  const pending = await delayedPage.evaluate(() => ({
    state: document.querySelector(".home-hero").dataset.revealState,
    readable: [
      ...document.querySelectorAll(".home-hero-word, .home-hero-support, .home-hero-actions"),
    ].every((element) => getComputedStyle(element).opacity === "1"),
    notStarted: [...document.querySelectorAll(".home-hero-word")].every(
      (word) => word.getAnimations().length === 0,
    ),
    chaptersPending: [...document.querySelectorAll(".home-sequence")].every(
      (group) => group.dataset.revealState === "pending",
    ),
  }));
  if (
    pending.state !== "pending" ||
    !pending.readable ||
    !pending.notStarted ||
    !pending.chaptersPending
  )
    failures.push(`${label}: entrance ran before delayed hydration or message was hidden`);
  await delayedPage.screenshot({
    caret: "initial",
    path: `${output}/${label}-delayed-hydration.png`,
  });
  await delayedPage.waitForFunction(
    () => document.querySelector(".home-hero").dataset.revealState === "visible",
  );
  await delayedPage.waitForTimeout(1600);
  const complete = await delayedPage
    .locator(".home-hero-word")
    .evaluateAll((words) =>
      words.every((word) =>
        word.getAnimations().every((animation) => animation.playState === "finished"),
      ),
    );
  if (!complete) failures.push(`${label}: entrance did not complete after delayed hydration`);
  delayedResults.push({ label, pending, complete });
  await delayed.close();
}
const noJS = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  javaScriptEnabled: false,
});
const staticPage = await noJS.newPage();
await staticPage.route("**/_next/static/css/**", async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  await route.continue();
});
await staticPage.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
// Disabled scripts let DOMContentLoaded precede CSS and stop in-page polling.
// Poll from the test process so computed-style checks cover the rendered hero.
let stylesReady = false;
for (let attempt = 0; attempt < 100 && !stylesReady; attempt++) {
  stylesReady = await staticPage.evaluate(
    () => getComputedStyle(document.querySelector(".home-hero-contours")).position === "absolute",
  );
  if (!stylesReady) await staticPage.waitForTimeout(100);
}
if (!stylesReady) failures.push("No-JavaScript hero stylesheet did not load");
const staticHero = await staticPage.evaluate(() => ({
  heading: document.querySelector(".home-hero-heading")?.textContent?.replace(/\s+/g, " "),
  cta: getComputedStyle(document.querySelector(".home-hero-cta")).opacity,
  wordsStatic: [...document.querySelectorAll(".home-hero-word")].every(
    (word) => getComputedStyle(word).animationName === "none",
  ),
  backgroundPaused:
    getComputedStyle(document.querySelector(".home-hero-contours")).animationPlayState === "paused",
  allContentReadable: [
    ...document.querySelectorAll("main [data-home-step], main .rv, main .item-rv"),
  ].every(
    (element) =>
      getComputedStyle(element).opacity === "1" &&
      getComputedStyle(element).animationName === "none",
  ),
}));
if (
  !/make more money.*save more time/.test(staticHero.heading ?? "") ||
  staticHero.cta !== "1" ||
  !staticHero.wordsStatic ||
  !staticHero.backgroundPaused ||
  !staticHero.allContentReadable
)
  failures.push("No-JavaScript hero did not remain complete and static");
await staticPage.screenshot({ caret: "initial", path: `${output}/desktop-no-js.png` });
await noJS.close();
await browser.close();
await writeFile(
  `${output}/results.json`,
  JSON.stringify(
    {
      result: failures.length ? "failed" : "passed",
      results,
      reduced,
      delayedResults,
      staticHero,
      failures,
    },
    null,
    2,
  ),
);

if (failures.length) {
  console.error(JSON.stringify({ result: "failed", failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ result: "passed", screenshots: output }, null, 2));
