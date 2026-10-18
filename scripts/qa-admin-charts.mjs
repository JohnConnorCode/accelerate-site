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
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3011";
const scenario = process.env.CHART_QA_SCENARIO || "northline-roofing";
const out = process.env.QA_OUTPUT || "/tmp/accelerate-chart-primitives";
const themes = JSON.parse(
  readFileSync(new URL("../src/lib/admin/themes.json", import.meta.url), "utf8"),
);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const results = [];
try {
  for (const { width, theme } of themes.flatMap((theme) =>
    [1440, 390].map((width) => ({ width, theme })),
  )) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: width === 390 ? "reduce" : "no-preference",
    });
    await context.addInitScript(
      ({ scenario, appearance }) => {
        sessionStorage.setItem(`accelerate:admin-demo:${scenario}:appearance:v1`, appearance);
      },
      { scenario, appearance: theme.id },
    );
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
    await page.waitForFunction(
      (appearance) => document.documentElement.dataset.theme === appearance,
      theme.id,
    );

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
    await funnelSurface.screenshot({ path: `${out}/funnel-${theme.id}-${width}.png` });
    const analyticsAudit = await new AxeBuilder({ page })
      .include(".admin-main")
      .withRules(["color-contrast"])
      .analyze();
    writeFileSync(
      `${out}/analytics-${theme.id}-${width}-contrast.json`,
      JSON.stringify(analyticsAudit.violations, null, 2),
    );
    assert.deepEqual(analyticsAudit.violations, [], `${theme.id}/${width}: analytics contrast`);

    let revenueChart = "not-found";
    const revenue = await page.goto(`${base}/demo/command-center/${scenario}/revenue`, {
      waitUntil: "networkidle",
    });
    if (revenue && revenue.status() < 400) {
      const heading = page.getByText("Active Contracts by Start Month", { exact: true }).first();
      if (await heading.count()) {
        await heading.scrollIntoViewIfNeeded();
        const surface = heading.locator("xpath=ancestor::div[contains(@class,'admin-surface')][1]");
        const line = surface.locator(".recharts-line-curve");
        await line.waitFor();
        const path = await line.getAttribute("d");
        assert.ok(
          path && !/[Cc]/.test(path),
          "active agreements retain their cumulative step curve",
        );
        const chart = surface.locator('[role="application"]').first();
        await chart.focus();
        await page.keyboard.press("ArrowRight");
        await surface.getByText("Active monthly value", { exact: true }).waitFor();
        await page.keyboard.press("Tab");
        await surface.screenshot({ path: `${out}/mrr-${theme.id}-${width}.png` });
        const revenueAudit = await new AxeBuilder({ page })
          .include(".admin-main")
          .withRules(["color-contrast"])
          .analyze();
        writeFileSync(
          `${out}/revenue-${theme.id}-${width}-contrast.json`,
          JSON.stringify(revenueAudit.violations, null, 2),
        );
        assert.deepEqual(revenueAudit.violations, [], `${theme.id}/${width}: revenue contrast`);
        revenueChart = "captured";
      } else {
        revenueChart = "heading-absent";
      }
    }
    assert.equal(revenueChart, "captured", "the migrated revenue chart must render");
    const geometry = await page.locator(".admin-main").evaluate((element) => ({
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    assert.ok(
      geometry.scrollWidth <= geometry.width + 1 && geometry.documentWidth <= geometry.viewport + 1,
      `${theme.id}/${width}: chart or metrics overflow`,
    );

    assert.deepEqual(errors, [], `console or page errors at ${width}px`);
    results.push({
      width,
      appearance: theme.id,
      meterCount,
      meterLabel,
      meterNow,
      revenueChart,
      result: "passed",
      proof:
        "Theme persistence, funnel meter semantics, revenue step curve, keyboard tooltip, AA text contrast, contained geometry and console errors; mobile uses reduced motion.",
    });
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync(`${out}/summary.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
