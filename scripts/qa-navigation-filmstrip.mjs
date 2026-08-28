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

  await page.goto(`${base}/demo/command-center/sprout-and-spark/today`, { waitUntil: "networkidle" });
  if (run.delay) {
    await page.route("**/*", async (route) => {
      const request = route.request();
      const isNavigationPayload = request.url().includes("_rsc=") || request.headers().rsc === "1";
      if (isNavigationPayload) await new Promise((resolve) => setTimeout(resolve, run.delay));
      await route.continue();
    });
  }

  const target = page.locator('a[href="/demo/command-center/sprout-and-spark/pipeline"]:visible').first();
  await target.click({ noWaitAfter: true });
  const checkpoints = [48, 120, 220, 380];
  let elapsed = 0;
  for (const checkpoint of checkpoints) {
    await page.waitForTimeout(checkpoint - elapsed);
    elapsed = checkpoint;
    if (run.delay && checkpoint === 120) {
      const fallback = await page.evaluate(() => {
        const root = document.querySelector("[data-admin-route-loading]");
        return {
          visible: Boolean(root && getComputedStyle(root).opacity !== "0"),
          shapes: root?.querySelectorAll(".admin-skeleton-shape").length || 0,
          surfaces: root?.querySelectorAll(".admin-skeleton-surface").length || 0,
        };
      });
      if (!fallback.visible || fallback.shapes < 8 || fallback.surfaces < 3) {
        failures.push(`${run.name}: slow route did not expose useful destination-shaped feedback by 120ms`);
      }
    }
    await page.screenshot({ path: `${output}/${run.name}-${String(checkpoint).padStart(3, "0")}.png` });
  }

  await page.waitForURL("**/sprout-and-spark/pipeline", { timeout: 15_000 });
  await page.locator("[data-admin-route-loading]").waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});
  await page.getByRole("heading", { level: 1 }).waitFor({ state: "visible", timeout: 15_000 });
  const committedAnimations = await page.evaluate(() => document.getAnimations().filter((animation) => (
    animation instanceof CSSAnimation
    && animation.animationName === "admin-route-entry-in"
    && animation.effect?.target instanceof Element
    && animation.effect.target.closest(".admin-route-entry")
  )).length);
  if (!committedAnimations) failures.push(`${run.name}: committed destination had no active entrance motion`);
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
