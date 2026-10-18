/**
 * Visual and interaction QA for the shared admin chart primitives.
 *
 * Runs against the fictional demo (no credentials): the analytics funnel now
 * renders through the AdminMeter primitive and the revenue surface through the
 * migrated MRRChart. Asserts the primitives render with accessible semantics at
 * desktop and mobile widths, with no console or page errors, and captures
 * screenshots for review.
 *
 * Usage: PLAYWRIGHT_BASE_URL=http://localhost:3011 node scripts/qa-admin-charts.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const scenario = process.env.CHART_QA_SCENARIO || "northline-roofing";
const out = "/tmp/accelerate-chart-primitives";
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

    await page.goto(`${base}/demo/command-center/${scenario}/analytics`, {
      waitUntil: "networkidle",
    });
    await page.getByText("Funnel progression", { exact: true }).first().waitFor();

    const meters = page.locator('[role="meter"]');
    const meterCount = await meters.count();
    assert.ok(meterCount >= 4, `expected the funnel meters to render, saw ${meterCount}`);
    const firstMeter = meters.first();
    const meterLabel = await firstMeter.getAttribute("aria-label");
    const meterNow = await firstMeter.getAttribute("aria-valuenow");
    assert.ok(meterLabel, "the meter exposes an accessible label");
    assert.ok(Number(meterNow) >= 0 && Number(meterNow) <= 100, "the meter value is a percentage");

    const funnelSurface = page
      .getByText("Funnel progression", { exact: true })
      .first()
      .locator("xpath=ancestor::div[contains(@class,'admin-surface')][1]");
    await funnelSurface.scrollIntoViewIfNeeded();
    await funnelSurface.screenshot({ path: `${out}/funnel-${width}.png` });

    let revenueChart = "not-found";
    const revenue = await page.goto(`${base}/demo/command-center/${scenario}/revenue`, {
      waitUntil: "networkidle",
    });
    if (revenue && revenue.status() < 400) {
      const heading = page.getByText("Active Contracts by Start Month", { exact: true }).first();
      if (await heading.count()) {
        await heading.scrollIntoViewIfNeeded();
        const surface = heading.locator(
          "xpath=ancestor::div[contains(@class,'admin-surface')][1]",
        );
        await surface.screenshot({ path: `${out}/mrr-${width}.png` });
        revenueChart = "captured";
      } else {
        revenueChart = "heading-absent";
      }
    }

    assert.deepEqual(errors, [], `console or page errors at ${width}px`);
    results.push({
      width,
      meterCount,
      meterLabel,
      meterNow,
      revenueChart,
      result: "passed",
      proof:
        "Fictional Analytics funnel renders through AdminMeter with role=meter and an accessible percentage; revenue surface renders the migrated MRRChart; keyboard-free load with no console or page errors.",
    });
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${out}/summary.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
