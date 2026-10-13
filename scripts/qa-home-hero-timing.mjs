import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import sharp from "sharp";
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
const browser = await chromium.launch({
  headless: true,
  args: process.platform === "linux" ? ["--use-gl=angle", "--use-angle=swiftshader"] : [],
});
const failures = [];
const results = [];
const entranceFrames = [];

// Normal mode must move. Reduced motion must retain strict settled geometry and
// decoded-pixel checks; invisible offscreen/menu states must stop their frame work.
async function renderedState(artwork) {
  return artwork.evaluate((element) => {
    const root = element.getBoundingClientRect();
    const round = (number) => Math.round(number * 100000) / 100000;
    return {
      route: element.dataset.routeState,
      rootBox: [round(root.x), round(root.y), round(root.width), round(root.height)],
      activeAnimations: element
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === "running").length,
      svgAnimations: element.querySelectorAll("animate, animateMotion, animateTransform").length,
      nodes: [
        element,
        ...element.querySelectorAll(
          "svg, g, path, circle, ellipse, stop, linearGradient, radialGradient, .home-system-port",
        ),
      ].map((node) => {
        const box = node.getBoundingClientRect(),
          style = getComputedStyle(node);
        return {
          tag: node.tagName,
          attributes: [...node.attributes].map((attribute) => [attribute.name, attribute.value]),
          box:
            node instanceof SVGGraphicsElement || node instanceof HTMLElement
              ? [round(box.x - root.x), round(box.y - root.y), round(box.width), round(box.height)]
              : null,
          paint: [
            "transform",
            "opacity",
            "fill",
            "fillOpacity",
            "stroke",
            "strokeOpacity",
            "strokeDashoffset",
            "color",
            "backgroundColor",
            "boxShadow",
            "filter",
          ].map((property) => style[property]),
        };
      }),
    };
  });
}

async function observeRest(artwork, label) {
  const beforeState = await renderedState(artwork);
  const first = await artwork.screenshot();
  await writeFile(`${output}/${label}-before.png`, first);
  await artwork.page().waitForTimeout(750);
  const second = await artwork.screenshot();
  await writeFile(`${output}/${label}-after.png`, second);
  const afterState = await renderedState(artwork);
  const stable =
    JSON.stringify(beforeState) === JSON.stringify(afterState) &&
    beforeState.activeAnimations === 0 &&
    beforeState.svgAnimations === 0;
  const pixelsEqual = await sameRenderedPixels(first, second, artwork, label);
  if (!pixelsEqual) {
    // Diagnose cold paint separately, without changing the original strict gate.
    await artwork.page().waitForTimeout(750);
    const third = await artwork.screenshot();
    await writeFile(`${output}/${label}-third.png`, third);
    await artwork.page().waitForTimeout(750);
    const fourth = await artwork.screenshot();
    await writeFile(`${output}/${label}-fourth.png`, fourth);
    const secondThird = await sameRenderedPixels(second, third, artwork, `${label}-later-1`);
    const thirdFourth = await sameRenderedPixels(third, fourth, artwork, `${label}-later-2`);
    await writeFile(
      `${output}/${label}-paint-sequence.json`,
      JSON.stringify({ firstSecond: pixelsEqual, secondThird, thirdFourth }, null, 2),
    );
  }
  if (!stable)
    await writeFile(
      `${output}/${label}-geometry-diff.json`,
      JSON.stringify({ beforeState, afterState }, null, 2),
    );
  return {
    stable: stable && pixelsEqual,
    geometryStable: stable,
    pixelsEqual,
    beforeState,
    afterState,
  };
}

function armPacketObservation(index) {
  window.__heroPacketObservation = new Promise((resolve) => {
    const control = document.querySelectorAll(".home-system-input")[index];
    const circle = document.querySelectorAll(".home-system-signal")[index];
    let deadline = performance.now() + 4000;
    let activated = false;
    let started = null;
    const points = [];
    const activate = () => {
      activated = true;
      deadline = performance.now() + 4000;
    };
    // Pointer, native touch and keyboard activation all dispatch click. Begin
    // with that real event, then follow one incoming signal from this workflow.
    // Never spend the observation window on the previous workflow's tail.
    control.addEventListener("click", activate, { once: true });
    const sample = (now) => {
      if (activated && circle.getAttribute("opacity") === "1") {
        started ??= now;
        const box = circle.getBoundingClientRect();
        points.push({ time: now, x: box.x + box.width / 2, y: box.y + box.height / 2 });
      }
      if (now >= deadline || (started !== null && now - started >= 900)) {
        control.removeEventListener("click", activate);
        resolve(points);
      } else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function exerciseDockDismissal(page, label) {
  const samples = [];
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
        const targets = [...document.querySelectorAll(".home-system-port, .home-hero-cta")].map(
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
            return {
              name: target.getAttribute("aria-label") || target.className,
              box: box.toJSON(),
              point,
              hit: !point || target.contains(hit),
              hitTarget: hit?.getAttribute("class") || hit?.tagName || null,
            };
          },
        );
        return {
          elapsed: performance.now() - window.__dockReturnedAt,
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

// Compare decoded pixels: PNG encoding/chunks are not proof of visible movement.
// Any real pixel difference retains both frames and computed geometry for diagnosis.
async function sameRenderedPixels(first, second, artwork, label) {
  const decode = (frame) => sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [a, b] = await Promise.all([decode(first), decode(second)]);
  const same =
    a.info.width === b.info.width && a.info.height === b.info.height && a.data.equals(b.data);
  if (!same) {
    await writeFile(`${output}/${label}-before.png`, first);
    await writeFile(`${output}/${label}-after.png`, second);
    let changed = 0,
      maxDelta = 0;
    if (a.data.length === b.data.length) {
      for (let i = 0; i < a.data.length; i++) {
        const delta = Math.abs(a.data[i] - b.data[i]);
        if (delta) changed++;
        maxDelta = Math.max(maxDelta, delta);
      }
    }
    const geometry = await artwork.evaluate((element) => ({
      state: element.dataset.routeState,
      animations: element.getAnimations({ subtree: true }).map((animation) => ({
        state: animation.playState,
        properties: animation.effect.getKeyframes(),
      })),
      layers: [...element.querySelectorAll(".home-system-layer")].map(
        (layer) => getComputedStyle(layer).transform,
      ),
      box: element.getBoundingClientRect().toJSON(),
    }));
    await writeFile(
      `${output}/${label}-pixel-diff.json`,
      JSON.stringify(
        {
          changedChannels: changed,
          maxDelta,
          width: a.info.width,
          height: a.info.height,
          geometry,
        },
        null,
        2,
      ),
    );
  }
  return same;
}

async function exerciseArtwork(page, label, touch = false, reduced = false) {
  const artwork = page.locator(".home-system-artwork");
  const controls = artwork.locator(".home-system-input");
  const handle = artwork.locator(".home-system-handle");
  // Settled-state checks begin after the actual fonts and header layout settle.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    () => document.querySelector(".home-system-artwork").dataset.artworkReady === "true",
  );
  if (
    (await controls.count()) !== 3 ||
    (await handle.count()) !== 1 ||
    (await artwork.locator("canvas, svg text, .home-hero-artwork-pause").count()) !== 0
  )
    failures.push(`${label}: controls missing or rejected canvas, words, or pause UI present`);
  const controlsReady = await artwork.locator("button").evaluateAll((buttons) =>
    buttons.every((button) => {
      const box = button.getBoundingClientRect();
      return (
        box.width >= 47 &&
        box.height >= 47 &&
        button.textContent.trim() === "" &&
        button.getAttribute("aria-label")
      );
    }),
  );
  if (!controlsReady) failures.push(`${label}: controls lack names or 48px targets`);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(450);
  let idle;
  if (reduced) {
    // Independent review approved one initial native paint capture. The held
    // pair and every later interaction still require exact equality, with no
    // tolerance, repeated setup capture, or retry-to-pass path.
    const beforeSetup = await renderedState(artwork);
    await writeFile(`${output}/${label}-reduced-setup.png`, await artwork.screenshot());
    const afterSetup = await renderedState(artwork);
    const setupStable =
      JSON.stringify(beforeSetup) === JSON.stringify(afterSetup) &&
      beforeSetup.activeAnimations === 0 &&
      beforeSetup.svgAnimations === 0;
    await writeFile(
      `${output}/${label}-reduced-setup.json`,
      JSON.stringify({ beforeSetup, afterSetup, setupStable }, null, 2),
    );
    if (!setupStable) failures.push(`${label}: initial reduced capture changes rendered state`);
    idle = await observeRest(artwork, `${label}-reduced-rest`);
    idle.setupStable = setupStable;
    if (!idle.stable)
      failures.push(`${label}: reduced-motion geometry or decoded pixels move at rest`);
  } else {
    const before = await renderedState(artwork),
      first = await artwork.screenshot();
    await page.waitForTimeout(750);
    const second = await artwork.screenshot(),
      after = await renderedState(artwork);
    const pixelsEqual = await sameRenderedPixels(first, second, artwork, `${label}-live`);
    idle = {
      live: await artwork.getAttribute("data-motion"),
      geometryChanges: JSON.stringify(before) !== JSON.stringify(after),
      pixelsEqual,
    };
    if (idle.live !== "live" || !idle.geometryChanges || pixelsEqual)
      failures.push(`${label}: system does not visibly run without activation`);
  }
  const journeys = [];
  for (let index = 0; index < 3; index++) {
    const control = controls.nth(index);
    if (!reduced) await page.evaluate(armPacketObservation, index);
    if (touch) await control.tap();
    else if (index === 1) {
      await control.focus();
      await page.keyboard.press("Enter");
    } else if (index === 2) {
      await control.focus();
      await page.keyboard.press("Space");
    } else await control.click();
    if (
      (await artwork.getAttribute("data-source")) !== String(index) ||
      (await control.getAttribute("aria-pressed")) !== "true"
    )
      failures.push(`${label}: input ${index} did not select its workflow`);
    let travelled = 0;
    if (reduced) {
      if (
        (await artwork.getAttribute("data-motion")) !== "reduced" ||
        (await artwork.getAttribute("data-route-state")) !== "settled"
      )
        failures.push(`${label}: reduced-motion selection is not immediate`);
    } else {
      const points = await page.evaluate(() => window.__heroPacketObservation);
      const first = points[0];
      travelled = first
        ? Math.max(...points.map((p) => Math.hypot(p.x - first.x, p.y - first.y)))
        : 0;
      await writeFile(
        `${output}/${label}-route-${index}-signal-observation.json`,
        JSON.stringify({ index, points, travelled }, null, 2),
      );
      if (travelled < 8)
        failures.push(`${label}: input ${index} has no observed rendered signal travel`);
      await page.waitForFunction(
        () => document.querySelectorAll('.home-system-output[data-complete="true"]').length === 2,
      );
    }
    const destinations = await artwork
      .locator(".home-system-output")
      .evaluateAll((ports) => ports.map((port) => port.dataset.connected === "true"));
    const expected = [
      [true, true, false],
      [false, true, true],
      [true, false, true],
    ][index];
    if (JSON.stringify(destinations) !== JSON.stringify(expected))
      failures.push(`${label}: input ${index} reached wrong outcomes`);
    if (!(await artwork.getByRole("status").textContent()))
      failures.push(`${label}: selected workflow has no accessible announcement`);
    journeys.push({ index, destinations, travelled });
    await page.screenshot({ caret: "initial", path: `${output}/${label}-route-${index}.png` });
  }
  const base = artwork.locator(".home-system-base");
  const pose = async () => (await artwork.getAttribute("data-pose")).split(",").map(Number);
  await page.mouse.move(0, 0);
  await handle.focus();
  await page.keyboard.press("Home");
  await handle.evaluate((button) => button.blur());
  const neutralPose = await pose();
  const neutral = await base.getAttribute("d");
  const bounds = await handle.boundingBox();
  let hover = null;
  if (!touch) {
    await page.mouse.move(bounds.x + bounds.width * 0.82, bounds.y + bounds.height * 0.32);
    await page.waitForTimeout(300);
    hover = {
      startPose: neutralPose,
      pointer: { x: bounds.x + bounds.width * 0.82, y: bounds.y + bounds.height * 0.32 },
      pose: await pose(),
      shapeChanged: neutral !== (await base.getAttribute("d")),
    };
    if (
      !hover.shapeChanged ||
      Math.hypot(hover.pose[0] - neutralPose[0], hover.pose[1] - neutralPose[1]) < 8
    )
      failures.push(`${label}: pointer steering does not manipulate geometry`);
  }
  const beforeDrag = {
    pose: await pose(),
    base: await base.getAttribute("d"),
    wire: await artwork.locator(".home-system-wire").first().getAttribute("d"),
  };
  const grip = await handle.boundingBox();
  const start = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
  const nativeTouch = touch && page.context().browser().browserType().name() === "chromium";
  if (nativeTouch) {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
    for (let i = 1; i <= 6; i++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: start.x + i * 6, y: start.y + i * 3 }],
      });
      await page.waitForTimeout(32);
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 36, start.y + 18, { steps: 8 });
    await page.mouse.up();
  }
  await page.waitForTimeout(reduced ? 0 : 400);
  const manipulation = {
    nativeTouch,
    pose: await pose(),
    shapeChanged: beforeDrag.base !== (await base.getAttribute("d")),
    connectionsChanged:
      beforeDrag.wire !== (await artwork.locator(".home-system-wire").first().getAttribute("d")),
  };
  if (
    !manipulation.shapeChanged ||
    !manipulation.connectionsChanged ||
    Math.hypot(
      manipulation.pose[0] - beforeDrag.pose[0],
      manipulation.pose[1] - beforeDrag.pose[1],
    ) < 8
  )
    failures.push(`${label}: dragging does not move the core and reshape its connections`);
  await page.screenshot({ caret: "initial", path: `${output}/${label}-manipulated.png` });
  await page.mouse.move(0, 0);
  // Review found that the transparent drag target could cover a workflow port
  // at the lower-left limit. Exercise actual hits and activations at both limits.
  const limitTargets = [];
  for (const [horizontal, vertical] of [
    ["ArrowLeft", "ArrowDown"],
    ["ArrowRight", "ArrowUp"],
  ]) {
    await handle.focus();
    await page.keyboard.press("Home");
    for (let step = 0; step < 6; step++) await page.keyboard.press(horizontal);
    for (let step = 0; step < 4; step++) await page.keyboard.press(vertical);
    await page.waitForTimeout(reduced ? 0 : 450);
    const limitPose = await pose(),
      hits = [];
    for (let index = 0; index < 3; index++) {
      const control = controls.nth(index);
      await control.scrollIntoViewIfNeeded();
      const hittable = await control.evaluate((button) => {
        const bounds = button.getBoundingClientRect();
        return button.contains(
          document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2),
        );
      });
      if (touch) await control.tap();
      else await control.click();
      const responded = (await artwork.getAttribute("data-source")) === String(index);
      if (!hittable || !responded)
        failures.push(
          `${label}: workflow ${index} is covered or unusable at ${horizontal}/${vertical} limit`,
        );
      hits.push({ index, hittable, responded });
    }
    limitTargets.push({ limitPose, hits });
  }
  await page.mouse.move(0, 0);
  await handle.focus();
  await page.keyboard.press("Home");
  await page.waitForTimeout(reduced ? 0 : 400);
  const centered = await pose();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(reduced ? 0 : 400);
  const keyboard = await pose();
  if (Math.hypot(...centered) > 2 || keyboard[0] > -10 || keyboard[1] > -10)
    failures.push(`${label}: Home/arrows do not provide equivalent core manipulation`);
  await page.keyboard.press("Home");
  await handle.evaluate((button) => button.blur());
  await page.waitForTimeout(450);
  let completed;
  if (reduced) {
    completed = await observeRest(artwork, `${label}-reduced-selected`);
    if (!completed.stable)
      failures.push(`${label}: reduced-motion selection or manipulation does not settle`);
  } else {
    await page.evaluate(() => window.scrollTo({ top: innerHeight * 2, behavior: "instant" }));
    await page.waitForFunction(
      () => document.querySelector(".home-system-artwork").dataset.motion === "suspended",
    );
    const before = await renderedState(artwork);
    await page.waitForTimeout(300);
    const after = await renderedState(artwork);
    completed = { suspended: JSON.stringify(before) === JSON.stringify(after) };
    if (!completed.suspended)
      await writeFile(
        `${output}/${label}-suspended-diff.json`,
        JSON.stringify({ before, after }, null, 2),
      );
    if (!completed.suspended) failures.push(`${label}: offscreen system continues updating`);
    if (touch)
      await page
        .getByRole("button", { name: "Open chat", exact: true })
        .waitFor({ state: "visible", timeout: 10_000 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForFunction(
      () => document.querySelector(".home-system-artwork").dataset.motion === "live",
    );
    if (touch) {
      const clearance = [];
      for (const delay of [50, 400]) {
        await page.waitForTimeout(delay);
        const sample = await artwork.evaluate((element) => {
          const bubble = document.querySelector(
            '.chat-widget-root:not(.is-open) [aria-label="Open chat"]',
          );
          const launcherVisible = Boolean(bubble?.checkVisibility({ visibilityProperty: true }));
          const clearance = bubble?.closest(".chat-widget-root")?.dataset.heroClearance ?? null;
          const launcher = bubble?.getBoundingClientRect();
          const targets = [
            ...element.querySelectorAll(".home-system-port"),
            ...document.querySelectorAll(".home-hero-cta"),
          ].map((port) => {
            const box = port.getBoundingClientRect();
            const clipped = {
              left: Math.max(0, box.left),
              right: Math.min(innerWidth, box.right),
              top: Math.max(0, box.top),
              bottom: Math.min(innerHeight, box.bottom),
            };
            const visible = clipped.right > clipped.left && clipped.bottom > clipped.top;
            const point = visible
              ? { x: (clipped.left + clipped.right) / 2, y: (clipped.top + clipped.bottom) / 2 }
              : null;
            const hit = point && document.elementFromPoint(point.x, point.y);
            return {
              name: port.getAttribute("aria-label") || port.className,
              box: box.toJSON(),
              visible,
              point,
              hit: !visible || port.contains(hit),
              hitTarget: hit?.getAttribute("class") || hit?.tagName || null,
              hitOwner: hit?.closest("[data-dock]")
                ? "dock"
                : hit?.closest(".chat-widget-root")
                  ? "chat"
                  : null,
              overlaps:
                launcherVisible &&
                launcher.left < box.right &&
                launcher.right > box.left &&
                launcher.top < box.bottom &&
                launcher.bottom > box.top,
            };
          });
          return {
            present: Boolean(bubble),
            launcherVisible,
            clearance,
            launcher: launcher?.toJSON() ?? null,
            targets,
            overlaps:
              (Boolean(bubble) && !launcherVisible && clearance !== "hidden") ||
              targets.some((port) => port.visible && (port.overlaps || !port.hit)),
          };
        });
        if (sample.overlaps)
          failures.push(`${label}: overlay obscures a hero target after scroll return`);
        clearance.push(sample);
      }
      completed.chatClearance = clearance;
    }
  }
  completed.dockDismissal = await exerciseDockDismissal(page, label);
  return {
    journeys,
    controlsReady,
    idle,
    hover,
    manipulation,
    limitTargets,
    centered,
    keyboard,
    completed,
    reduced,
  };
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
  await page.locator(".home-system-input").first().focus();
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
      `${label}: input control has concealed focus or precedes booking in the reading order`,
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
  if (!hasPerceptibleHeroSequence(settled.phases))
    failures.push(`${label}: hero phases did not enter in a perceptible sequence`);
  await page.waitForFunction(
    () => document.querySelector(".home-hero").dataset.heroActive === "true",
  );
  const artworkMotion = await exerciseArtwork(page, label, touch);
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
await page.waitForFunction(
  () => document.querySelector(".home-system-artwork").dataset.motion === "reduced",
);
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
reduced.artworkMotion = await exerciseArtwork(page, "mobile-reduced", true, true);
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
      document.querySelector(".home-system-diagram") &&
      getComputedStyle(document.querySelector(".home-system-scene")).position === "relative",
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
    document.querySelector(".home-system-diagram") &&
    getComputedStyle(document.querySelector(".home-system-scene")).position === "relative",
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
    hero.querySelectorAll(".home-system-input").length === 3 &&
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
await latePage.locator(".home-system-input").first().click();
await latePage.waitForFunction(
  () =>
    document.querySelector(".home-system-artwork").dataset.source === "0" &&
    document.querySelector(".home-system-artwork").dataset.motion === "live",
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
    const svg = document.querySelector(".home-system-diagram");
    return Boolean(
      svg &&
      svg.getBoundingClientRect().width > 100 &&
      getComputedStyle(document.querySelector(".home-system-scene")).position === "relative",
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
    document.querySelector(".home-system-diagram") instanceof SVGElement &&
    document.querySelectorAll(".home-hero-canvas").length === 0 &&
    [...document.querySelectorAll(".home-system-signal")].every(
      (signal) => signal.getAttribute("opacity") === "0",
    ),
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
// The image and local fonts can be fetched but still await decoding/painting.
// Capture their settled no-script presentation, not the network's first paint.
await staticPage.evaluate(async () => {
  await document.fonts.ready;
});
await staticPage.screenshot({ caret: "initial", path: `${output}/desktop-no-js.png` });
await noJS.close();
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
  const journey = await exerciseArtwork(page, label, touch);
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
