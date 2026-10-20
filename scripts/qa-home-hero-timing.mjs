import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import {
  installHeroMotionObserver,
  hasPerceptibleHeroSequence,
  hasFreshHeroEntrance,
} from "./lib/hero-motion-observer.mjs";

const hosted = process.env.HERO_QA_TARGET_URL;
if (hosted) {
  const target = new URL(hosted);
  if (
    target.protocol !== "https:" ||
    target.port ||
    target.username ||
    target.password ||
    target.pathname !== "/" ||
    target.search ||
    target.hash ||
    !(
      target.hostname === "www.acceleratewith.us" ||
      /^accelerate-site-[a-z0-9]+-john-connors-projects-d9df1dfe\.vercel\.app$/.test(
        target.hostname,
      )
    )
  )
    throw new Error("Hosted hero QA requires an exact authorized Accelerate homepage URL.");
}
const baseUrl = (hosted || process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010").replace(
  /\/$/,
  "",
);
const output = process.env.HERO_QA_OUTPUT || "/tmp/accelerate-home-hero-timing";
await mkdir(output, { recursive: true });
// Reuse the existing native Chromium/WebKit CI lane for rendered interaction QA.
// SVG uses the native renderer; the former WebGL scene needed a forced GL driver.
const browser = await chromium.launch({ headless: true });
const failures = [];
const results = [];
const entranceFrames = [];

async function exerciseDockDismissal(page, label) {
  const samples = [];
  // The workshop announcement takes the dock's place while it is shown.
  await page.evaluate(() => window.scrollTo({ top: innerHeight * 2, behavior: "instant" }));
  const announcement = page.getByRole("button", { name: "Dismiss workshop announcement" });
  if (
    await announcement
      .waitFor({ state: "visible", timeout: 3000 })
      .then(() => true)
      .catch(() => false)
  )
    await announcement.click();
  for (const rapid of [false, true]) {
    await page.evaluate(() => window.scrollTo({ top: innerHeight * 2, behavior: "instant" }));
    await page.waitForFunction(() => document.body.dataset.mcta === "on");
    await page.locator("[data-dock] a").focus();
    await page.evaluate(async (rapid) => {
      if (rapid) {
        window.scrollTo({ top: 0, behavior: "instant" });
        await new Promise(requestAnimationFrame);
        window.scrollTo({ top: innerHeight * 2, behavior: "instant" });
        await new Promise(requestAnimationFrame);
      }
      window.__dockReturnedAt = performance.now();
      window.scrollTo({ top: 0, behavior: "instant" });
    }, rapid);
    for (const delay of [50, 400]) {
      await page.waitForTimeout(delay);
      const sample = await page.evaluate(() => {
        const dock = document.querySelector("[data-dock]");
        const targets = [...document.querySelectorAll(".home-flow-input, .home-hero-cta")].map(
          (target) => {
            const box = target.getBoundingClientRect();
            const left = Math.max(0, box.left),
              right = Math.min(innerWidth, box.right);
            const top = Math.max(0, box.top),
              bottom = Math.min(innerHeight, box.bottom);
            const point =
              right > left && bottom > top
                ? { x: (left + right) / 2, y: (top + bottom) / 2 }
                : null;
            const hit = point && document.elementFromPoint(point.x, point.y);
            const style = getComputedStyle(target);
            return {
              name: target.getAttribute("aria-label") || target.className,
              box: box.toJSON(),
              point,
              hit: !point || target.contains(hit),
              hitTarget: hit?.getAttribute("class") || hit?.tagName || null,
              opacity: style.opacity,
              pointerEvents: style.pointerEvents,
              animation: style.animationName,
            };
          },
        );
        return {
          elapsed: performance.now() - window.__dockReturnedAt,
          heroActionReady: document.querySelector(".home-hero")?.dataset.heroActionReady,
          sharedVisible: document.body.dataset.mcta === "on",
          retained: Boolean(dock),
          visible: Boolean(dock?.checkVisibility({ visibilityProperty: true })),
          focused: Boolean(dock?.contains(document.activeElement)),
          targets,
        };
      });
      if (
        sample.sharedVisible ||
        sample.visible ||
        sample.focused ||
        sample.targets.some((target) => !target.hit)
      )
        failures.push(
          `${label}: dismissed booking dock obscures or retains focus on ${rapid ? "rapid" : "normal"} scroll return`,
        );
      samples.push({ rapid, ...sample });
    }
    const hiddenFocus = await page.evaluate(() => {
      const link = document.querySelector("[data-dock] a");
      link?.focus();
      return Boolean(link && document.activeElement === link);
    });
    if (hiddenFocus) failures.push(`${label}: dismissed booking dock still accepts focus`);
    await page.locator(".home-hero-cta").focus();
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => Boolean(document.activeElement?.closest("[data-dock]"))))
      failures.push(`${label}: keyboard enters the dismissed booking dock`);
    await page.evaluate(() => document.activeElement?.blur());
  }
  await writeFile(`${output}/${label}-dock-dismissal.json`, JSON.stringify(samples, null, 2));
  return samples;
}

// The labeled flow must read cleanly, route each workflow to its two actions,
// walk every phase in live motion, stay still under reduced motion, and stop
// its clock offscreen. At phone width the activity stream carries the story.
async function exerciseArtwork(page, label, reduced = false) {
  const artwork = page.locator(".home-flow");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    () => document.querySelector(".home-flow")?.dataset.artworkReady === "true",
  );
  const shown = await artwork.isVisible();
  if (page.viewportSize().width <= 640) {
    if (shown) failures.push(`${label}: flow artwork should yield to the stream at phone width`);
    return { hidden: true, dockDismissal: await exerciseDockDismissal(page, label) };
  }
  if (!shown) failures.push(`${label}: flow artwork is not visible`);
  const layout = await artwork.evaluate((root) => {
    const box = (element) => element.getBoundingClientRect();
    const intersects = (a, b) =>
      a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const parts = [...root.querySelectorAll(".home-flow-chip, .home-flow-core")].map(box);
    const area = box(root);
    return {
      labels: [...root.querySelectorAll(".home-flow-chip")].map((chip) => chip.textContent.trim()),
      clipped: [...root.querySelectorAll(".home-flow-chip")].some(
        (chip) => chip.scrollWidth > chip.clientWidth + 1,
      ),
      overlap: parts.some((a, i) => parts.some((b, j) => i < j && intersects(a, b))),
      collides: [".home-hero-heading", ".home-hero-support", ".home-hero-actions"].some(
        (selector) => intersects(area, box(document.querySelector(selector))),
      ),
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      sculptureLayers: root.querySelectorAll(".home-flow-sculpture-layer").length,
      solidFaces: root.querySelectorAll(".home-flow-sculpture-layer path").length,
    };
  });
  if (layout.labels.length !== 6 || layout.labels.some((text) => !text))
    failures.push(`${label}: flow is missing a labeled input or action`);
  if (layout.clipped || layout.overlap || layout.collides || layout.pageOverflow)
    failures.push(`${label}: flow clips, overlaps, or collides with the hero copy`);
  if (layout.sculptureLayers !== 3 || layout.solidFaces < 9)
    failures.push(`${label}: the arrow sculpture lost its extruded faces`);

  const core = artwork.locator(".home-flow-core");
  const restingPose = await core.evaluate((element) => getComputedStyle(element).transform);
  const bounds = await artwork.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * 0.85, bounds.y + bounds.height * 0.2);
  if (reduced) {
    if ((await core.evaluate((element) => getComputedStyle(element).transform)) !== restingPose)
      failures.push(`${label}: reduced motion still responds with perspective movement`);
  } else {
    await page.waitForFunction(
      (resting) =>
        getComputedStyle(document.querySelector(".home-flow-core")).transform !== resting,
      restingPose,
    );
  }
  await page.mouse.move(1, 1);

  const journeys = [];
  const expectedActions = [
    ["Message sent", "Record updated"],
    ["Record updated", "Task created"],
    ["Message sent", "Task created"],
  ];
  for (const index of [2, 1, 0]) {
    await artwork.locator(".home-flow-input").nth(index).click();
    await page.waitForFunction(
      (index) => {
        const root = document.querySelector(".home-flow");
        return root.dataset.source === String(index) && root.dataset.phase === "done";
      },
      index,
      { timeout: 6000 },
    );
    const state = await artwork.evaluate((root) => ({
      pressed: [...root.querySelectorAll(".home-flow-input")].map((button) =>
        button.getAttribute("aria-pressed"),
      ),
      complete: [...root.querySelectorAll('.home-flow-output[data-complete="true"]')].map(
        (output) => output.textContent.trim(),
      ),
      status: root.querySelector('[role="status"]').textContent,
      caption: root.querySelector(".home-flow-caption").textContent,
      formation: [...root.querySelectorAll(".home-flow-sculpture-top")].map((face) =>
        face.getAttribute("d"),
      ),
    }));
    if (
      state.pressed.filter((value) => value === "true").length !== 1 ||
      state.pressed[index] !== "true" ||
      JSON.stringify(state.complete) !== JSON.stringify(expectedActions[index]) ||
      !state.status
    )
      failures.push(`${label}: workflow ${index} did not route to its announced actions`);
    journeys.push({ index, ...state });
  }
  if (new Set(journeys.map((journey) => journey.formation.join(" "))).size !== 3)
    failures.push(`${label}: workflow selection did not change the arrow formation`);

  let motion;
  if (reduced) {
    motion = await artwork.evaluate((root) => ({
      state: root.dataset.motion,
      running: root
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === "running").length,
    }));
    if (motion.state !== "reduced" || motion.running)
      failures.push(`${label}: reduced motion still animates the flow`);
  } else {
    const phases = await artwork.evaluate(
      (root) =>
        new Promise((resolve) => {
          const seen = new Set([root.dataset.phase]);
          const observer = new MutationObserver(() => seen.add(root.dataset.phase));
          observer.observe(root, { attributes: true, attributeFilter: ["data-phase"] });
          setTimeout(() => {
            observer.disconnect();
            resolve([...seen]);
          }, 6000);
        }),
    );
    if (!["intake", "thinking", "acting", "done"].every((phase) => phases.includes(phase)))
      failures.push(`${label}: live flow skipped a phase: ${phases.join(", ")}`);
    await page.evaluate(() => window.scrollTo({ top: innerHeight * 2, behavior: "instant" }));
    await page.waitForFunction(
      () => document.querySelector(".home-flow").dataset.motion === "suspended",
    );
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForFunction(
      () => document.querySelector(".home-flow").dataset.motion === "live",
    );
    motion = { phases, suspendsOffscreen: true };
  }
  return { layout, journeys, motion, dockDismissal: await exerciseDockDismissal(page, label) };
}

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
  for (const time of [0, 300, 700, 1600, 2300, 3200]) {
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
        artwork: document.querySelector(".home-hero-artwork").checkVisibility()
          ? Number(getComputedStyle(document.querySelector(".home-hero-artwork")).opacity)
          : 0,
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
      time === 300 &&
      (!frame.lines[0]?.visible ||
        frame.lines.slice(1).some((line) => line.visible) ||
        frame.action ||
        frame.support)
    )
      failures.push(`${label}: the first readable line did not enter before later content`);
    if (
      time === 700 &&
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
    if (time === 3200 && viewport.width > 640 && frame.artwork < 0.2)
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
  if (await page.locator(".home-hero-artwork").isVisible()) {
    await page.locator(".home-flow-input").first().focus();
    const focusedArtwork = await page.locator(".home-hero-artwork").evaluate((element) => ({
      visible: getComputedStyle(element).opacity === "1",
      focused: element.querySelector("button") === document.activeElement,
      bookingFirst: Boolean(
        document
          .querySelector(".home-hero-cta")
          .compareDocumentPosition(element.querySelector("button")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    }));
    if (!focusedArtwork.visible || !focusedArtwork.focused || !focusedArtwork.bookingFirst)
      failures.push(
        `${label}: input control has concealed focus or precedes booking in the reading order`,
      );
  } else {
    await page.locator(".home-hero-cta").focus();
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => Boolean(document.activeElement?.closest(".home-flow"))))
      failures.push(`${label}: keyboard entered the hidden phone artwork`);
  }
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
  await context.addInitScript(installHeroMotionObserver);
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
      fullMessage: /Custom AI systems that run the work behind your business/.test(
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
    phases: ["eyebrow", "lead", "outcome", "support", "action"].map((phase) =>
      window.__heroEntrances.find((entry) => entry.phase === phase),
    ),
    entriesComplete: [
      ...document.querySelectorAll(".home-hero-eyebrow, .home-hero-support, .home-hero-actions"),
    ].every((element) =>
      element.getAnimations().every((animation) => animation.playState === "finished"),
    ),
  }));
  if (settled.heading !== "none" && settled.heading !== "matrix(1, 0, 0, 1, 0, 0)")
    failures.push(`${label}: short entrance did not settle`);
  if (settled.cta !== "1") failures.push(`${label}: CTA is not visible`);
  if (!settled.wordsComplete) failures.push(`${label}: word entrance did not settle`);
  if (!settled.entriesComplete) failures.push(`${label}: hero sequence did not settle`);
  if (!hasPerceptibleHeroSequence(settled.phases))
    failures.push(`${label}: hero phases did not enter in a perceptible sequence`);
  await page.waitForFunction(
    () => document.querySelector(".home-hero").dataset.heroActive === "true",
  );
  const artworkMotion = await exerciseArtwork(page, label);
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
    await page.evaluate(() => {
      window.__heroForward = null;
      window.__heroForwardArmedAt = performance.now();
    });
    await homeLink.click();
    await page.waitForURL(`${baseUrl}/`);
    await page.waitForFunction(() =>
      document.querySelector(".home-hero")?.classList.contains("in"),
    );
    // Wait for a captured entry, never poll the current animation until green.
    // A missing entry still fails; an already completed navigation cannot erase
    // the running clock observed inside the browser when the entrance began.
    await page
      .waitForFunction(() => window.__heroForward, undefined, { timeout: 5000 })
      .catch(() => {});
    const forward = await page.evaluate(() => window.__heroForward);
    settled.forward = forward;
    if (!hasFreshHeroEntrance(forward))
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
await page.waitForFunction(() => document.querySelector(".home-flow").dataset.motion === "reduced");
const reduced = await page.evaluate(() => ({
  heading: document.querySelector(".home-hero-heading")?.textContent?.trim(),
  animation: getComputedStyle(document.querySelector(".home-hero-heading")).animationName,
  cta: getComputedStyle(document.querySelector(".home-hero-cta")).opacity,
  wordsStatic: [...document.querySelectorAll(".home-hero-word")].every(
    (word) => getComputedStyle(word).animationName === "none",
  ),
  backgroundStatic: document.querySelector(".home-hero-artwork").dataset.motion === "reduced",
  allContentStatic: [
    ...document.querySelectorAll("main [data-home-step], main .rv, main .item-rv"),
  ].every(
    (element) =>
      getComputedStyle(element).opacity === "1" &&
      getComputedStyle(element).animationName === "none",
  ),
}));
reduced.artworkMotion = await exerciseArtwork(page, "mobile-reduced", true);
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
      document.querySelector(".home-flow-stage") &&
      getComputedStyle(document.querySelector(".home-flow-stage")).position === "relative",
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
// A real late runtime must recover interactive artwork after the four-second
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
    document.querySelector(".home-flow-stage") &&
    getComputedStyle(document.querySelector(".home-flow-stage")).position === "relative",
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
  interactive:
    hero.querySelectorAll(".home-flow-input").length === 3 &&
    hero.querySelector(".home-hero-artwork").dataset.artworkReady === "true",
}));
if (
  !lateReadable ||
  !lateRecovery.readable ||
  !lateRecovery.wordsStatic ||
  !lateRecovery.interactive
)
  failures.push(
    "Late hydration left input controls unavailable or concealed readable foreground again",
  );
await latePage.locator(".home-flow-input").first().click();
await latePage.waitForFunction(
  () =>
    document.querySelector(".home-flow").dataset.source === "0" &&
    document.querySelector(".home-flow").dataset.motion === "live",
);
lateRecovery.inputResponded = true;
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
  stylesReady = await staticPage.evaluate(() => {
    const stage = document.querySelector(".home-flow-stage");
    return Boolean(
      stage &&
      stage.getBoundingClientRect().width > 100 &&
      getComputedStyle(stage).position === "relative",
    );
  });
  if (!stylesReady) await staticPage.waitForTimeout(100);
}
if (!stylesReady) failures.push("No-JavaScript hero stylesheet or server SVG did not load");
await staticPage.waitForLoadState("networkidle");
const staticHero = await staticPage.evaluate(() => ({
  heading: document.querySelector(".home-hero-heading")?.textContent?.replace(/\s+/g, " "),
  cta: getComputedStyle(document.querySelector(".home-hero-cta")).opacity,
  wordsStatic: [...document.querySelectorAll(".home-hero-word")].every(
    (word) => getComputedStyle(word).animationName === "none",
  ),
  backgroundStatic:
    document.querySelector(".home-flow").dataset.phase === "done" &&
    document.querySelectorAll('.home-flow-output[data-complete="true"]').length === 2,
  allContentReadable: [
    ...document.querySelectorAll("main [data-home-step], main .rv, main .item-rv"),
  ].every(
    (element) =>
      getComputedStyle(element).opacity === "1" &&
      getComputedStyle(element).animationName === "none",
  ),
}));
if (
  !/Custom AI systems that run the work behind your business/.test(staticHero.heading ?? "") ||
  staticHero.cta !== "1" ||
  !staticHero.wordsStatic ||
  !staticHero.backgroundStatic ||
  !staticHero.allContentReadable
)
  failures.push("No-JavaScript hero did not remain complete and static");
// The image and local fonts can be fetched but still await decoding/painting.
// Capture their settled no-script presentation, not the network's first paint.
await staticPage.evaluate(async () => {
  await document.fonts.ready;
});
await staticPage.screenshot({ caret: "initial", path: `${output}/desktop-no-js.png` });
await noJS.close();
const desktopReducedContext = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const desktopReducedPage = await desktopReducedContext.newPage();
desktopReducedPage.on("pageerror", (error) => failures.push(`desktop-reduced: ${error.message}`));
await desktopReducedPage.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await desktopReducedPage.waitForFunction(
  () => document.querySelector(".home-flow").dataset.motion === "reduced",
);
const desktopReduced = await exerciseArtwork(desktopReducedPage, "desktop-reduced", true);
await desktopReducedPage.screenshot({ path: `${output}/desktop-reduced.png` });
await desktopReducedContext.close();
await browser.close();

// Native touch and SVG motion are also checked in WebKit.
const webkitArtwork = [];
const webkitBrowser = await webkit.launch({ headless: true });
for (const [label, viewport, touch] of [
  ["webkit-desktop", { width: 1440, height: 900 }, false],
  ["webkit-mobile", { width: 390, height: 844 }, true],
]) {
  const context = await webkitBrowser.newContext({ viewport, hasTouch: touch, isMobile: touch });
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(`${label}: ${error.message}`));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  const journey = await exerciseArtwork(page, label);
  await page.screenshot({ path: `${output}/${label}-settled.png` });
  webkitArtwork.push({ label, viewport, ...journey });
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
      desktopReduced,
      delayedResults,
      watchdog,
      staticHero,
      webkitArtwork,
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
