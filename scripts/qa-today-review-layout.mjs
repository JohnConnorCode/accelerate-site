import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3058";
const output = process.env.TODAY_REVIEW_QA_OUTPUT || "output/playwright/today-review";
await mkdir(output, { recursive: true });
const cases = [
  ["alder-ridge-law", "dark", 1920],
  ["alder-ridge-law", "dark", 1440],
  ["alder-ridge-law", "dark", 390],
  ["alder-ridge-law", "light", 1440],
  ["alder-ridge-law", "light", 390],
  ["northline-roofing", "operator", 1440],
  ["northline-roofing", "operator", 390],
];
const browser = await chromium.launch();
const results = [];
let page;
try {
  for (const [scenario, appearance, width] of cases) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      reducedMotion: width === 390 ? "reduce" : "no-preference",
    });
    await context.addInitScript(
      ({ scenario, appearance }) => {
        sessionStorage.setItem(`accelerate:admin-demo:${scenario}:appearance:v1`, appearance);
      },
      { scenario, appearance },
    );
    page = await context.newPage();
    const errors = [],
      escaped = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin || url.pathname.startsWith("/api/")) {
        escaped.push(url.origin + url.pathname);
        return route.abort();
      }
      return route.continue();
    });
    const root = `/demo/command-center/${scenario}`;
    await page.goto(base + root + "/today");
    await page.locator("[data-business-review]").first().waitFor();
    await page.waitForFunction(
      (expected) => document.documentElement.dataset.theme === expected,
      appearance,
    );
    await page.waitForFunction(() => {
      const action = document.querySelector("[data-business-review] a.admin-button");
      if (!action || action.getBoundingClientRect().height < 43.99) return false;
      for (let node = action; node; node = node.parentElement) {
        if (Number(getComputedStyle(node).opacity) < 0.999) return false;
      }
      return true;
    });
    assert.equal(await page.locator("[data-business-review]").count(), 4);
    assert.equal(await page.locator("[data-page-start-hint]").count(), 0);
    assert.equal(
      await page.locator(".admin-page-introduction > [data-page-start-hint]").count(),
      0,
    );
    const geometry = await page.locator("[data-today-workspace]").evaluate((workspace) => {
      const rows = [...workspace.querySelectorAll("[data-business-review]")].map((row) => {
        const r = row.getBoundingClientRect();
        const action = row.querySelector("a.admin-button")?.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          bottom: r.bottom,
          action: action && { x: action.x, right: action.right, height: action.height },
        };
      });
      const gap = parseFloat(getComputedStyle(workspace).gap);
      const firstModule = workspace.querySelector("[data-today-module]").getBoundingClientRect();
      const workflow = [...workspace.querySelectorAll("summary")].find((s) =>
        s.textContent.includes("Start a business workflow"),
      );
      return {
        rows,
        gap,
        workflowBelowWork: workflow.getBoundingClientRect().top > firstModule.bottom,
        overflow: workspace.scrollWidth - workspace.clientWidth,
        documentOverflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    assert(geometry.gap >= 16, "Page sections need visible separation");
    assert(geometry.workflowBelowWork, "Workflow browsing must follow the active work");
    assert(geometry.overflow <= 2 && geometry.documentOverflow <= 2, "Horizontal overflow");
    for (const [i, row] of geometry.rows.entries()) {
      assert(Math.abs(row.x - geometry.rows[0].x) < 2, "Review rows share one reading column");
      assert(Math.abs(row.width - geometry.rows[0].width) < 2, "No narrow category columns");
      if (i) assert(row.y >= geometry.rows[i - 1].bottom - 1, "Review rows overlap");
      if (row.action) {
        assert(row.action.height >= 43.99, "Review target is too small");
        assert(row.action.right <= row.x + row.width + 1, "Review action is clipped");
      }
    }
    const primary = page.locator("[data-business-review] a.admin-button").first();
    assert.match(await primary.innerText(), /Review|Open conversation/);
    const href = await primary.getAttribute("href");
    assert(href.startsWith(root + "/"), "Review action lost its fictional workspace");
    const evidence = page.locator("[data-business-review] details").first();
    await evidence.locator("summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await evidence.getAttribute("open"), "");
    assert.match(await evidence.innerText(), /Source and next step/);
    await page.keyboard.press("Enter");
    await page.locator(".admin-page-introduction h1").click();
    await page.locator(".admin-main").evaluate((main) => {
      main.scrollTop = 0;
    });
    const name = `${scenario}-${appearance}-${width}`;
    await page.screenshot({ path: `${output}/${name}.png` });
    // Exercise the real shared link, not a replacement interaction fixture.
    await primary.focus();
    await page.keyboard.press("Enter");
    const expected = new URL(href, base);
    await page.waitForURL(
      (url) => url.pathname === expected.pathname && url.search === expected.search,
    );
    await page.locator(".admin-main h1").waitFor();
    await page.goBack();
    await page.locator("[data-business-review] a.admin-button").first().waitFor();
    const assist = page
      .locator('[data-business-review] button[aria-label^="Ask AI about"]')
      .first();
    await assist.focus();
    await page.keyboard.press("Enter");
    const panel = page.getByRole("dialog", { name: "Ask AI", exact: true });
    await panel.waitFor();
    await page.getByRole("textbox", { name: "Ask the business", exact: true }).waitFor();
    assert.match(
      await page.getByRole("textbox", { name: "Ask the business", exact: true }).inputValue(),
      /Help me decide the next step/,
    );
    await page.getByRole("button", { name: "Close AI panel", exact: true }).click();
    assert.deepEqual(escaped, [], "Demo escaped to an external or live API");
    assert.deepEqual(errors, [], "Browser errors");
    results.push({
      scenario,
      appearance,
      width,
      geometry,
      keyboardNavigation: true,
      sourceDisclosure: true,
      contextualAiPreparedWithoutSubmission: true,
      errors,
      escaped,
    });
    await context.close();
  }
  await writeFile(
    `${output}/receipt.json`,
    JSON.stringify(
      {
        passed: true,
        boundary:
          "Compiled shared UI with fictional demo records; no model request or live business effect",
        results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Today review layout passed ${results.length} scenario/appearance/viewport cases.`);
} catch (error) {
  if (page && !page.isClosed())
    await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify({ error: String(error), completed: results.length }, null, 2) + "\n",
  );
  throw error;
} finally {
  await browser.close();
}
