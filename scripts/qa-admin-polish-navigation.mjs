import assert from "node:assert/strict";
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3045",
  output = process.env.QA_OUTPUT || "/tmp/admin-polish-qa";
const browser = await chromium.launch(),
  results = [];
async function navigate(page, suffix) {
  const link = page.locator(`a[href$="/${suffix}"]`).first();
  const toggle = link
    .locator("xpath=ancestor::section[1]")
    .locator("button[aria-expanded]")
    .first();
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  await link.click();
}
try {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/demo/command-center/superdebate/pipeline`, { timeout: 120000 });
    await page.locator("[data-opportunity-id]").first().waitFor();
    await page.evaluate(() => {
      const original = window.fetch;
      window.__navDelay = 750;
      window.__navFailure = false;
      window.__navSamples = [];
      window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input.url || String(input);
        if (url.includes("/api/admin/content") && (!init?.method || init.method === "GET")) {
          await new Promise((resolve) => setTimeout(resolve, window.__navDelay));
          if (window.__navFailure)
            return new Response(JSON.stringify({ error: "Temporary content read failure" }), {
              status: 503,
              headers: { "content-type": "application/json" },
            });
        }
        return original(input, init);
      };
      const sample = () => {
        window.__navSamples.push({
          time: performance.now(),
          path: location.pathname,
          heading: document.querySelector("h1")?.textContent,
          visible: !!document.querySelector('[data-admin-async-visible="true"]'),
          cards: document.querySelectorAll("[data-kanban-card]").length,
        });
        window.__navFrame = requestAnimationFrame(sample);
      };
      sample();
    });
    await page.route("**/demo/command-center/superdebate/content?*", async (route) => {
      if (route.request().headers().rsc) await new Promise((resolve) => setTimeout(resolve, 300));
      await route.continue();
    });
    await navigate(page, "content");
    await page.locator('[data-admin-async-visible="true"]').waitFor();
    await page.screenshot({ path: `${output}/navigation-slow-${reducedMotion}.png` });
    await page.locator("[data-kanban-card]").first().waitFor();
    const samples = await page.evaluate(() =>
      window.__navSamples.filter((s) => s.path.endsWith("/content")),
    );
    assert.ok(samples.some((s) => s.visible));
    assert.ok(samples.some((s) => s.heading === "Content Calendar"));
    results.push(`${reducedMotion}: slow read keeps page identity and reveals delayed placeholder`);
    await navigate(page, "pipeline");
    await page.locator("[data-opportunity-id]").first().waitFor();
    await page.evaluate(() => (window.__navSamples = []));
    await navigate(page, "content");
    await page.locator("[data-kanban-card]").first().waitFor();
    await page.waitForTimeout(200);
    assert.equal(
      await page.evaluate(() =>
        window.__navSamples.some((s) => s.path.endsWith("/content") && s.visible),
      ),
      false,
    );
    results.push(`${reducedMotion}: cached return renders cards without skeleton flash`);
    await page.screenshot({ path: `${output}/navigation-ready-${reducedMotion}.png` });
    await page.evaluate(() => {
      window.__navFailure = true;
      window.__navSamples = [];
      window.dispatchEvent(new Event("admin:priority-refresh"));
    });
    await page.getByText("Showing the last successful snapshot", { exact: true }).waitFor();
    assert.ok(await page.locator("[data-kanban-card]").count());
    assert.equal(await page.evaluate(() => window.__navSamples.some((s) => s.visible)), false);
    await page.screenshot({ path: `${output}/navigation-refresh-error-${reducedMotion}.png` });
    await page.evaluate(() => (window.__navFailure = false));
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page
      .getByText("Showing the last successful snapshot", { exact: true })
      .waitFor({ state: "hidden" });
    results.push(`${reducedMotion}: failed refresh keeps cards and retries without blanking`);
    await page.evaluate(() => cancelAnimationFrame(window.__navFrame));
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(`${output}/navigation.json`, JSON.stringify(results, null, 2));
  console.log(results);
} finally {
  await browser.close();
}
