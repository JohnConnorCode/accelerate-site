import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3047";
const output = "/tmp/accelerate-demo-marketing";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 768, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: width === 390 ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/demo/command-center`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Your business/ }).waitFor();
    assert.equal(
      await page.locator('meta[name="robots"]').getAttribute("content"),
      "noindex, nofollow",
    );
    const controls = page.getByRole("group", { name: "Explore the example workflow" });
    await controls.getByRole("button", { name: /Let AI prepare/ }).focus();
    await page.keyboard.press("Enter");
    await page.getByText("A reply, ready to review", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Preview the result" }).click();
    await page.getByText("Demo action complete", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Replay example" }).click();
    await page.getByText("A new inquiry", { exact: true }).waitFor();
    if (width === 390)
      assert.equal(
        await page.locator("#demo-story-panel").evaluate((n) => getComputedStyle(n).animationName),
        "none",
      );
    const cards = page.getByRole("link", { name: /^Explore .* demo workspace$/ });
    assert.equal(await cards.count(), 6);
    const hrefs = await cards.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")));
    assert.equal(new Set(hrefs).size, 6);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
    );
    for (const theme of ["light", "dark"]) {
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
      await page.locator("footer").scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${output}/launcher-${width}-${theme}.png`, fullPage: true });
    }
    await page.getByRole("link", { name: "Find your business" }).click();
    await page.getByRole("heading", { name: "See yourself in the work." }).waitFor();
    if (width === 1440) {
      for (const href of hrefs) {
        await page.goto(`${base}${href}`, { waitUntil: "networkidle" });
        await page.locator(".admin-main h1").filter({ hasText: "Today" }).waitFor();
        await page.waitForFunction(() => Boolean(window.__accelerateAdminDemoRuntime));
      }
    } else {
      await page.goto(`${base}/demo/command-center`, { waitUntil: "networkidle" });
      await page.locator("main").getByRole("link", { name: "Try the demo", exact: true }).click();
      await page.locator(".admin-main h1").filter({ hasText: "Today" }).waitFor();
    }
    assert.deepEqual(errors, []);
    results.push({ width, result: "passed", themes: ["light", "dark"] });
    await context.close();
  }
  writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(
    "PASS: story controls, keyboard, six scenario destinations, primary CTA, themes, responsive overflow, reduced motion and runtime errors.",
  );
} finally {
  await browser.close();
}
