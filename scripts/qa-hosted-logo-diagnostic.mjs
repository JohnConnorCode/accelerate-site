import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const fullSha = process.env.QA_EXPECTED_RELEASE_SHA || "";
assert.match(fullSha, /^[0-9a-f]{40}$/);
const target = new URL(process.env.HERO_QA_TARGET_URL || "");
assert.ok(
  target.origin === "https://www.acceleratewith.us" &&
    target.pathname === "/" &&
    !target.search &&
    !target.hash &&
    !target.username &&
    !target.password &&
    !target.port,
);
const deploymentId = fullSha.slice(0, 12);
const output = "/tmp/accelerate-hosted-logo-diagnostic";
const workshop = "/events/ai-strategy-workshop-chicago-2026";
await mkdir(output, { recursive: true });
const json = (data) =>
  JSON.stringify(
    data,
    (_, value) => (typeof value === "number" && !Number.isFinite(value) ? String(value) : value),
    2,
  );
const save = async (name, data) => writeFile(`${output}/${name}.json`, json(data));

// This function only reads geometry, styles and animation clocks.
function readLogos() {
  const rect = (node) => node.getBoundingClientRect().toJSON();
  const animation = (item) => {
    const effect = item.effect;
    return {
      name: item.animationName || null,
      playState: item.playState,
      pending: item.pending,
      currentTime: item.currentTime,
      startTime: item.startTime,
      playbackRate: item.playbackRate,
      timing: effect?.getTiming(),
      computed: effect?.getComputedTiming(),
    };
  };
  const identity = (value) => {
    if (value === "none") return true;
    try {
      return new DOMMatrixReadOnly(value).isIdentity;
    } catch {
      return false;
    }
  };
  const translatedZero = (value) =>
    value === "none" || value.split(/\s+/).every((part) => Math.abs(parseFloat(part)) < 0.001);
  const logos = {};
  for (const [label, selector] of Object.entries({
    header: ".site-header .logo-link",
    footer: "footer .logo-link",
  })) {
    const link = document.querySelector(selector);
    const word = link?.querySelector(".logo-word");
    if (!link || !word) {
      logos[label] = { found: false, ready: false };
      continue;
    }
    const letters = [...word.querySelectorAll(".logo-letter")].map((letter) => {
      const style = getComputedStyle(letter);
      const box = rect(letter);
      let clip = { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      const ancestors = [];
      let opaque = true,
        displayed = true;
      for (let parent = letter; parent; parent = parent.parentElement) {
        const s = getComputedStyle(parent),
          b = rect(parent);
        const clipsX = /^(hidden|clip|auto|scroll)$/.test(s.overflowX);
        const clipsY = /^(hidden|clip|auto|scroll)$/.test(s.overflowY);
        if (clipsX) {
          clip.left = Math.max(clip.left, b.left);
          clip.right = Math.min(clip.right, b.right);
        }
        if (clipsY) {
          clip.top = Math.max(clip.top, b.top);
          clip.bottom = Math.min(clip.bottom, b.bottom);
        }
        opaque &&= Number(s.opacity) >= 0.999;
        displayed &&= s.display !== "none" && s.visibility === "visible";
        ancestors.push({
          tag: parent.tagName,
          class: parent.className,
          rect: b,
          opacity: s.opacity,
          display: s.display,
          visibility: s.visibility,
          overflowX: s.overflowX,
          overflowY: s.overflowY,
          clipPath: s.clipPath,
          maskImage: s.maskImage,
          contentVisibility: s.contentVisibility,
          contain: s.contain,
        });
      }
      const visibleArea = Math.max(0, clip.right - clip.left) * Math.max(0, clip.bottom - clip.top);
      const clipRatio = box.width * box.height ? visibleArea / (box.width * box.height) : 0;
      const transformIdentity = identity(style.transform) && translatedZero(style.translate);
      return {
        text: letter.textContent,
        rect: box,
        clipping: { intersection: clip, ratio: clipRatio, ancestors },
        transform: style.transform,
        translate: style.translate,
        transformIdentity,
        opacity: style.opacity,
        effectiveAncestorsOpaque: opaque,
        color: style.color,
        textFillColor: style.webkitTextFillColor,
        visibility: style.visibility,
        display: style.display,
        font: style.font,
        fontFamily: style.fontFamily,
        fontWeight: style.fontWeight,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        checkVisibility: letter.checkVisibility({
          opacityProperty: true,
          visibilityProperty: true,
          contentVisibilityAuto: true,
        }),
        animation: {
          name: style.animationName,
          duration: style.animationDuration,
          delay: style.animationDelay,
          iterations: style.animationIterationCount,
          direction: style.animationDirection,
          fillMode: style.animationFillMode,
          playState: style.animationPlayState,
        },
        webAnimations: letter.getAnimations().map(animation),
        ready:
          displayed &&
          opaque &&
          clipRatio >= 0.95 &&
          transformIdentity &&
          box.width > 0 &&
          box.height > 0,
      };
    });
    const box = rect(link);
    logos[label] = {
      found: true,
      text: word.textContent,
      linkRect: box,
      wordRect: rect(word),
      wordStyle: {
        overflow: getComputedStyle(word).overflow,
        opacity: getComputedStyle(word).opacity,
        transform: getComputedStyle(word).transform,
      },
      inViewport: box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth,
      letters,
      ready: letters.length > 0 && letters.every((letter) => letter.ready),
    };
  }
  return {
    at: performance.now(),
    url: location.href,
    viewport: {
      width: innerWidth,
      height: innerHeight,
      visualWidth: visualViewport?.width,
      visualHeight: visualViewport?.height,
    },
    devicePixelRatio,
    scrollY,
    documentHeight: document.documentElement.scrollHeight,
    documentVisibility: document.visibilityState,
    theme: document.documentElement.dataset.theme,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    fontStatus: document.fonts.status,
    headerScrolled: document.querySelector(".site-header")?.classList.contains("is-scrolled"),
    logos,
    logoAnimations: document
      .getAnimations()
      .filter((item) => item.effect?.target?.closest?.(".logo-link"))
      .map(animation),
    events: window.__logoDiagnosticEvents || [],
  };
}

async function waitForLetters(page, scopes, requireViewport) {
  const started = Date.now();
  let last;
  while (Date.now() - started < 5000) {
    last = await page.evaluate(readLogos);
    if (
      scopes.every(
        (scope) => last.logos[scope]?.ready && (!requireViewport || last.logos[scope].inViewport),
      )
    )
      return { ready: true, elapsedMs: Date.now() - started, scopes, requireViewport };
    await page.waitForTimeout(100);
  }
  return {
    ready: false,
    elapsedMs: Date.now() - started,
    scopes,
    requireViewport,
    error: "Actual letter visibility/identity transform did not settle within5seconds",
    lastReady: Object.fromEntries(
      scopes.map((scope) => [
        scope,
        { ready: last?.logos[scope]?.ready, inViewport: last?.logos[scope]?.inViewport },
      ]),
    ),
  };
}

async function scrollDocument(page) {
  const tour = [];
  for (let step = 0; step < 100; step++) {
    const position = await page.evaluate(() => ({
      y: scrollY,
      max: document.documentElement.scrollHeight - innerHeight,
      next: Math.min(
        document.documentElement.scrollHeight - innerHeight,
        scrollY + innerHeight * 0.65,
      ),
    }));
    tour.push(position);
    if (position.y >= position.max - 1) return tour;
    await page.evaluate((top) => scrollTo({ top, behavior: "instant" }), position.next);
    await page.waitForTimeout(100);
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  }
  throw new Error("Bounded document tour did not reach the footer");
}

const browser = await chromium.launch({ headless: true });
const cases = [],
  failures = [];
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: theme,
      reducedMotion: "no-preference",
    });
    await context.addInitScript((theme) => {
      localStorage.setItem("theme", theme);
      window.__logoDiagnosticEvents = [];
      for (const name of [
        "animationstart",
        "animationend",
        "animationcancel",
        "transitionstart",
        "transitionend",
        "transitioncancel",
      ])
        document.addEventListener(
          name,
          (event) => {
            if (!(event.target instanceof Element) || !event.target.closest(".logo-link")) return;
            if (window.__logoDiagnosticEvents.length >= 300) return;
            window.__logoDiagnosticEvents.push({
              type: event.type,
              at: performance.now(),
              elapsedTime: event.elapsedTime,
              animationName: event.animationName,
              propertyName: event.propertyName,
              text: event.target.textContent?.slice(0, 40),
              class: event.target.className,
              scrollY,
              viewportHeight: innerHeight,
            });
          },
          true,
        );
    }, theme);
    const assets = new Map();
    context.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin !== target.origin || !url.pathname.startsWith("/_next/")) return;
      const dpl = url.searchParams.get("dpl");
      if (!dpl && !/\/static\/.*\.(js|css)$/.test(url.pathname)) return;
      assets.set(url.href, { url: url.href, deploymentId: dpl, status: response.status() });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const result = {
      theme,
      width: 1440,
      diagnosticOnly: true,
      shots: [],
      readinessFailures: [],
      runtimeErrors: [],
    };
    page.on("pageerror", (error) => result.runtimeErrors.push(error.message));
    try {
      const response = await page.goto(target.origin + workshop, { waitUntil: "domcontentloaded" });
      assert.equal(response.status(), 200);
      await page.locator("#workshop-heading").waitFor();
      await page.locator("footer").waitFor({ state: "attached" });
      await page.evaluate(() => document.fonts.ready);
      result.initial = await page.evaluate(readLogos);
      result.tour = await scrollDocument(page);
      const capture = async (label, scopes, viewport, fullPage) => {
        const beforeWait = await page.evaluate(readLogos);
        const readiness = await waitForLetters(page, scopes, viewport);
        if (!readiness.ready) result.readinessFailures.push({ label, ...readiness });
        const before = await page.evaluate(readLogos);
        const filename = `${theme}-${label}.png`;
        await page.screenshot({ path: `${output}/${filename}`, fullPage, caret: "hide" });
        const after = await page.evaluate(readLogos);
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        const afterPaint = await page.evaluate(readLogos);
        const shot = {
          label,
          fullPage,
          filename,
          sha256: createHash("sha256")
            .update(await readFile(`${output}/${filename}`))
            .digest("hex"),
          beforeWait,
          readiness,
          before,
          after,
          afterPaint,
        };
        result.shots.push({ label, filename, sha256: shot.sha256, readiness });
        await save(`${theme}-${label}`, shot);
      };
      await page.locator("footer .logo-link").first().scrollIntoViewIfNeeded();
      await capture("footer-viewport", ["footer"], true, false);
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      try {
        await page.waitForFunction(
          () =>
            scrollY === 0 &&
            !document.querySelector(".site-header")?.classList.contains("is-scrolled"),
          null,
          { timeout: 5000 },
        );
      } catch (error) {
        result.headerPositionError = error.message;
      }
      await capture("header-viewport", ["header"], true, false);
      await capture("fullpage", ["header", "footer"], false, true);
      result.status = result.readinessFailures.length
        ? "COLLECTED_WITH_READINESS_TIMEOUTS"
        : "COLLECTED";
    } catch (error) {
      result.status = "COLLECTION_FAILED";
      result.error = error.stack || String(error);
      failures.push(`${theme}: ${error.message}`);
      await page
        .screenshot({ path: `${output}/${theme}-collection-failure.png`, caret: "hide" })
        .catch(() => {});
    } finally {
      const loaded = [...assets.values()];
      result.assets = {
        expectedDeploymentId: deploymentId,
        loaded,
        failures: loaded.filter(
          (asset) => asset.deploymentId !== deploymentId || asset.status >= 400,
        ),
      };
      if (!loaded.length || result.assets.failures.length)
        failures.push(`${theme}: release asset identity failed`);
      if (result.readinessFailures.length)
        failures.push(
          `${theme}: ${result.readinessFailures.length} bounded letter-readiness waits failed`,
        );
      cases.push(result);
      await save(theme, result);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
await save("results", {
  diagnosticOnly: true,
  acceptanceRunPreserved: 39583291014,
  fullSha,
  deploymentId,
  target: target.origin,
  workshop,
  cases,
  failures,
  styleOverrides: false,
  clockOverrides: false,
  providerFixtures: false,
});
console.log(
  json({
    diagnosticOnly: true,
    cases: cases.map(({ theme, status, shots, readinessFailures }) => ({
      theme,
      status,
      shots,
      readinessFailures,
    })),
    failures,
  }),
);
if (failures.length) process.exitCode = 1;
