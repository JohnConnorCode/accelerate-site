import { chromium, webkit } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const output = "/tmp/accelerate-mobile-motion";
await mkdir(output, { recursive: true });
const results = [];
const failures = [];
const diagnostics = [];
const engines = process.argv.includes("--webkit") ? { chromium, webkit } : { chromium };

for (const [engine, launcher] of Object.entries(engines)) {
  const browser = await launcher.launch({
    ...(engine === "chromium" ? { ignoreDefaultArgs: ["--disable-back-forward-cache"] } : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: `${output}/video`, size: { width: 390, height: 844 } },
  });
  await context.addInitScript(() => {
    window.__documentId = Math.random();
    window.__restoredFromCache = false;
    window.__motionSamples = { shifts: [], tasks: [] };
    window.addEventListener("pageshow", (event) => {
      window.__restoredFromCache ||= event.persisted;
    });
    if (PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput) window.__motionSamples.shifts.push(entry.value);
      }).observe({ type: "layout-shift", buffered: true });
    }
    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      new PerformanceObserver((list) => {
        window.__motionSamples.tasks.push(...list.getEntries().map((entry) => entry.duration));
      }).observe({ type: "longtask", buffered: true });
    }
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => failures.push(`${engine}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // Safari reports the existing Report-Only policy configuration as an error;
    // this advisory does not block resources or represent a script exception.
    if (
      message
        .text()
        .includes("was delivered in report-only mode, but does not specify a 'report-to'")
    )
      diagnostics.push({ engine, warning: "Report-Only CSP has no reporting endpoint" });
    else failures.push(`${engine}: ${message.text()}`);
  });
  try {
    if (engine === "chromium") {
      const session = await context.newCDPSession(page);
      await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    }
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() =>
      document.querySelector(".home-hero")?.classList.contains("in"),
    );
    await page.waitForTimeout(2200);
    const composition = await page.evaluate(() => {
      const hero = document.querySelector(".home-hero");
      return {
        heroHeight: hero.getBoundingClientRect().height,
        viewportHeight: innerHeight,
        headingHeight: hero.querySelector("h1").getBoundingClientRect().height,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        actionOpacity: Number(getComputedStyle(hero.querySelector(".home-hero-actions")).opacity),
        documentId: window.__documentId,
      };
    });
    if (
      composition.heroHeight < composition.viewportHeight ||
      composition.headingHeight < 290 ||
      composition.overflow ||
      composition.actionOpacity !== 1
    )
      failures.push(`${engine}: mobile hero is cramped, incomplete or overflows`);
    await page.screenshot({ caret: "initial", path: `${output}/${engine}-mobile.png` });

    // Real menu activation, repeated prefetched visits and history traversal
    // share one document. A reload-only check misses stale entrance state.
    for (let visit = 0; visit < 3; visit++) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      await page.locator('#mobile-site-navigation a[href="/services"]').first().click();
      await page.waitForURL(`${base}/services`);
      await page.locator('header .logo-link[href="/"]').click();
      await page.waitForURL(`${base}/`);
      await page.waitForFunction(() =>
        document.querySelector(".home-hero")?.classList.contains("in"),
      );
      const fresh = await page.evaluate(() => ({
        documentId: window.__documentId,
        runningWords: document
          .querySelector(".home-hero")
          .getAnimations({ subtree: true })
          .filter(
            (animation) =>
              animation.animationName === "home-hero-word-enter" &&
              animation.playState === "running",
          ).length,
        action: Number(getComputedStyle(document.querySelector(".home-hero-actions")).opacity),
      }));
      if (fresh.documentId !== composition.documentId || !fresh.runningWords || fresh.action > 0.1)
        failures.push(`${engine}: warm visit ${visit} skipped or exposed its entrance`);
      const frames = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const started = performance.now();
            let previous = started;
            const gaps = [];
            const sample = (now) => {
              gaps.push(now - previous);
              previous = now;
              if (now - started < 2200) requestAnimationFrame(sample);
              else {
                gaps.sort((a, b) => a - b);
                resolve({
                  p95: gaps[Math.floor(gaps.length * 0.95)],
                  longest: gaps.at(-1),
                  count: gaps.length,
                });
              }
            };
            requestAnimationFrame(sample);
          }),
      );
      if (frames.p95 > 50 || frames.longest > 200)
        failures.push(
          `${engine}: warm entrance stalled (${frames.p95}ms p95, ${frames.longest}ms longest frame)`,
        );
      await page.goBack();
      await page.waitForURL(`${base}/services`);
      await page.waitForTimeout(150);
      const restored = await page.evaluate(() => {
        const hero = document.querySelector(".public-hero-entrance");
        return {
          visible: hero?.dataset.revealState,
          running: hero
            ?.getAnimations({ subtree: true })
            .filter(
              (animation) =>
                animation.playState === "running" &&
                /entry|enter|reveal/.test(animation.animationName),
            ).length,
        };
      });
      if (restored.visible !== "visible" || restored.running)
        failures.push(`${engine}: history concealed or replayed the services hero`);
      await page.goForward();
      await page.waitForURL(`${base}/`);
      await page.waitForTimeout(150);
      const action = await page
        .locator(".home-hero-actions")
        .evaluate((element) => Number(getComputedStyle(element).opacity));
      if (action !== 1) failures.push(`${engine}: Forward concealed the restored booking action`);
      results.push({ engine, visit, fresh, restored, frames });
    }

    // Check every chapter after a restored cached visit, including the end of
    // a long page where the normal viewport entry margin cannot be crossed.
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < pageHeight; y += 600) {
      await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y);
      await page.waitForTimeout(90);
    }
    await page.waitForTimeout(1200);
    const traversal = await page.evaluate(() => {
      const owners = [
        ...document.querySelectorAll(
          "main .rv, main .item-rv, main .home-sequence, main .section-reveal, main .ui-entrance",
        ),
      ].filter((element) => element.checkVisibility());
      return {
        count: owners.length,
        hidden: owners
          .filter(
            (element) =>
              !element.classList.contains("in") || Number(getComputedStyle(element).opacity) < 0.99,
          )
          .map((element) => element.className),
        movingMedia: [...document.querySelectorAll("[data-media-parallax-layer]")].some(
          (element) => getComputedStyle(element).transform !== "none",
        ),
      };
    });
    if (!traversal.count || traversal.hidden.length || traversal.movingMedia)
      failures.push(`${engine}: restored traversal left hidden content or touch parallax running`);
    await page.screenshot({ caret: "initial", path: `${output}/${engine}-traversed.png` });
    const originScroll = await page.evaluate(() => scrollY);
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.locator('#mobile-site-navigation a[href="/work"]').first().click();
    await page.waitForURL(`${base}/work`);
    await page.goBack();
    await page.waitForURL(`${base}/`);
    await page.waitForTimeout(1100);
    const scrollRestored = await page.evaluate(() => ({
      y: scrollY,
      hidden: [...document.querySelectorAll('main [data-reveal-state="pending"]')].filter(
        (element) => element.checkVisibility() && element.getBoundingClientRect().top < innerHeight,
      ).length,
    }));
    if (Math.abs(scrollRestored.y - originScroll) > 2 || scrollRestored.hidden)
      failures.push(`${engine}: cached history lost scroll or concealed restored chapters`);
    results.push({ engine, originScroll, scrollRestored });
    await page.locator(".who-stat").evaluate((element) => element.scrollIntoView());
    await page.waitForTimeout(1500);
    const experience = await page.locator(".who-n").textContent();
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.locator('#mobile-site-navigation a[href="/work"]').first().click();
    await page.waitForURL(`${base}/work`);
    await page.goBack();
    await page.waitForURL(`${base}/`);
    await page.waitForTimeout(150);
    const restoredExperience = await page.locator(".who-n").textContent();
    if (experience !== restoredExperience)
      failures.push(`${engine}: cached history reset the visible experience figure`);
    results.push({ engine, experience, restoredExperience });
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(300);
    await page.goto(`${base}/robots.txt`, { waitUntil: "domcontentloaded" });
    await page.goBack();
    await page.waitForSelector(".home-hero");
    await page.waitForTimeout(150);
    const cacheRestore = await page.evaluate(() => ({
      persisted: window.__restoredFromCache,
      action: Number(getComputedStyle(document.querySelector(".home-hero-actions")).opacity),
    }));
    if (cacheRestore.action !== 1)
      failures.push(`${engine}: document history restore concealed the hero`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() =>
      document.querySelector(".home-hero")?.classList.contains("in"),
    );
    const warmReload = await page.evaluate(() =>
      document
        .querySelector(".home-hero")
        .getAnimations({ subtree: true })
        .some(
          (animation) =>
            animation.animationName === "home-hero-word-enter" && animation.playState === "running",
        ),
    );
    if (!warmReload) failures.push(`${engine}: warm reload skipped the entrance`);
    await page.waitForTimeout(2200);
    const performance = await page.evaluate(() => window.__motionSamples);
    const cls = performance.shifts.reduce((sum, value) => sum + value, 0);
    if (cls > 0.05) failures.push(`${engine}: warm hero shifted layout by ${cls}`);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(50);
    const reduced = await page.evaluate(() =>
      document
        .querySelector(".home-hero")
        .getAnimations({ subtree: true })
        .some((animation) => animation.playState === "running"),
    );
    if (reduced) failures.push(`${engine}: reduced motion left hero movement running`);
    await page.locator(".home-hero-cta").focus();
    await page.keyboard.press("Enter");
    await page.waitForURL(`${base}/contact`);
    results.push({
      engine,
      composition,
      traversal,
      cacheRestore,
      warmReload,
      cls,
      longestTask: Math.max(0, ...performance.tasks),
      reduced,
    });
  } catch (error) {
    failures.push(`${engine}: ${error.stack}`);
    await page
      .screenshot({ caret: "initial", path: `${output}/${engine}-failure.png` })
      .catch(() => {});
  } finally {
    await context.close();
    if (page.video()) await page.video().saveAs(`${output}/${engine}-replay.webm`);
    await browser.close();
  }
}
await writeFile(
  `${output}/results.json`,
  JSON.stringify({ results, failures, diagnostics }, null, 2),
);
console.log(JSON.stringify({ results, failures, diagnostics }, null, 2));
if (failures.length) process.exitCode = 1;
