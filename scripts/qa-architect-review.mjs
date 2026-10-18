import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3046";
const output = process.env.QA_OUTPUT_DIR || "/tmp/accelerate-architect-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const failures = [];
const results = [];
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: width === 320 ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => failures.push(error.message));
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin || url.pathname.startsWith("/api/")) {
        failures.push(`Fictional request escaped: ${url.origin}${url.pathname}`);
        return route.abort();
      }
      return route.continue();
    });
    const root = "/demo/command-center/northline-roofing/ai";
    await page.goto(`${base}${root}?purpose=architect`);
    await page.waitForFunction(() => window.__accelerateAdminDemoRuntime);
    const select = page.getByLabel("Blueprint", { exact: true });
    await select.selectOption("11111111-1111-4111-8111-111111111111");
    await page.getByText(/^Version 1:/).waitFor();
    await page
      .getByLabel("Proposed change")
      .fill("Set the business summary to Review the scope before scheduling each job.");
    await page.getByLabel("Change summary", { exact: true }).fill("Clarify scope review");
    await page.getByRole("button", { name: "Preview patch", exact: true }).click();
    const preview = page.getByRole("region", { name: "Patch preview", exact: true });
    await preview
      .getByText("Review the scope before scheduling each job.", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Review draft save", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByRole("region", { name: "Exact Blueprint draft change" }).waitFor();
    const axe = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    assert.deepEqual(
      axe.violations.map(({ id }) => id),
      [],
      `Review accessibility at ${width}`,
    );
    await page.screenshot({ path: `${output}/review-${width}.png` });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.getByText(/^Version 1:/).waitFor();
    await page.getByRole("button", { name: "Review draft save", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Approve", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await page.getByText(/^Version 2: Review the scope/).waitFor();
    await page.getByRole("button", { name: "Simulate", exact: true }).click();
    const simulation = page.getByRole("region", { name: "Simulation result", exact: true });
    await simulation.getByText(/No live changes were made/).waitFor();
    await page.getByText(/^Version 2:/).waitFor();
    await page.screenshot({ path: `${output}/simulation-${width}.png` });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `Overflow at ${width}`,
    );
    await page.getByRole("link", { name: "Ask", exact: true }).click();
    await select.waitFor({ state: "hidden" });
    await page.getByRole("link", { name: "Architect", exact: true }).click();
    await select.selectOption("11111111-1111-4111-8111-111111111111");
    await page.getByText(/^Version 2:/).waitFor();
    await context.close();
    results.push({
      width,
      preview: true,
      exactApproval: true,
      cancelPreservesDraft: true,
      simulationReadOnly: true,
      modeSwitch: true,
    });
  }
  assert.deepEqual(failures, []);
  await writeFile(`${output}/receipt.json`, JSON.stringify({ base, results, failures }, null, 2));
  console.log(JSON.stringify({ result: "passed", results, output }, null, 2));
} finally {
  await browser.close();
}
