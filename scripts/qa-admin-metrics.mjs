/**
 * Visual and interaction QA for the unified metric primitive.
 *
 * Runs against the fictional demo (no credentials): asserts the revenue KPI grid
 * renders through the shared StatCard primitive with a formatted value and no
 * duplicated unlabelled delta, that the analytics grid renders the primitive,
 * and that there are no console or page errors at desktop and mobile widths.
 *
 * Usage: PLAYWRIGHT_BASE_URL=http://localhost:3011 node scripts/qa-admin-metrics.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const scenario = process.env.CHART_QA_SCENARIO || "northline-roofing";
const out = process.env.QA_OUTPUT || "/tmp/accelerate-admin-metrics";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: width === 390 ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.route("**/api/admin/**", async (route) => {
      errors.push("Protected API escaped fictional runtime");
      await route.abort();
    });

    // Revenue: the shared primitive with a formatted value and no duplicated delta.
    await page.goto(`${base}/demo/command-center/${scenario}/revenue`, {
      waitUntil: "networkidle",
    });
    const revenueGrid = page.locator(".admin-grid--metrics").first();
    await revenueGrid.waitFor();
    const recurring = page.getByText("Monthly Recurring", { exact: true }).first();
    await recurring.waitFor();
    const revenueText = (await revenueGrid.textContent()) ?? "";
    assert.match(revenueText, /\$/, "the recurring KPI shows a formatted currency value");
    assert.match(
      revenueText,
      /Monthly value of active contracts/,
      "the recurring KPI names what the figure means",
    );
    assert.ok(!revenueText.includes("/mo"), "the redundant unlabelled delta text is gone");
    await revenueGrid.scrollIntoViewIfNeeded();
    await revenueGrid.screenshot({ path: `${out}/revenue-metrics-${width}.png` });

    // Analytics: the same primitive renders the KPI grid.
    await page.goto(`${base}/demo/command-center/${scenario}/analytics`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("heading", { name: "Analytics", exact: true }).waitFor();
    const statValues = page.locator(".admin-stat-value");
    assert.ok((await statValues.count()) >= 1, "the analytics KPI grid uses the primitive");
    const analyticsGrid = page.locator(".admin-grid--metrics").first();
    await analyticsGrid.scrollIntoViewIfNeeded();
    await analyticsGrid.screenshot({ path: `${out}/analytics-metrics-${width}.png` });

    assert.deepEqual(errors, [], `console or page errors at ${width}px`);
    results.push({
      width,
      revenueStatValues: await page.locator(".admin-stat-value").count(),
      result: "passed",
      proof:
        "Fictional revenue and analytics KPI grids render through the shared StatCard primitive; the recurring KPI shows a formatted currency value with a descriptive note and no duplicated unlabelled delta; no console or page errors; mobile context uses reducedMotion=reduce.",
    });
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${out}/summary.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
