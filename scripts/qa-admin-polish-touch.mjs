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
    const feedback = page.locator(".admin-toast").last();
    await feedback.waitFor();
    const dismissFeedback = feedback.getByRole("button", { name: /^Dismiss:/ });
    const dismissBounds = await dismissFeedback.boundingBox();
    const feedbackBounds = await feedback.boundingBox();
    const dockBounds = await page.locator(".admin-mobile-dock").boundingBox();
    assert.ok(dismissBounds.width >= 44 && dismissBounds.height >= 44);
    assert.ok(feedbackBounds.x >= 0 && feedbackBounds.x + feedbackBounds.width <= 391);
    assert.ok(feedbackBounds.y + feedbackBounds.height <= dockBounds.y);
    if (reducedMotion === "reduce") {
      assert.equal(await feedback.evaluate((node) => getComputedStyle(node).transform), "none");
      assert.match(
        await feedback.evaluate((node) => getComputedStyle(node).filter),
        /^(none|blur\(0px\))$/,
      );
    }
    await page.screenshot({ path: `${output}/feedback-phone-${reducedMotion}.png` });
    await dismissFeedback.tap();
    await feedback.waitFor({ state: "hidden" });
    results.push(
      `${reducedMotion}: readable feedback clears through a 44px touch target above the dock`,
    );
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
    await page.goto(`${base}/demo/command-center/superdebate/features`);
    const edit = page
      .locator("[data-kanban-card]")
      .first()
      .getByRole("button", { name: /^Edit / });
    await edit.waitFor();
    await edit.tap();
    const editor = page.getByRole("dialog", { name: "Feature details" });
    const title = editor.getByLabel("Title", { exact: true });
    const savedTitle = await title.inputValue();
    await title.fill(`${savedTitle} phone edit`);
    await editor.getByRole("button", { name: "Close feature details" }).tap();
    const confirmation = page.getByRole("dialog", { name: "Discard card edits?" });
    await confirmation.waitFor();
    const keepEditing = confirmation.getByRole("button", { name: "Keep editing", exact: true });
    const discard = confirmation.getByRole("button", { name: "Discard edits", exact: true });
    await page.waitForFunction(() => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      const current = dialogs[dialogs.length - 1];
      return (
        current &&
        getComputedStyle(current).opacity === "1" &&
        getComputedStyle(current).transform === "none"
      );
    });
    for (const control of [keepEditing, discard]) {
      const bounds = await control.boundingBox();
      assert.ok(
        bounds.height >= 44 && bounds.width >= 44,
        `Touch target: ${bounds.width} × ${bounds.height}`,
      );
    }
    const confirmationBounds = await confirmation.boundingBox();
    assert.ok(confirmationBounds.x >= 0 && confirmationBounds.x + confirmationBounds.width <= 391);
    assert.ok(confirmationBounds.y >= 0 && confirmationBounds.y + confirmationBounds.height <= 845);
    if (reducedMotion === "reduce") {
      assert.equal(await confirmation.evaluate((node) => getComputedStyle(node).transform), "none");
    }
    const coveredTitle = await title.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      const hit = document.elementFromPoint(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2,
      );
      const layers = document.querySelectorAll('[data-admin-overlay="layer"]');
      return hit === layers[layers.length - 1]?.querySelector('[data-admin-overlay="backdrop"]');
    });
    assert.ok(coveredTitle, "Confirmation backdrop covers the editor and blocks pointer access");
    await page.screenshot({ path: `${output}/confirmation-phone-${reducedMotion}.png` });
    await keepEditing.tap();
    await confirmation.waitFor({ state: "hidden" });
    assert.equal(
      await page.locator('[data-admin-overlay="layer"]').count(),
      1,
      "Only the editor layer remains after cancellation",
    );
    assert.equal(await title.inputValue(), `${savedTitle} phone edit`);
    assert.ok(
      await title.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        return (
          document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2) ===
          node
        );
      }),
      "Closing the confirmation reveals the editable draft again",
    );
    await editor.getByRole("button", { name: "Close feature details" }).tap();
    await discard.waitFor();
    if (reducedMotion === "reduce") {
      const frames = await discard.evaluate(async (button) => {
        const dialog = button.closest('[role="dialog"]');
        const backdrops = document.querySelectorAll('[data-admin-overlay="backdrop"]');
        const backdrop = backdrops[backdrops.length - 1];
        const samples = [];
        const sample = () => {
          for (const node of [dialog, backdrop]) {
            if (node) {
              const style = node.isConnected ? getComputedStyle(node) : node.style;
              samples.push({
                opacity: Number(style.opacity),
                transform: style.transform || "none",
              });
            }
          }
        };
        const observer = new MutationObserver(sample);
        for (const node of [dialog, backdrop]) {
          if (node) observer.observe(node, { attributes: true, attributeFilter: ["style"] });
        }
        button.click();
        const deadline = performance.now() + 5000;
        while (dialog.isConnected && performance.now() < deadline) {
          await new Promise(requestAnimationFrame);
          sample();
        }
        observer.disconnect();
        return { samples, removed: !dialog.isConnected };
      });
      assert.ok(frames.removed, "Reduced-motion dialog exits completely");
      assert.ok(
        frames.samples.every(
          (frame) => [0, 1].includes(frame.opacity) && frame.transform === "none",
        ),
      );
    } else {
      await discard.tap();
    }
    await editor.waitFor({ state: "hidden" });
    await edit.tap();
    assert.equal(await page.getByLabel("Title", { exact: true }).inputValue(), savedTitle);
    await page.getByRole("button", { name: "Close feature details" }).tap();
    await page.waitForFunction(() => !document.querySelector('[data-admin-overlay="dialog"]'));
    assert.ok(await edit.evaluate((node) => node === document.activeElement));
    results.push(
      `${reducedMotion}: phone confirmation retains edits on cancel, discards only on confirmation and restores focus`,
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(`${output}/touch.json`, JSON.stringify(results, null, 2));
  console.log(results);
} finally {
  await browser.close();
}
