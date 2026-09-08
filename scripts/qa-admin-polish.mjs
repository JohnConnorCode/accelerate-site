import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3045";
const output = process.env.QA_OUTPUT || "/tmp/admin-polish-qa";
const themes = JSON.parse(
  await readFile(new URL("../src/lib/admin/themes.json", import.meta.url), "utf8"),
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [],
  errors = [];
try {
  for (const theme of themes.filter(
    (t) => !process.env.QA_THEME || t.id === process.env.QA_THEME,
  )) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: "light",
    });
    await context.addInitScript(
      (theme) => sessionStorage.setItem("accelerate:admin-demo:superdebate:appearance:v1", theme),
      theme.id,
    );
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(`${base}/demo/command-center/superdebate/pipeline`, { timeout: 120000 });
    await page.locator("[data-opportunity-id]").first().waitFor({ timeout: 120000 });
    await page.waitForTimeout(350);
    const geometry = await page
      .locator("[data-opportunity-id]")
      .first()
      .evaluate((el) => ({
        width: el.getBoundingClientRect().width,
        radius: getComputedStyle(el).borderRadius,
        ink: getComputedStyle(el).color,
        background: getComputedStyle(el).backgroundColor,
      }));
    assert.ok(geometry.width >= 270, JSON.stringify(geometry));
    assert.notEqual(geometry.radius, "0px");
    assert.equal(await page.locator("html").getAttribute("data-theme"), theme.id);
    const accessibility = await new AxeBuilder({ page })
      .include(".admin-shell")
      .withRules(["color-contrast"])
      .analyze();
    await writeFile(
      `${output}/${theme.id}-contrast.json`,
      JSON.stringify(accessibility.violations, null, 2),
    );
    assert.deepEqual(accessibility.violations, [], `${theme.id}: contrast audit`);
    await page.screenshot({ path: `${output}/${theme.id}-desktop.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      "Document must not overflow",
    );
    await page.screenshot({ path: `${output}/${theme.id}-mobile.png` });
    await page.locator("[data-opportunity-id]").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${output}/${theme.id}-mobile-board.png` });
    const surfaces = [];
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const route of ["today", "features", "content"]) {
      await page.goto(`${base}/demo/command-center/superdebate/${route}`);
      await page.locator("h1").first().waitFor();
      if (route !== "today") await page.locator("[data-kanban-card]").first().waitFor();
      await page.waitForTimeout(400);
      const audit = await new AxeBuilder({ page })
        .include(".admin-shell")
        .withRules(["color-contrast"])
        .analyze();
      await writeFile(
        `${output}/${theme.id}-${route}-contrast.json`,
        JSON.stringify(audit.violations, null, 2),
      );
      await page.screenshot({ path: `${output}/${theme.id}-${route}.png` });
      surfaces.push({ route, violations: audit.violations.length });
    }
    results.push({ theme: theme.id, geometry, surfaces });
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.ok(
    results.every((result) => result.surfaces.every((surface) => surface.violations === 0)),
    JSON.stringify(results),
  );
  await writeFile(
    `${output}/results${process.env.QA_THEME ? `-${process.env.QA_THEME}` : ""}.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
