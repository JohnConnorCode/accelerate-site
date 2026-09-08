import assert from "node:assert/strict";
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3045",
  output = process.env.QA_OUTPUT || "/tmp/admin-polish-qa";
const browser = await chromium.launch(),
  results = [];
try {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/demo/command-center/superdebate/pipeline`, { timeout: 120000 });
    await page.locator("[data-opportunity-id]").first().waitFor();
    await page.locator(".kanban-scroller").evaluate((e) => {
      document.querySelector(".admin-main").scrollTop += e.getBoundingClientRect().top - 120;
    });
    await page.waitForTimeout(250);
    const column = page.locator('section[aria-labelledby="column-new"]'),
      cards = column.locator("[data-opportunity-id]");
    const id = await cards.first().getAttribute("data-opportunity-id");
    const grip = await cards.first().locator(".kanban-grip").boundingBox(),
      target = await cards.nth(1).boundingBox();
    const cdp = await context.newCDPSession(page);
    const point = (x, y) => ({ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 });
    const x = grip.x + grip.width / 2,
      y = grip.y + grip.height / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(x, y)] });
    await page.waitForTimeout(220);
    await page.locator('[data-drag-active="true"]').waitFor();
    for (let step = 1; step <= 14; step++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          point(
            x + ((target.x + target.width / 2 - x) * step) / 14,
            y + ((target.y + target.height * 0.8 - y) * step) / 14,
          ),
        ],
      });
      await page.waitForTimeout(12);
    }
    await page.screenshot({ path: `${output}/touch-drag-${reducedMotion}.png` });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForFunction(() => !document.querySelector('[data-saving="true"]'));
    await page.waitForTimeout(240);
    assert.equal(await cards.last().getAttribute("data-opportunity-id"), id);
    results.push(`${reducedMotion}: touch reorder saved`);
    const first = cards.first();
    const body = await first.boundingBox();
    const before = await page.locator(".kanban-scroller").evaluate((e) => e.scrollLeft);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point(body.x + body.width * 0.85, body.y + body.height * 0.5)],
    });
    for (let step = 1; step <= 10; step++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [point(body.x + body.width * 0.85 - step * 18, body.y + body.height * 0.5)],
      });
      await page.waitForTimeout(12);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);
    assert.ok((await page.locator(".kanban-scroller").evaluate((e) => e.scrollLeft)) > before + 40);
    assert.equal(await page.locator('[data-drag-active="true"]').count(), 0);
    results.push(`${reducedMotion}: card-body swipe scrolls without dragging`);
    await page
      .getByRole("group", { name: "Board columns", exact: true })
      .getByRole("button", { name: /^New / })
      .click();
    await page.waitForTimeout(260);
    const saved = page.locator(`.kanban-scroller [data-opportunity-id="${id}"]`);
    await saved.getByRole("combobox").selectOption("contacted");
    await page.waitForTimeout(250);
    assert.equal(
      await saved.evaluate((e) => e.closest("section").getAttribute("aria-labelledby")),
      "column-contacted",
    );
    results.push(`${reducedMotion}: stage control moves without dragging`);
    await page.screenshot({ path: `${output}/touch-board-${reducedMotion}.png` });
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(`${output}/touch.json`, JSON.stringify(results, null, 2));
  console.log(results);
} finally {
  await browser.close();
}
