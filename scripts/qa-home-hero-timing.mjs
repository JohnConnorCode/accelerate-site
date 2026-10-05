import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const output = "/tmp/accelerate-home-hero-timing";
await mkdir(output, { recursive: true });
// Exercise WebGL on GPU-less Linux CI through Chromium's documented GL driver.
// These are disposable test browsers; application fallback behavior is tested below.
const browser = await chromium.launch({
  headless: true,
  args: process.platform === "linux" ? ["--use-gl=angle", "--use-angle=swiftshader"] : [],
});
const failures = [];
const results = [];
const entranceFrames = [];

// Inspect actual rendered frames, not just animation names or a changed transform.
for (const [label, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 1000 });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => document.querySelector(".home-hero")?.classList.contains("in"));
  await page.evaluate(() => {
    window.__heroFrameAnimations = document
      .querySelector(".home-hero")
      .getAnimations({ subtree: true })
      .filter((animation) =>
        /^home-hero-(word|label|detail|action)-enter$/.test(animation.animationName),
      );
    window.__heroFrameAnimations.forEach((animation) => animation.pause());
  });
  for (const time of [0, 600, 1000, 1600, 2300, 3200]) {
    await page.evaluate((time) => {
      window.__heroFrameAnimations.forEach((animation) => {
        animation.currentTime = time;
      });
    }, time);
    const frame = await page.evaluate(() => {
      const booking = document.querySelector(".home-hero-cta").getBoundingClientRect();
      const hit = document.elementFromPoint(
        booking.x + booking.width / 2,
        booking.y + booking.height / 2,
      );
      const visibleWords = (selector) =>
        [...document.querySelectorAll(selector)].filter((word) => {
          const style = getComputedStyle(word);
          return (
            Number(style.opacity) > 0.1 &&
            new DOMMatrix(style.transform).m42 < word.getBoundingClientRect().height * 0.95
          );
        }).length;
      const lines = [];
      for (const mask of document.querySelectorAll(".home-hero-word-mask")) {
        const word = mask.querySelector(".home-hero-word");
        const top = mask.getBoundingClientRect().top;
        let line = lines.at(-1);
        if (!line || Math.abs(line.top - top) > 4) {
          line = { top, words: 0, visible: 0, delays: [] };
          lines.push(line);
        }
        line.words++;
        line.visible += visibleWordsForWord(word);
        line.delays.push(getComputedStyle(word).animationDelay);
      }
      function visibleWordsForWord(word) {
        const style = getComputedStyle(word);
        return Number(
          Number(style.opacity) > 0.1 &&
            new DOMMatrix(style.transform).m42 < word.getBoundingClientRect().height * 0.95,
        );
      }
      return {
        lines,
        artwork: Number(getComputedStyle(document.querySelector(".home-hero-artwork")).opacity),
        lead: visibleWords(".home-hero-lead .home-hero-word"),
        outcome: visibleWords(".home-hero-heading em .home-hero-word"),
        action: Number(getComputedStyle(document.querySelector(".home-hero-actions")).opacity),
        actionReceivesPointer: Boolean(hit?.closest(".home-hero-cta")),
        support: Number(getComputedStyle(document.querySelector(".home-hero-support")).opacity),
        masks: [...document.querySelectorAll(".home-hero-word-mask")].every(
          (mask) => getComputedStyle(mask).clipPath !== "none",
        ),
      };
    });
    if (
      time === 0 &&
      (frame.lead || frame.outcome || frame.action || frame.support || frame.artwork)
    )
      failures.push(`${label}: opening frame exposes content before its entrance`);
    if (
      frame.lines.some(
        (line) =>
          new Set(line.delays).size !== 1 || (line.visible !== 0 && line.visible !== line.words),
      )
    )
      failures.push(`${label}: a rendered line breaks into separate word entrances`);
    if (
      time === 600 &&
      (!frame.lines[0]?.visible ||
        frame.lines.slice(1).some((line) => line.visible) ||
        frame.action ||
        frame.support)
    )
      failures.push(`${label}: the first readable line did not enter before later content`);
    if (
      time === 1000 &&
      (frame.lines.filter((line) => line.visible).length < 2 || frame.action || frame.support)
    )
      failures.push(`${label}: headline lines lack a measured reveal before supporting content`);
    if (time === 1600 && (!frame.action || !frame.support))
      failures.push(`${label}: explanation and booking did not follow the headline`);
    if (frame.action === 0 && frame.actionReceivesPointer)
      failures.push(`${label}: concealed booking action still accepts pointer clicks`);
    if (time === 3200 && !frame.actionReceivesPointer)
      failures.push(`${label}: completed booking action cannot receive pointer clicks`);
    if (time === 3200 && (frame.action !== 1 || frame.support !== 1 || !frame.masks))
      failures.push(`${label}: completed entrance is incomplete or has no word masks`);
    if (time === 3200 && frame.artwork < 0.2)
      failures.push(`${label}: artwork did not complete its entrance`);
    entranceFrames.push({ label, time, ...frame });
    await page.screenshot({ caret: "initial", path: `${output}/${label}-frame-${time}.png` });
  }
  await page.evaluate(() =>
    window.__heroFrameAnimations.forEach((animation) => animation.finish()),
  );
  await page.waitForFunction(
    () => document.querySelector(".home-hero-artwork").dataset.artworkReady === "true",
  );
  await page.evaluate(() => {
    window.__heroFrameAnimations
      .filter((animation) => animation.effect.target.matches(".home-hero-artwork"))
      .forEach((animation) => (animation.currentTime = 0));
  });
  await page.getByRole("button", { name: "Pause hero animation" }).focus();
  const focusedArtwork = await page.locator(".home-hero-artwork").evaluate((element) => ({
    visible: getComputedStyle(element).opacity === "1",
    bookingFirst: Boolean(
      document
        .querySelector(".home-hero-cta")
        .compareDocumentPosition(element.querySelector("button")) &
      Node.DOCUMENT_POSITION_FOLLOWING,
    ),
  }));
  if (!focusedArtwork.visible || !focusedArtwork.bookingFirst)
    failures.push(
      `${label}: motion control has concealed focus or precedes booking in the reading order`,
    );
  await context.close();
}

for (const [label, viewport, colorScheme] of [
  ["desktop", { width: 1440, height: 900 }, "light"],
  ["desktop-dark", { width: 1440, height: 900 }, "dark"],
  ["small-desktop", { width: 1024, height: 900 }, "light"],
  ["tablet", { width: 820, height: 1180 }, "light"],
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
    ...(label === "desktop" || label === "mobile"
      ? { recordVideo: { dir: `${output}/video`, size: viewport } }
      : {}),
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
    const style = getComputedStyle(heading);
    const cta = document.querySelector(".home-hero-cta");
    return {
      heading: heading?.textContent?.trim(),
      cta: cta?.textContent?.trim(),
      aboveFold: cta?.getBoundingClientRect().bottom <= innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      headingFontSize: parseFloat(style.fontSize),
      headingLines: heading.getBoundingClientRect().height / parseFloat(style.lineHeight),
      headingUniform: [...heading.querySelectorAll(".home-hero-word")].every(
        (word) => getComputedStyle(word).font === style.font,
      ),
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
  if (!opening.headingUniform || opening.headingFontSize < 34 || opening.headingLines > 6.1)
    failures.push(`${label}: headline mixes typography or wraps into an unreadable composition`);
  await page.screenshot({ caret: "initial", path: `${output}/${label}-first.png` });
  await page.waitForFunction(
    () => document.querySelector(".home-hero").dataset.revealState === "visible",
  );
  if (label === "desktop" || label === "mobile") {
    await page.screenshot({ caret: "initial", path: `${output}/${label}-entry.png` });
    await page.waitForTimeout(300);
    await page.screenshot({ caret: "initial", path: `${output}/${label}-sequence.png` });
  }
  await page.waitForTimeout(3000);
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
  const artwork = page.locator(".home-hero-artwork");
  const canvas = page.locator(".home-hero-canvas");
  await page.waitForFunction(
    () => document.querySelector(".home-hero-artwork").dataset.artworkReady === "true",
  );
  const start = await canvas.screenshot();
  await page.waitForTimeout(3000);
  const moving = await canvas.screenshot();
  if (start.equals(moving))
    failures.push(`${label}: rendered artwork is static during a three-second visit`);
  await page.getByRole("button", { name: "Pause hero animation" }).click();
  await page.waitForTimeout(300);
  const paused = await canvas.screenshot();
  if (touch) {
    const bounds = await canvas.boundingBox();
    await page.touchscreen.tap(bounds.x + bounds.width * 0.65, bounds.y + bounds.height * 0.4);
  } else await page.mouse.move(viewport.width * 0.85, 320);
  await page.waitForTimeout(800);
  const resting = await canvas.screenshot();
  if (!paused.equals(resting) || (await artwork.getAttribute("data-motion-state")) !== "paused")
    failures.push(
      `${label}: pause does not stop actual pixels, or pointer movement changes the composition`,
    );
  await page.getByRole("button", { name: "Play hero animation" }).click();
  await page.waitForTimeout(800);
  if (resting.equals(await canvas.screenshot()))
    failures.push(`${label}: play does not resume rendered motion`);
  const artworkMotion = await canvas.evaluate((element) => ({
    width: element.width,
    height: element.height,
    density: element.width / element.getBoundingClientRect().width,
    state: element.parentElement.dataset.motionState,
  }));
  if (artworkMotion.density > 1.51)
    failures.push(`${label}: artwork exceeds its pixel-density budget`);
  await page.locator("#selected-work").evaluate((element) => element.scrollIntoView());
  await page.waitForFunction(
    () => document.querySelector(".home-hero-artwork").dataset.motionState === "paused",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(
    () => document.querySelector(".home-hero-artwork").dataset.motionState === "playing",
  );
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
    await page.keyboard.press("Enter");
    await page.waitForURL(`${baseUrl}/contact`);
    await page.goBack({ waitUntil: "domcontentloaded" });
    const restored = await page
      .locator(".home-hero-actions")
      .evaluate((element) => Number(getComputedStyle(element).opacity));
    if (restored !== 1) failures.push(`${label}: booking action concealed after Back`);
    // A forward client navigation is a fresh entrance, even after a history restore.
    await page.goto(`${baseUrl}/services`, { waitUntil: "domcontentloaded" });
    const homeLink = page.locator('header .logo-link[href="/"]');
    await homeLink.hover();
    await page.waitForTimeout(350);
    // Sample in the page before the click/URL round trip can outlast the entrance.
    await page.evaluate(() => {
      window.__heroForwardSample = null;
      const sample = () => {
        const hero = document.querySelector(".home-hero");
        const word = hero?.querySelector(".home-hero-word");
        const entrance = word
          ?.getAnimations()
          .find((animation) => animation.animationName === "home-hero-word-enter");
        if (
          location.pathname !== "/" ||
          !hero?.classList.contains("in") ||
          !entrance ||
          typeof entrance.currentTime !== "number" ||
          entrance.currentTime === 0
        ) {
          requestAnimationFrame(sample);
          return;
        }
        window.__heroForwardSample = {
          kind: document.documentElement.dataset.navigationKind,
          animated: getComputedStyle(word).animationName,
          immediate: hero.classList.contains("reveal-immediate"),
          playState: entrance.playState,
          currentTime: entrance.currentTime,
          endTime: entrance.effect.getComputedTiming().endTime,
          action: Number(getComputedStyle(hero.querySelector(".home-hero-actions")).opacity),
        };
      };
      requestAnimationFrame(sample);
    });
    await homeLink.click();
    await page.waitForURL(`${baseUrl}/`);
    await page.waitForFunction(() => window.__heroForwardSample, null, { timeout: 10_000 });
    const forward = await page.evaluate(() => window.__heroForwardSample);
    settled.forward = forward;
    // A client commit can be observed partway through its entrance. Require
    // a live, fresh animation clock; concealed opening frames are tested above.
    if (
      forward.kind !== "fresh" ||
      forward.animated !== "home-hero-word-enter" ||
      forward.immediate ||
      forward.playState !== "running" ||
      forward.currentTime >= forward.endTime
    )
      failures.push(
        `${label}: prefetched forward navigation skipped the fresh entrance: ${JSON.stringify(forward)}`,
      );
    await page.waitForTimeout(3000);
  }
  results.push({ label, viewport, colorScheme, opening, settled, artworkMotion });
  await context.close();
  if (page.video()) await page.video().saveAs(`${output}/${label}-entrance.webm`);
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
  backgroundStatic: document.querySelector(".home-hero-artwork").dataset.motionState === "paused",
  allContentStatic: [
    ...document.querySelectorAll("main [data-home-step], main .rv, main .item-rv"),
  ].every(
    (element) =>
      getComputedStyle(element).opacity === "1" &&
      getComputedStyle(element).animationName === "none",
  ),
}));
await page.touchscreen.tap(370, 140);
const reducedCanvas = page.locator(".home-hero-canvas");
await page.waitForTimeout(500);
const reducedFrame = await reducedCanvas.screenshot();
await page.waitForTimeout(800);
if (!reducedFrame.equals(await reducedCanvas.screenshot()))
  failures.push("Reduced motion changes the rendered artwork");
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
      document.querySelector(".home-hero-poster") &&
      getComputedStyle(document.querySelector(".home-hero-poster")).position === "absolute",
  );
  const pending = await delayedPage.evaluate(() => ({
    state: document.querySelector(".home-hero").dataset.revealState,
    concealed: [
      ...document.querySelectorAll(".home-hero-word, .home-hero-support, .home-hero-actions"),
    ].every((element) => getComputedStyle(element).opacity === "0"),
    masked: [...document.querySelectorAll(".home-hero-word")].every((word) => {
      const mask = word.parentElement;
      return (
        getComputedStyle(mask).clipPath !== "none" &&
        new DOMMatrix(getComputedStyle(word).transform).m42 >= word.getBoundingClientRect().height
      );
    }),
    notStarted: [...document.querySelectorAll(".home-hero-word")].every(
      (word) => word.getAnimations().length === 0,
    ),
    chaptersPending: [...document.querySelectorAll(".home-sequence")].every(
      (group) => group.dataset.revealState === "pending",
    ),
  }));
  if (
    pending.state !== "pending" ||
    !pending.concealed ||
    !pending.masked ||
    !pending.notStarted ||
    !pending.chaptersPending
  )
    failures.push(`${label}: pending hero was visible before hydration or has no full word mask`);
  await delayedPage.screenshot({
    caret: "initial",
    path: `${output}/${label}-delayed-hydration.png`,
  });
  await delayedPage.locator(".home-hero-cta").focus();
  if (
    (await delayedPage.locator(".home-hero-actions").evaluate((element) => {
      const style = getComputedStyle(element);
      return style.opacity === "1" && style.pointerEvents === "auto";
    })) !== true
  )
    failures.push(`${label}: keyboard focus did not expose the pending booking action`);
  await delayedPage.locator(".home-hero-cta").evaluate((element) => element.blur());
  await delayedPage.waitForFunction(
    () => document.querySelector(".home-hero").dataset.revealState === "visible",
  );
  await delayedPage.waitForTimeout(3000);
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
// A real late runtime must recover ambient artwork after the four-second
// fail-open watchdog, without concealing foreground content a second time.
const lateRuntime = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const latePage = await lateRuntime.newPage();
await latePage.route("**/_next/static/**/*.js*", async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await route.continue();
});
await latePage.goto(baseUrl, { waitUntil: "commit", timeout: 60_000 });
await latePage.waitForFunction(
  () =>
    document.querySelector(".home-hero-poster") &&
    getComputedStyle(document.querySelector(".home-hero-poster")).position === "absolute",
);
await latePage.waitForFunction(() => !document.documentElement.classList.contains("motion-ready"));
const lateReadable = await latePage
  .locator(".home-hero")
  .evaluate((hero) =>
    [...hero.querySelectorAll(".home-hero-word, .home-hero-support, .home-hero-actions")].every(
      (element) => getComputedStyle(element).opacity === "1",
    ),
  );
await latePage.waitForFunction(
  () => document.querySelector(".home-hero").dataset.heroActive === "true",
);
const lateRecovery = await latePage.locator(".home-hero").evaluate((hero) => ({
  readable: [
    ...hero.querySelectorAll(".home-hero-word, .home-hero-support, .home-hero-actions"),
  ].every((element) => getComputedStyle(element).opacity === "1"),
  wordsStatic: [...hero.querySelectorAll(".home-hero-word")].every(
    (element) => element.getAnimations().length === 0,
  ),
  moving:
    hero.querySelector(".home-hero-artwork").dataset.motionState === "playing" &&
    hero.querySelector(".home-hero-artwork").dataset.artworkReady === "true",
}));
if (!lateReadable || !lateRecovery.readable || !lateRecovery.wordsStatic || !lateRecovery.moving)
  failures.push("Late hydration left artwork static or concealed readable foreground again");
delayedResults.push({ label: "watchdog-then-hydration", lateReadable, ...lateRecovery });
await latePage.screenshot({ caret: "initial", path: `${output}/desktop-late-runtime.png` });
await lateRuntime.close();
const failedRuntime = await browser.newContext({ viewport: { width: 390, height: 844 } });
await failedRuntime.route("**/_next/static/**/*.js*", (route) => route.abort());
const failedRuntimePage = await failedRuntime.newPage();
await failedRuntimePage.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
await failedRuntimePage.waitForFunction(
  () => !document.documentElement.classList.contains("motion-ready"),
);
const watchdog = await failedRuntimePage.evaluate(() => ({
  readable: [
    ...document.querySelectorAll(".home-hero-word, .home-hero-support, .home-hero-actions"),
  ].every(
    (element) =>
      getComputedStyle(element).opacity === "1" &&
      getComputedStyle(element).animationName === "none",
  ),
  hydrated: document.documentElement.hasAttribute("data-motion-hydrated"),
}));
if (!watchdog.readable || watchdog.hydrated)
  failures.push("Failed runtime did not expose the static hero through the watchdog");
await failedRuntimePage.screenshot({
  caret: "initial",
  path: `${output}/mobile-failed-runtime.png`,
});
await failedRuntime.close();
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
    () => getComputedStyle(document.querySelector(".home-hero-poster")).position === "absolute",
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
  backgroundStatic:
    document.querySelector(".home-hero-artwork").dataset.artworkReady === "false" &&
    getComputedStyle(document.querySelector(".home-hero-poster")).opacity === "1" &&
    document.querySelectorAll(".home-hero-poster path").length > 0,
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
  !staticHero.backgroundStatic ||
  !staticHero.allContentReadable
)
  failures.push("No-JavaScript hero did not remain complete and static");
await staticPage.screenshot({ caret: "initial", path: `${output}/desktop-no-js.png` });
await noJS.close();
const gpuFallbacks = [];
for (const mode of ["unavailable", "context-lost"]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (mode === "unavailable")
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return type === "webgl" ? null : original.call(this, type, ...args);
      };
    });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3500);
  if (mode === "context-lost") {
    await page.waitForFunction(
      () => document.querySelector(".home-hero-artwork").dataset.artworkReady === "true",
    );
    const lost = await page.locator(".home-hero-canvas").evaluate((element) => {
      const extension = element.getContext("webgl").getExtension("WEBGL_lose_context");
      extension?.loseContext();
      return Boolean(extension);
    });
    if (!lost) failures.push("GPU loss test could not induce a real lost context");
    await page.waitForFunction(
      () => document.querySelector(".home-hero-artwork").dataset.artworkReady === "false",
    );
    await page.evaluate(() => document.documentElement.classList.toggle("dark"));
    await page.waitForTimeout(600);
  }
  const fallback = await page.evaluate(() => ({
    ready: document.querySelector(".home-hero-artwork").dataset.artworkReady,
    state: document.querySelector(".home-hero-artwork").dataset.motionState,
    poster: getComputedStyle(document.querySelector(".home-hero-poster")).opacity,
    booking: getComputedStyle(document.querySelector(".home-hero-actions")).opacity,
  }));
  if (
    fallback.ready !== "false" ||
    fallback.state !== "paused" ||
    fallback.poster !== "1" ||
    fallback.booking !== "1"
  )
    failures.push(`${mode}: GPU failure hid the poster or booking action`);
  await page.screenshot({ path: `${output}/gpu-${mode}.png` });
  gpuFallbacks.push({ mode, ...fallback });
  await context.close();
}
await browser.close();

// WebKit verifies the actual canvas or an explicit GPU-unavailable poster.
const webkitArtwork = [];
const webkitBrowser = await webkit.launch({ headless: true });
for (const [label, viewport, touch] of [
  ["webkit-desktop", { width: 1440, height: 900 }, false],
  ["webkit-mobile", { width: 390, height: 844 }, true],
]) {
  const context = await webkitBrowser.newContext({ viewport, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(`${label}: ${error.message}`));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message
        .text()
        .includes("was delivered in report-only mode, but does not specify a 'report-to'")
    )
      failures.push(`${label}: ${message.text()}`);
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3500);
  const ready = await page.locator(".home-hero-artwork").getAttribute("data-artwork-ready");
  const canvas = page.locator(".home-hero-canvas");
  if (ready === "true") {
    const first = await canvas.screenshot();
    await page.waitForTimeout(1500);
    if (first.equals(await canvas.screenshot())) failures.push(`${label}: GPU artwork is static`);
    await page.getByRole("button", { name: "Pause hero animation" }).click();
    await page.waitForTimeout(300);
    const paused = await canvas.screenshot();
    await page.waitForTimeout(600);
    if (!paused.equals(await canvas.screenshot()))
      failures.push(`${label}: pause does not freeze the artwork`);
  } else {
    if (
      !(await page
        .locator(".home-hero-poster")
        .evaluate(
          (element) =>
            getComputedStyle(element).opacity === "1" &&
            element.querySelectorAll("path").length > 0,
        ))
    )
      failures.push(`${label}: unavailable GPU has no visible poster`);
  }
  if (!(await page.locator(".home-hero-cta").isVisible()))
    failures.push(`${label}: booking is unavailable`);
  await page.screenshot({ path: `${output}/${label}-settled.png` });
  webkitArtwork.push({
    label,
    viewport,
    ready,
    mode: ready === "true" ? "WebGL" : "static GPU fallback",
  });
  await context.close();
}
await webkitBrowser.close();
await writeFile(
  `${output}/results.json`,
  JSON.stringify(
    {
      result: failures.length ? "failed" : "passed",
      results,
      entranceFrames,
      reduced,
      delayedResults,
      watchdog,
      staticHero,
      webkitArtwork,
      gpuFallbacks,
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
