import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3048";
const output = "/tmp/accelerate-website-authoring";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [],
  writes = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (request.method() !== "GET" && new URL(request.url()).pathname.startsWith("/api/"))
      writes.push(request.url());
  });
  page.setDefaultTimeout(15000);
  await page.goto(`${base}/demo/command-center/northline-roofing/site/website`);
  await page.getByText("Bundled website loaded.", { exact: false }).waitFor();
  const preview = page.frameLocator('iframe[title="Live website preview"]');
  await preview.getByText("Private live preview", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Add page", exact: true }).click();
  const create = page.getByRole("dialog", { name: "Create a page" });
  await create
    .getByRole("textbox", { name: "Page title", exact: true })
    .fill("Bookkeeping automation");
  await create.getByRole("button", { name: "Create draft page", exact: true }).click();
  await page.getByRole("textbox", { name: "Page URL", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Page URL", exact: true }).inputValue(),
    "/bookkeeping-automation",
  );
  await preview.getByRole("heading", { name: "Bookkeeping automation", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Add page", exact: true })
    .locator("..")
    .getByRole("button", { name: "Ask AI", exact: true })
    .click();
  const ai = page.getByRole("dialog");
  assert.equal(
    await ai.getByRole("combobox", { name: /Model/ }).inputValue(),
    "meta/muse-spark-1.3",
  );
  assert.equal(await ai.getByRole("combobox", { name: /Model/ }).locator("option").count(), 5);
  await ai.getByRole("combobox", { name: /Model/ }).selectOption("nex-agi/nex-n2.5-mini:free");
  await ai.getByRole("textbox").fill("Explain how this reduces evening admin work.");
  await ai.getByRole("button", { name: "Prepare suggestion", exact: true }).click();
  await ai.getByRole("region", { name: "AI suggestion review" }).waitFor();
  await page.screenshot({ path: `${output}/ai-review-desktop.png` });
  await ai.getByRole("button", { name: "Apply to draft", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByText("Private revision 1 saved.", { exact: false }).waitFor();
  const draft = await page.evaluate(
    async () => (await (await fetch("/api/admin/site/website")).json()).website,
  );
  assert.equal(draft.publishedRevisionId, null);
  await page.getByRole("button", { name: "Review publication", exact: true }).click();
  await page.getByRole("button", { name: "Publish saved revision", exact: true }).click();
  await page.getByText("Website published.", { exact: false }).waitFor();
  const published = await page.evaluate(
    async () => (await (await fetch("/api/admin/site/website")).json()).website,
  );
  assert.equal(published.publishedRevisionId, draft.draft.id);
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("A second version");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByText("Private revision 3 saved.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Review publication", exact: true }).click();
  await page.getByRole("button", { name: "Publish saved revision", exact: true }).click();
  await page.getByText("Website published.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByRole("button", { name: "Review rollback", exact: true }).click();
  await page.getByRole("button", { name: "Confirm rollback", exact: true }).click();
  await page.getByText("Website rolled back.", { exact: false }).waitFor();
  const rolledBack = await page.evaluate(
    async () => (await (await fetch("/api/admin/site/website")).json()).website,
  );
  assert.equal(rolledBack.publishedRevisionId, draft.draft.id);
  assert.equal(rolledBack.draft.document.pages[1].metadata.title, "A second version");
  await page.getByRole("button", { name: "Phone", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('iframe[title="Live website preview"]')?.contentWindow?.innerWidth ===
      390,
  );
  assert.equal(await preview.locator("body").evaluate(() => window.innerWidth), 390);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${output}/editor-desktop.png` });
  await page.getByRole("button", { name: "Collections", exact: true }).click();
  await page.getByLabel("New collection name", { exact: true }).fill("Articles");
  await page.getByRole("button", { name: "Add collection", exact: true }).click();
  await page.getByRole("button", { name: "Add entry", exact: true }).click();
  await page.getByLabel("Entry title", { exact: true }).fill("Our first article");
  await preview.getByRole("heading", { name: "Our first article", exact: true }).waitFor();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.getByText("Private revision 6 saved.", { exact: false }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `${output}/editor-mobile.png` });
  await page.getByRole("button", { name: "Preview page", exact: true }).click();
  await preview.getByRole("heading", { name: "Our first article", exact: true }).waitFor();
  await page.waitForFunction(() => {
    const frame = document.querySelector('iframe[title="Live website preview"]');
    if (!frame) return false;
    const rect = frame.getBoundingClientRect(),
      holder = frame.parentElement.getBoundingClientRect();
    return rect.left >= holder.left - 1 && rect.right <= holder.right + 1;
  });
  assert.equal(
    await page.getByRole("button", { name: "Hide preview", exact: true }).isVisible(),
    false,
  );
  await page.screenshot({ path: `${output}/live-preview-mobile.png` });
  await page.getByRole("button", { name: "Edit content", exact: true }).click();
  // Only fictional UI QA. Live board administration uses the canonical DB/CLI.
  await page.goto(`${base}/demo/command-center/northline-roofing/features`);
  await page.getByRole("button", { name: /^Filters/ }).waitFor();
  assert.equal(await page.getByLabel("Filter by category", { exact: true }).count(), 0);
  await page.screenshot({ path: `${output}/filters-mobile.png` });
  const filters = page.getByRole("button", { name: /^Filters/ });
  await filters.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Filter work" });
  await dialog.waitFor();
  await dialog.getByLabel("Filter by priority", { exact: true }).selectOption("high");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `${output}/filters-dialog-mobile.png` });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await dialog.count(), 0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${output}/filters-desktop.png` });
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  const result = {
    status: "passed",
    checks: [
      "Create page and live preview",
      "Five model tiers; Muse default and explicit free selection",
      "Review AI suggestion before local apply; undo and redo",
      "Save remains private; publish exact draft; rollback preserves newer draft",
      "Collection entry rich content preview",
      "Phone viewport and mobile overflow",
      "Fictional advanced filters keyboard, Escape and mobile dialog",
    ],
    errors,
    writes,
    output,
  };
  await writeFile(`${output}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const page = browser.contexts()[0]?.pages()[0];
  if (page) {
    await page.screenshot({ path: `${output}/failure.png` });
    await writeFile(`${output}/failure.txt`, await page.locator("body").innerText());
  }
  throw error;
} finally {
  await browser.close();
}
