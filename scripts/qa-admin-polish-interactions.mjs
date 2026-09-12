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
  card = card.and(
    page.locator(".kanban-scroller [data-opportunity-id], .kanban-scroller [data-kanban-card]"),
  );
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
  const scroller = page.locator(".kanban-scroller");
  await page.waitForTimeout(250);
  const releasedOffset = await scroller.evaluate((el) => el.scrollLeft);
  await page.waitForTimeout(450);
  assert.ok(
    Math.abs((await scroller.evaluate((el) => el.scrollLeft)) - releasedOffset) < 2,
    "Pointer release must stop board movement",
  );
}
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "no-preference",
  });
  await context.addInitScript(
    () =>
      window === window.top &&
      sessionStorage.setItem("accelerate:admin-demo:superdebate:appearance:v1", "signal"),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
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
  const clearFilters = page.getByRole("button", { name: "Clear filters", exact: true });
  if (await clearFilters.count()) await clearFilters.click();
  const featureColumns = page.locator(".kanban-scroller > section");
  let featureColumn;
  for (let index = 0; index < (await featureColumns.count()); index++) {
    const candidate = featureColumns.nth(index);
    if ((await candidate.locator("[data-kanban-card] .kanban-grip:not(:disabled)").count()) >= 2) {
      featureColumn = candidate;
      break;
    }
  }
  assert.ok(featureColumn, "Fictional board supplies two reorderable cards in a column");
  const featureCards = featureColumn.locator("[data-kanban-card]");
  const firstFeatureId = await featureCards.first().getAttribute("data-kanban-card");
  await move(page, featureCards.first(), featureCards.nth(1), true);
  assert.notEqual(
    await featureCards.first().getAttribute("data-kanban-card"),
    firstFeatureId,
    "Feature pointer reorder saves a changed order",
  );
  const featureOrder = await featureCards.evaluateAll((nodes) =>
    nodes.map((el) => el.getAttribute("data-kanban-card")),
  );
  await featureCards.first().locator(".kanban-grip").focus();
  await page.keyboard.press("Space");
  await page.locator('[data-drag-active="true"]').waitFor();
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(250);
  await page.keyboard.press("Space");
  await waitSaved(page);
  assert.notDeepEqual(
    await featureCards.evaluateAll((nodes) =>
      nodes.map((el) => el.getAttribute("data-kanban-card")),
    ),
    featureOrder,
    "Feature keyboard reorder saves a changed order",
  );
  results.push("Feature Board pointer and keyboard reorder preserve lifecycle scope");
  await page.goto(`${base}/demo/command-center/superdebate/content`);
  await page.locator("[data-kanban-card]").first().waitFor();
  const contentCard = page.locator(".kanban-scroller [data-kanban-card]").first();
  const contentId = await contentCard.getAttribute("data-kanban-card");
  const contentColumn = await contentCard.evaluate((el) =>
    el.closest("section").getAttribute("aria-labelledby"),
  );
  await contentCard.locator(".kanban-grip").focus();
  await page.keyboard.press("Space");
  await page.locator('[data-drag-active="true"]').waitFor();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(250);
  await page.keyboard.press("Space");
  await waitSaved(page);
  const movedContent = page.locator(`.kanban-scroller [data-kanban-card="${contentId}"]`);
  const movedColumn = await movedContent.evaluate((el) =>
    el.closest("section").getAttribute("aria-labelledby"),
  );
  assert.notEqual(movedColumn, contentColumn, "Content keyboard drop commits a different column");
  await page.reload();
  await movedContent.waitFor();
  assert.equal(
    await movedContent.evaluate((el) => el.closest("section").getAttribute("aria-labelledby")),
    movedColumn,
    "Content keyboard drop persists",
  );
  const destination = page.locator(
    `section[aria-labelledby="${contentColumn}"] .kanban-column-body`,
  );
  await destination.scrollIntoViewIfNeeded();
  await move(page, movedContent, destination);
  assert.equal(
    await movedContent.evaluate((el) => el.closest("section").getAttribute("aria-labelledby")),
    contentColumn,
    "Content pointer drop returns to intended column",
  );
  results.push("Content keyboard and pointer drops save the intended column");
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
  const retention = [];
  for (const width of [390, 768, 1440]) {
    for (const route of ["features", "pipeline", "content"]) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        reducedMotion: width === 768 ? "reduce" : "no-preference",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.route("**/api/**", (request) => {
        errors.push(`Protected API attempted: ${request.request().url()}`);
        return request.abort();
      });
      await page.goto(`${base}/demo/command-center/superdebate/${route}`, { timeout: 120000 });
      const board = page.getByRole("region", { name: "Kanban board", exact: true });
      await board.waitFor();
      await page.locator("[data-kanban-card]").first().waitFor();
      await board.evaluate((el) => {
        document.querySelector(".admin-main").scrollTop += el.getBoundingClientRect().top - 180;
        el.scrollLeft = 173;
      });
      const offset = () => board.evaluate((el) => el.scrollLeft);
      async function retained(action, expected = 173) {
        await page.waitForTimeout(400);
        assert.ok(
          Math.abs((await offset()) - expected) < 2,
          `${route}/${width}/${action}: scroll position ${await offset()} != ${expected}`,
        );
        retention.push({ route, width, action, left: await offset() });
      }
      await retained("manual scroll and selected-column update");
      const mainBefore = await page
        .locator(".admin-main")
        .evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop }));
      await board.evaluate((el) => el.focus({ preventScroll: true }));
      assert.ok(
        await board.evaluate((el) => document.activeElement === el),
        "Scroll region takes keyboard focus",
      );
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(350);
      assert.ok((await offset()) > 173, "Native keyboard scroll moves its region");
      const pager = page.getByRole("group", { name: "Board columns", exact: true });
      assert.ok(await pager.isVisible(), "Column navigation exists at every width");
      await board.evaluate((el) => {
        const original = el.scrollTo.bind(el);
        el.__scrollCalls = [];
        el.scrollTo = (...args) => {
          el.__scrollCalls.push(args[0]);
          return original(...args);
        };
      });
      await pager
        .getByRole("button")
        .last()
        .evaluate((el) => el.focus({ preventScroll: true }));
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
      assert.ok((await offset()) > 173, "Keyboard column selection moves the board");
      assert.deepEqual(
        await page.locator(".admin-main").evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop })),
        mainBefore,
        "Column navigation does not move either ancestor axis",
      );
      assert.equal(
        await board.evaluate((el) => el.__scrollCalls.at(-1)?.behavior),
        width === 768 ? "auto" : "smooth",
      );
      await board.evaluate((el) => {
        el.scrollLeft = 173;
      });
      await retained("manual scroll after explicit selection");
      const box = await board.boundingBox();
      await page.mouse.move(box.x + 20, box.y + 5);
      await page.mouse.down();
      await page.mouse.up();
      await retained("pointer release");
      await page.evaluate(() => window.dispatchEvent(new Event("admin:priority-refresh")));
      await retained("refresh");
      // Keep the Pipeline title fully visible while retaining a manually chosen offset.
      const actionOffset = route === "pipeline" ? 37 : 173;
      if (route === "pipeline") {
        await board.evaluate((el) => {
          el.scrollLeft = 37;
        });
        await retained("manual detail position", actionOffset);
      }
      // Pick a visible action without Playwright scrolling the board to reveal it.
      const actions =
        route === "pipeline"
          ? board.locator("[data-opportunity-id] a")
          : board.getByRole("button", { name: /^Edit / });
      let action;
      for (let index = 0; index < (await actions.count()); index++) {
        const candidate = actions.nth(index);
        const bounds = await candidate.boundingBox();
        if (
          bounds &&
          bounds.x >= box.x &&
          bounds.x + bounds.width <= box.x + box.width &&
          bounds.y > 0 &&
          bounds.y + bounds.height < 950
        ) {
          action = candidate;
          break;
        }
      }
      assert.ok(action, `${route}/${width}: visible card action`);
      await action.click();
      if (route === "pipeline") {
        await page.waitForURL(/pipeline\/[^/]+$/);
        await page.locator("h1").first().waitFor();
        await page.goBack();
        await board.waitFor();
      } else {
        await page.getByRole("dialog").last().waitFor();
        await retained("card open");
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.querySelector('[data-admin-overlay="dialog"]'));
      }
      await retained("card close or history return", actionOffset);
      await page.screenshot({ path: `${output}/retention-${route}-${width}.png` });
      assert.deepEqual(errors, []);
      await context.close();
      await writeFile(`${output}/board-retention.json`, JSON.stringify(retention, null, 2));
    }
  }
  await writeFile(`${output}/interactions.json`, JSON.stringify(results, null, 2));
  console.log(results);
} finally {
  await browser.close();
}
