import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3047";
const output = "/tmp/accelerate-daily-work-qa";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: width === 390 ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/admin"))
        errors.push("Demo requested a protected API");
    });
    const route = (path) => `${base}/demo/command-center/northline-roofing/${path}`;
    await page.goto(route("today"), { waitUntil: "networkidle" });
    await page.locator('[data-today-module="attention"]').waitFor();
    const rail = page.locator('nav[aria-label="Admin navigation"]:visible').first();
    if (width === 390) await page.getByRole("button", { name: "Open More" }).click();
    assert.deepEqual(
      await rail
        .locator("section[data-nav-section]")
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-nav-section"))),
      ["Today", "Work", "Records", "Conversations", "Knowledge", "Coworkers", "Apps", "Settings"],
    );
    if (width === 390) {
      assert.deepEqual(
        (
          await page
            .locator('nav[aria-label="Primary navigation"]:visible')
            .locator("a,button")
            .allTextContents()
        ).map((value) => value.trim()),
        ["Today", "Work", "Records", "More"],
      );
      await page.getByRole("button", { name: "Close navigation" }).click();
      await page.waitForTimeout(350);
    }
    assert.equal(
      await page
        .locator('[data-today-module="attention"]')
        .evaluate((node) =>
          Boolean(
            node.compareDocumentPosition(document.querySelector('[data-today-module="brief"]')) &
            Node.DOCUMENT_POSITION_FOLLOWING,
          ),
        ),
      true,
      "Attention should precede the business overview in a fresh view",
    );
    await page.screenshot({ path: `${output}/today-${width}.png`, fullPage: false });

    await page.goto(route("work"), { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Work", exact: true }).waitFor();
    assert.equal(await page.getByLabel("Ownership").inputValue(), "me");
    assert.equal(await page.locator("#work-view-editor").isVisible(), false);
    if (await page.getByRole("button", { name: "View team work" }).count())
      await page.getByRole("button", { name: "View team work" }).click();
    const firstTask = page.locator('[data-source-type="task"]').first();
    await firstTask.waitFor();
    await page.screenshot({ path: `${output}/work-list-${width}.png`, fullPage: false });
    await page.keyboard.press("j");
    assert.equal(
      await firstTask.locator("[data-record-row]").getAttribute("data-selected"),
      "true",
    );
    await page.keyboard.press("s");
    const taskDialog = page.getByRole("dialog", { name: "Task details" });
    await taskDialog.waitFor();
    assert.ok(await taskDialog.getByLabel("Snooze until").inputValue());
    await page.waitForFunction(() => {
      const dialog = document.querySelector('[data-admin-overlay="dialog"]');
      return dialog && Number(getComputedStyle(dialog).opacity) >= 0.99;
    });
    await page.screenshot({ path: `${output}/work-${width}.png`, fullPage: false });
    await taskDialog.getByRole("button", { name: "Close task" }).click();
    await taskDialog.waitFor({ state: "hidden" });
    await page.getByRole("link", { name: "Approvals", exact: true }).click();
    await page.locator('[data-source-type="approval"]').first().waitFor();
    await page.keyboard.press("j");
    await page
      .locator('[data-source-type="approval"]')
      .first()
      .locator('[data-record-row][data-selected="true"]')
      .waitFor();
    await page.keyboard.press("a");
    await page.getByRole("button", { name: "Close review" }).waitFor();
    await page.keyboard.press("Escape");

    await page.goto(route("contacts"), { waitUntil: "networkidle" });
    await page
      .getByText("Lena Walsh", { exact: true })
      .locator("../..")
      .getByRole("link", { name: "Open history" })
      .click();
    await page.getByRole("heading", { name: "Next step" }).waitFor();
    await page.getByRole("heading", { name: "Open work" }).waitFor();
    await page.getByRole("heading", { name: "Conversations" }).waitFor();
    const conversationLink = page.locator('a[href*="/conversations?thread="]').first();
    await conversationLink.waitFor();
    assert.ok(
      new URL(await conversationLink.getAttribute("href"), base).searchParams.get("thread"),
    );
    const opportunityLink = page.locator('a[href*="/pipeline/"]').first();
    await opportunityLink.waitFor();
    if (width === 1440) {
      const records = page.locator('section[data-nav-section="Records"]:visible');
      const moreRecords = records.getByRole("button", { name: "More records" });
      assert.equal(await moreRecords.getAttribute("aria-expanded"), "false");
      await moreRecords.click();
      await records.getByRole("link", { name: "Leads", exact: true }).waitFor();
      await moreRecords.click();
    }
    await page.screenshot({ path: `${output}/contact-${width}.png`, fullPage: false });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      false,
      "Contact hub overflows the viewport",
    );
    assert.deepEqual(errors, [], `Runtime errors at ${width}px`);
    await context.close();
  }
  console.log(
    `PASS: daily navigation, Today order, Work keyboard/snooze, contact hub, responsive layout. Screenshots: ${output}`,
  );
} finally {
  await browser.close();
}
