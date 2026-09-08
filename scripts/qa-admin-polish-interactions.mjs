import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3045";
const output = process.env.QA_OUTPUT || "/tmp/admin-polish-qa";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
const waitSaved = async (page) => {
  await page.waitForFunction(
    () => !document.querySelector('.kanban-workspace[data-saving="true"]'),
  );
  await page.locator('[data-drag-active="true"]').waitFor({ state: "hidden" });
  await page.locator("[data-kanban-overlay]").waitFor({ state: "hidden" });
};
async function move(page, card, target, after = false, cancel = false) {
  card = card.and(page.locator(".kanban-scroller [data-opportunity-id]"));
  await card.scrollIntoViewIfNeeded();
  const grip = card.locator(".kanban-grip");
  const start = await grip.boundingBox();
  const end = await target.boundingBox();
  assert.ok(start && end);
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 9, start.y + start.height / 2, { steps: 2 });
  await page.waitForSelector('[data-drag-active="true"]');
  const shape = await page.locator("[data-kanban-overlay]").evaluate((e) => ({
    width: e.getBoundingClientRect().width,
    height: e.getBoundingClientRect().height,
  }));
  const original = await card.boundingBox();
  assert.ok(Math.abs(shape.width - original.width) < 2, "Overlay width");
  assert.ok(Math.abs(shape.height - original.height) < 2, "Overlay height");
  await page.mouse.move(end.x + end.width / 2, end.y + end.height * (after ? 0.8 : 0.15), {
    steps: 16,
  });
  await page.screenshot({ path: `${output}/drag-${results.length}.png` });
  if (cancel) await page.keyboard.press("Escape");
  await page.mouse.up();
  await waitSaved(page);
}
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "no-preference",
  });
  await context.addInitScript(() =>
    sessionStorage.setItem("accelerate:admin-demo:superdebate:appearance:v1", "signal"),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/demo/command-center/superdebate/pipeline`, { timeout: 120000 });
  await page.locator("[data-opportunity-id]").first().waitFor();
  await page.evaluate(() => {
    const original = window.fetch;
    window.__qaWrites = [];
    window.__qaFailure = "";
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.url || String(input);
      if (url.includes("/api/admin/revenue-os/pipeline") && init?.method === "PATCH") {
        const body = JSON.parse(init.body);
        window.__qaWrites.push(body);
        if (window.__qaFailure === "reorder" && body.reorder) {
          window.__qaFailure = "";
          return new Response(JSON.stringify({ error: "Simulated order failure" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }
      }
      return original(input, init);
    };
  });
  await page.locator(".kanban-scroller").evaluate((e) => {
    const main = document.querySelector(".admin-main");
    main.scrollTop += e.getBoundingClientRect().top - 150;
  });
  await page.waitForTimeout(300);
  const column = page.locator('section[aria-labelledby="column-new"]');
  const first = column.locator("[data-opportunity-id]").first();
  const id = await first.getAttribute("data-opportunity-id");
  const second = column.locator("[data-opportunity-id]").nth(1);
  await move(page, first, second, true);
  console.log(
    "AFTER MOVE",
    await page.evaluate(() => ({
      writes: window.__qaWrites,
      text: document.querySelector(".admin-toast-region")?.textContent,
    })),
  );
  assert.equal(
    await column.locator("[data-opportunity-id]").last().getAttribute("data-opportunity-id"),
    id,
  );
  results.push("Same-column mouse reorder");
  const writes = await page.evaluate(() => window.__qaWrites.length);
  await move(
    page,
    column.locator(`[data-opportunity-id="${id}"]`),
    column.locator("[data-opportunity-id]").first(),
    false,
    true,
  );
  assert.equal(await page.evaluate(() => window.__qaWrites.length), writes);
  results.push("Escape cancels without a write");
  const target = page
    .locator('section[aria-labelledby="column-contacted"] [data-opportunity-id]')
    .first();
  await move(page, column.locator(`[data-opportunity-id="${id}"]`), target, false);
  assert.equal(
    await page
      .locator(`[data-opportunity-id="${id}"]`)
      .evaluate((e) => e.closest("section").getAttribute("aria-labelledby")),
    "column-contacted",
  );
  results.push("Cross-column stage and order save");
  await page.evaluate(() => (window.__qaFailure = "reorder"));
  await move(
    page,
    page.locator(`[data-opportunity-id="${id}"]`),
    page.locator('section[aria-labelledby="column-qualified"] [data-opportunity-id]').first(),
    false,
  );
  assert.equal(
    await page
      .locator(`[data-opportunity-id="${id}"]`)
      .evaluate((e) => e.closest("section").getAttribute("aria-labelledby")),
    "column-qualified",
  );
  assert.match(await page.locator(".admin-toast-region").innerText(), /Stage changed/);
  results.push("Partial save reconciles committed stage after order failure");
  await page.reload();
  await page.locator(`[data-opportunity-id="${id}"]`).waitFor();
  assert.equal(
    await page
      .locator(`[data-opportunity-id="${id}"]`)
      .evaluate((e) => e.closest("section").getAttribute("aria-labelledby")),
    "column-qualified",
  );
  results.push("Reload retains saved stage");
  const selected = page.locator(`.kanban-scroller [data-opportunity-id="${id}"]`);
  await selected.scrollIntoViewIfNeeded();
  const orderBefore = await selected.evaluate((e) =>
    [...e.closest("section").querySelectorAll("[data-opportunity-id]")].map((e) =>
      e.getAttribute("data-opportunity-id"),
    ),
  );
  await selected.locator(".kanban-grip").focus();
  await page.keyboard.press("Space");
  await page.locator('[data-drag-active="true"]').waitFor();
  await page.waitForTimeout(150);
  await page.keyboard.press("ArrowDown");
  await page.locator(".kanban-slot[data-insertion]").waitFor();
  await page.waitForTimeout(400);
  await page.keyboard.press("Space");
  await waitSaved(page);
  assert.notDeepEqual(
    await selected.evaluate((e) =>
      [...e.closest("section").querySelectorAll("[data-opportunity-id]")].map((e) =>
        e.getAttribute("data-opportunity-id"),
      ),
    ),
    orderBefore,
  );
  results.push("Keyboard lift, move and drop saves a new order");
  // Card detail uses the shared route stage and back navigation.
  await selected.locator("a").first().click();
  await page.waitForURL(/pipeline\/[^/]+$/);
  await page.locator("h1").first().waitFor();
  await page.goBack();
  await page.locator(`[data-opportunity-id="${id}"]`).waitFor();
  results.push("Card detail open and browser Back");
  const durable = page.locator(`.kanban-scroller [data-opportunity-id="${id}"]`);
  await durable.getByRole("combobox").selectOption("lost");
  const lossDialog = page.getByRole("dialog", { name: "Record a lost opportunity" });
  await lossDialog.waitFor();
  assert.ok(await lossDialog.getByRole("button", { name: "Confirm move" }).isDisabled());
  await lossDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await lossDialog.waitFor({ state: "hidden" });
  assert.equal(
    await durable.evaluate((e) => e.closest("section").getAttribute("aria-labelledby")),
    "column-qualified",
  );
  await durable.getByRole("combobox").selectOption("lost");
  await lossDialog.getByLabel("Loss reason").fill("Timing changed after review");
  await lossDialog.getByRole("button", { name: "Confirm move" }).click();
  await lossDialog.waitFor({ state: "hidden" });
  await page.waitForFunction(
    (id) =>
      document
        .querySelector(`.kanban-scroller [data-opportunity-id="${id}"]`)
        ?.closest("section")
        ?.getAttribute("aria-labelledby") === "column-lost",
    id,
  );
  results.push(
    "Lost-stage confirmation requires a reason, cancels safely, and commits on confirmation",
  );

  await page.goto(`${base}/demo/command-center/superdebate/features`);
  await page.locator("[data-kanban-card]").first().waitFor({ timeout: 60000 });
  const edit = page
    .locator("[data-kanban-card]")
    .first()
    .getByRole("button", { name: /^Edit / });
  await edit.click();
  const dialog = page.locator('[data-admin-overlay="dialog"]').last();
  await dialog.waitFor();
  assert.ok(
    await dialog.evaluate((e) => e.contains(document.activeElement)),
    "Dialog traps initial focus",
  );
  await page.screenshot({ path: `${output}/feature-open.png` });
  const title = dialog.getByLabel("Title", { exact: true });
  const originalTitle = await title.inputValue();
  await title.fill(originalTitle + " edited");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Discard card edits?" }).waitFor();
  await page.getByRole("button", { name: "Cancel", exact: true }).last().click();
  assert.equal(await title.inputValue(), originalTitle + " edited");
  results.push("Themed discard confirmation retains draft on cancel");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Discard edits", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('[data-admin-overlay="dialog"]'));
  await edit.click();
  assert.equal(await page.getByLabel("Title", { exact: true }).inputValue(), originalTitle);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[data-admin-overlay="dialog"]'));
  assert.ok(
    await edit.evaluate((e) => e === document.activeElement),
    "Focus returns to card opener",
  );
  results.push("Card close/discard/reopen restores saved content and focus");
  await page.goto(`${base}/demo/command-center/superdebate/content`);
  await page.locator("[data-kanban-card]").first().waitFor();
  await page
    .locator("[data-kanban-card]")
    .first()
    .getByRole("button", { name: /^Edit / })
    .click();
  const contentTitle = page.getByLabel("Title", { exact: true });
  await contentTitle.fill("Polished content editing proof");
  await page
    .getByRole("button", { name: /Update/ })
    .last()
    .click();
  await page.waitForFunction(() => !document.querySelector('[data-admin-overlay="dialog"]'));
  await page.reload();
  await page.getByText("Polished content editing proof", { exact: true }).waitFor();
  results.push("Content editor saves and persists on reload");
  assert.deepEqual(errors, []);
  await context.close();
  await writeFile(`${output}/interactions.json`, JSON.stringify(results, null, 2));
  console.log(results);
} finally {
  await browser.close();
}
