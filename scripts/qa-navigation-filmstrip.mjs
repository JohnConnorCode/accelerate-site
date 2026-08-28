import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3010";
const output = "/tmp/accelerate-navigation-filmstrip";
mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];

for (const run of [
  { name: "desktop-fast", viewport: { width: 1440, height: 900 }, delay: 0 },
  { name: "desktop-slow", viewport: { width: 1440, height: 900 }, delay: 650 },
  { name: "mobile-cached", viewport: { width: 390, height: 844 }, delay: 0 },
  { name: "mobile-cached-throttled", viewport: { width: 390, height: 844 }, delay: 0, cpuRate: 4 },
  { name: "mobile-slow", viewport: { width: 390, height: 844 }, delay: 650 },
]) {
  const context = await browser.newContext({ viewport: run.viewport, reducedMotion: "no-preference" });
  const page = await context.newPage();
  if (run.cpuRate) {
    const session = await context.newCDPSession(page);
    await session.send("Emulation.setCPUThrottlingRate", { rate: run.cpuRate });
  }
  const errors = [];
  let navigationTriggered = false;
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // Slow-route runs intentionally cancel speculative prefetches so the click
    // exercises an uncached transition. Chromium reports that cancellation as
    // ERR_FAILED even though the user-initiated navigation proceeds normally.
    if (run.delay && text.includes("Failed to load resource: net::ERR_FAILED")) return;
    errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(error.message));

  if (run.delay) {
    await page.route("**/*", async (route) => {
      const request = route.request();
      const isNavigationPayload = request.url().includes("_rsc=") || request.headers().rsc === "1";
      const isPipelinePayload = isNavigationPayload && request.url().includes("/pipeline");
      const isPrefetch = request.headers()["next-router-prefetch"] === "1" || request.headers().purpose === "prefetch";
      if (isPipelinePayload && isPrefetch && !navigationTriggered) return route.abort();
      if (isPipelinePayload && navigationTriggered) await new Promise((resolve) => setTimeout(resolve, run.delay));
      await route.continue();
    });
  }

  await page.goto(`${base}/demo/command-center/northline-roofing/today`, { waitUntil: "domcontentloaded" });
  const initialAsyncState = await page.evaluate(() => {
    const region = document.querySelector('[data-admin-async-state="loading"]');
    return region ? {
      visible: region.getAttribute("data-admin-async-visible"),
      opacity: Number(getComputedStyle(region).opacity),
    } : null;
  });
  if (initialAsyncState && initialAsyncState.opacity > 0.05) {
    failures.push(`${run.name}: cold-load fallback flashed before the shared ${120}ms reveal threshold (${JSON.stringify(initialAsyncState)})`);
  }
  await page.screenshot({ path: `${output}/${run.name}-direct-000.png` });
  await page.waitForTimeout(90);
  const earlyAsyncState = await page.evaluate(() => {
    const region = document.querySelector('[data-admin-async-state="loading"]');
    return region ? {
      visible: region.getAttribute("data-admin-async-visible"),
      opacity: Number(getComputedStyle(region).opacity),
    } : null;
  });
  if (earlyAsyncState && earlyAsyncState.opacity > 0.05) {
    failures.push(`${run.name}: cold-load fallback became visible before 120ms (${JSON.stringify(earlyAsyncState)})`);
  }
  await page.screenshot({ path: `${output}/${run.name}-direct-090.png` });
  await page.locator("[data-admin-route-stage]").waitFor({ state: "attached", timeout: 15_000 });
  await page.waitForFunction(() => {
    const stage = document.querySelector("[data-admin-route-stage]");
    const section = stage?.querySelector(":scope > * > *");
    return Boolean(
      stage && getComputedStyle(stage).animationName.includes("admin-route-stage-in")
      && section && getComputedStyle(section).animationName.includes("admin-route-section-in")
    );
  }, null, { timeout: 5_000 });
  const directEntrance = await page.evaluate(() => {
    const stage = document.querySelector("[data-admin-route-stage]");
    const animations = document.getAnimations({ subtree: true }).filter((animation) => (
      animation instanceof CSSAnimation
      && animation.effect?.target instanceof Element
      && stage?.contains(animation.effect.target)
      && animation.animationName === "admin-route-section-in"
    ));
    return {
      count: animations.length,
      delays: [...new Set(animations.map((animation) => Number(animation.effect?.getTiming().delay || 0)))],
    };
  });
  if (directEntrance.count < 2 || directEntrance.delays.length < 2) {
    failures.push(`${run.name}: direct admin load did not expose a visibly staggered committed entrance (${JSON.stringify(directEntrance)})`);
  }
  await page.screenshot({ path: `${output}/${run.name}-direct-entry.png` });
  if (!run.delay) await page.waitForLoadState("networkidle");
  const target = page.locator('a[href="/demo/command-center/northline-roofing/pipeline"]:visible').first();
  await target.waitFor({ state: "visible", timeout: 15_000 });
  const dockIndicatorStart = run.name.startsWith("mobile")
    ? await page.locator(".admin-mobile-dock-active").boundingBox()
    : null;
  if (run.name.startsWith("mobile")) {
    await page.evaluate(() => {
      window.__adminIntentReceipt = { startedAt: null, acknowledgedAt: null };
      const dock = document.querySelector(".admin-mobile-dock");
      dock?.addEventListener("pointerdown", () => {
        window.__adminIntentReceipt.startedAt = performance.now();
      }, { capture: true, once: true });
      const observer = new MutationObserver(() => {
        if (document.querySelector('.admin-mobile-dock-item[data-pending="true"]')) {
          window.__adminIntentReceipt.acknowledgedAt = performance.now();
          observer.disconnect();
        }
      });
      if (dock) observer.observe(dock, { attributes: true, subtree: true });
    });
  }
  navigationTriggered = true;
  await target.click({ noWaitAfter: true });
  if (run.name.startsWith("mobile")) {
    const intentAcknowledgement = await page.evaluate(() => {
      const receipt = window.__adminIntentReceipt;
      return receipt?.acknowledgedAt && receipt?.startedAt ? receipt.acknowledgedAt - receipt.startedAt : null;
    });
    const pendingLabel = await page.locator('.admin-mobile-dock-item[data-pending="true"]').textContent().catch(() => "");
    if (!pendingLabel?.includes("Pipeline")) failures.push(`${run.name}: destination intent was not acknowledged before the route committed`);
    const acknowledgementBudget = run.cpuRate ? 180 : 100;
    if (intentAcknowledgement === null || intentAcknowledgement > acknowledgementBudget) failures.push(`${run.name}: destination intent acknowledgement took ${intentAcknowledgement ?? "no receipt"}ms (budget ${acknowledgementBudget}ms)`);
  }
  const checkpoints = [48, 120, 220, 380];
  const dockPositions = [];
  let elapsed = 0;
  for (const checkpoint of checkpoints) {
    await page.waitForTimeout(checkpoint - elapsed);
    elapsed = checkpoint;
    if (run.delay && checkpoint === 120) {
      const fallback = await page.evaluate(() => {
        const root = document.querySelector("[data-admin-route-loading]");
        const retainedHeading = document.querySelector("[data-admin-route-stage] h1");
        return {
          visible: Boolean(root && getComputedStyle(root).opacity !== "0"),
          shapes: root?.querySelectorAll(".admin-skeleton-shape").length || 0,
          surfaces: root?.querySelectorAll(".admin-skeleton-surface").length || 0,
          retainedContent: Boolean(!root && retainedHeading && Number(getComputedStyle(retainedHeading).opacity) > 0.1),
        };
      });
      const usefulFallback = fallback.visible && fallback.shapes >= 8 && fallback.surfaces >= 3;
      if (!usefulFallback && !fallback.retainedContent) {
        failures.push(`${run.name}: slow route exposed neither retained content nor useful destination-shaped feedback by 120ms`);
      }
    }
    if (run.name.startsWith("mobile")) {
      const indicator = await page.locator(".admin-mobile-dock-active").boundingBox();
      dockPositions.push({ checkpoint, x: indicator?.x ?? null });
    }
    await page.screenshot({ path: `${output}/${run.name}-${String(checkpoint).padStart(3, "0")}.png` });
  }
  if (run.name.startsWith("mobile-cached")) {
    const at120 = dockPositions.find((sample) => sample.checkpoint === 120)?.x;
    if (!dockIndicatorStart || at120 === null || at120 === undefined || Math.abs(at120 - dockIndicatorStart.x) < 12) {
      failures.push(`mobile-cached: persistent dock indicator did not move during the cached navigation frame (${JSON.stringify(dockPositions)})`);
    }
  }

  await page.waitForURL("**/northline-roofing/pipeline", { timeout: 15_000 });
  await page.locator("[data-admin-route-loading]").waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
  await page.getByRole("heading", { level: 1 }).waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(() => {
    const stage = document.querySelector("[data-admin-route-stage]");
    return Boolean(stage && getComputedStyle(stage).animationName.includes("admin-route-stage-in"));
  }, null, { timeout: 5_000 });
  const committedAnimations = await page.evaluate(() => {
    const stage = document.querySelector("[data-admin-route-stage]");
    const animations = document.getAnimations({ subtree: true }).filter((animation) => (
      animation instanceof CSSAnimation
      && animation.effect?.target instanceof Element
      && stage?.contains(animation.effect.target)
      && animation.animationName === "admin-route-section-in"
    ));
    return {
      count: animations.length,
      delays: [...new Set(animations.map((animation) => Number(animation.effect?.getTiming().delay || 0)))],
    };
  });
  if (committedAnimations.count < 2 || committedAnimations.delays.length < 2) failures.push(`${run.name}: committed destination had no visible semantic stagger (${JSON.stringify(committedAnimations)})`);
  if (run.name.startsWith("mobile")) {
    const dockIndicatorEnd = await page.locator(".admin-mobile-dock-active").boundingBox();
    const activeDockLabel = await page.locator('.admin-mobile-dock-item[aria-current="page"] span').last().textContent();
    if (!dockIndicatorStart || !dockIndicatorEnd || Math.abs(dockIndicatorEnd.x - dockIndicatorStart.x) < 24) failures.push(`${run.name}: the shared dock selection surface did not move between destinations`);
    if (activeDockLabel?.trim() !== "Pipeline") failures.push(`${run.name}: Pipeline did not become the active mobile destination`);
  }
  await page.screenshot({ path: `${output}/${run.name}-committed.png` });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${output}/${run.name}-settled.png` });

  const state = await page.evaluate(() => ({
    focused: document.activeElement?.matches("h1, [data-route-heading]") || false,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
    y: document.querySelector(".admin-main")?.scrollTop || 0,
  }));
  if (!state.focused) failures.push(`${run.name}: destination heading was not focused`);
  if (state.overflow) failures.push(`${run.name}: horizontal overflow`);
  if (state.y > 2) failures.push(`${run.name}: forward navigation landed at ${state.y}px`);
  if (errors.length) failures.push(`${run.name}: ${errors.join(" | ")}`);
  await context.close();
}

// Exercise the regional loading owner independently from route resolution.
// A client-side fetch delay proves that fast reads stay clean while a genuinely
// slow read reveals destination-shaped geometry in the region it owns.
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await page.goto(`${base}/demo/command-center/northline-roofing/pipeline`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/admin/revenue-os/overview") || url.includes("/api/admin/revenue-os/actions")) {
        await new Promise((resolve) => window.setTimeout(resolve, 650));
      }
      return nativeFetch(input, init);
    };
  });
  await page.locator('a[href="/demo/command-center/northline-roofing/today"]:visible').first().click({ noWaitAfter: true });
  await page.waitForURL("**/northline-roofing/today", { timeout: 15_000 });
  const region = page.locator('[data-admin-async-state="loading"]');
  await region.waitFor({ state: "attached", timeout: 5_000 });
  await page.waitForTimeout(80);
  const beforeThreshold = await region.evaluate((node) => ({
    visible: node.getAttribute("data-admin-async-visible"),
    opacity: Number(getComputedStyle(node).opacity),
  }));
  if (beforeThreshold.opacity > 0.05) {
    failures.push(`slow-local-data: regional fallback flashed before 120ms (${JSON.stringify(beforeThreshold)})`);
  }
  await page.screenshot({ path: `${output}/mobile-local-data-080.png` });
  await page.waitForTimeout(150);
  const afterThreshold = await region.evaluate((node) => {
    const summary = node.querySelector(".admin-skeleton-surface");
    return {
      visible: node.getAttribute("data-admin-async-visible"),
      opacity: Number(getComputedStyle(node).opacity),
      shapes: node.querySelectorAll(".admin-skeleton-shape").length,
      surfaces: node.querySelectorAll(".admin-skeleton-surface").length,
      metricCells: summary?.children.length || 0,
    };
  });
  if (afterThreshold.visible !== "true" || afterThreshold.opacity < 0.35 || afterThreshold.shapes < 12 || afterThreshold.surfaces < 2 || afterThreshold.metricCells !== 4) {
    failures.push(`slow-local-data: regional fallback was not visible and destination-shaped after 230ms (${JSON.stringify(afterThreshold)})`);
  }
  await page.screenshot({ path: `${output}/mobile-local-data-230.png` });
  await page.locator('[data-admin-async-state="ready"]').waitFor({ state: "attached", timeout: 15_000 });
  await page.screenshot({ path: `${output}/mobile-local-data-ready.png` });
  await context.close();
}

await browser.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(JSON.stringify({ result: "passed", screenshots: output }, null, 2));
