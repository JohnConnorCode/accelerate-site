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
  { name: "mobile-slow", viewport: { width: 390, height: 844 }, delay: 650 },
]) {
  const context = await browser.newContext({ viewport: run.viewport, reducedMotion: "no-preference" });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));

  if (run.delay) {
    await page.route("**/*", async (route) => {
      const request = route.request();
      const isNavigationPayload = request.url().includes("_rsc=") || request.headers().rsc === "1";
      if (isNavigationPayload && request.url().includes("/pipeline")) await new Promise((resolve) => setTimeout(resolve, run.delay));
      await route.continue();
    });
  }

  await page.goto(`${base}/demo/command-center/northline-roofing/today`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.getAnimations().some((animation) => (
    animation instanceof CSSAnimation
    && animation.animationName === "admin-route-entry-in"
    && animation.effect?.target instanceof Element
    && animation.effect.target.closest(".admin-route-entry")
  )), { timeout: 15_000 }).catch(() => {});
  const directEntrance = await page.evaluate(() => {
    const animations = document.getAnimations().filter((animation) => (
      animation instanceof CSSAnimation
      && animation.animationName === "admin-route-entry-in"
      && animation.effect?.target instanceof Element
      && animation.effect.target.closest(".admin-route-entry")
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
  await target.click({ noWaitAfter: true });
  if (run.name.startsWith("mobile")) {
    const intentAcknowledgement = await page.evaluate(() => {
      const receipt = window.__adminIntentReceipt;
      return receipt?.acknowledgedAt && receipt?.startedAt ? receipt.acknowledgedAt - receipt.startedAt : null;
    });
    const pendingLabel = await page.locator('.admin-mobile-dock-item[data-pending="true"]').textContent().catch(() => "");
    if (!pendingLabel?.includes("Pipeline")) failures.push(`${run.name}: destination intent was not acknowledged before the route committed`);
    if (intentAcknowledgement === null || intentAcknowledgement > 100) failures.push(`${run.name}: destination intent acknowledgement took ${intentAcknowledgement ?? "no receipt"}ms`);
  }
  const checkpoints = [48, 120, 220, 380];
  let elapsed = 0;
  for (const checkpoint of checkpoints) {
    await page.waitForTimeout(checkpoint - elapsed);
    elapsed = checkpoint;
    if (run.delay && checkpoint === 120) {
      const fallback = await page.evaluate(() => {
        const root = document.querySelector("[data-admin-route-loading]");
        const retainedHeading = document.querySelector(".admin-route-entry h1");
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
    await page.screenshot({ path: `${output}/${run.name}-${String(checkpoint).padStart(3, "0")}.png` });
  }

  await page.waitForURL("**/northline-roofing/pipeline", { timeout: 15_000 });
  await page.locator("[data-admin-route-loading]").waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
  await page.getByRole("heading", { level: 1 }).waitFor({ state: "visible", timeout: 15_000 });
  const committedAnimations = await page.evaluate(() => {
    const animations = document.getAnimations().filter((animation) => (
      animation instanceof CSSAnimation
      && animation.animationName === "admin-route-entry-in"
      && animation.effect?.target instanceof Element
      && animation.effect.target.closest(".admin-route-entry")
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

await browser.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(JSON.stringify({ result: "passed", screenshots: output }, null, 2));
