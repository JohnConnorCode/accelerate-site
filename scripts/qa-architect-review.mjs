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
    const select = page.getByRole("combobox", { name: /^Blueprint/ });
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
    assert.equal(await dialog.getByText(/This proposal recorded no payload/).count(), 0);
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every(
          (animation) =>
            animation.playState !== "running" ||
            animation.effect?.getTiming().iterations === Infinity,
        ),
    );
    const axe = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    assert.deepEqual(
      axe.violations.map(({ id, nodes }) => ({
        id,
        nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
      })),
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
    await simulation
      .getByRole("heading", { name: "Simulation result", exact: true })
      .scrollIntoViewIfNeeded();
    const log = page.getByRole("log", { name: "AI conversation" });
    assert.ok(
      await log.evaluate(
        (node) => node.clientHeight >= 120 && node.scrollWidth <= node.clientWidth + 1,
      ),
      `Readable chat viewport at ${width}`,
    );
    assert.equal(
      await page.getByRole("button", { name: "Jump to latest", exact: true }).count(),
      0,
      "Empty chat must not cover the simulation with a chat navigation control",
    );
    const send = await page.getByRole("button", { name: "Send AI command" }).boundingBox();
    assert.ok(
      send && send.x >= 0 && send.x + send.width <= width,
      `Composer remains reachable at ${width}`,
    );
    await page.screenshot({ path: `${output}/simulation-${width}.png` });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `Overflow at ${width}`,
    );
    await page
      .getByRole("navigation", { name: "AI workspace mode" })
      .getByRole("link", { name: "Ask", exact: true })
      .click();
    await select.waitFor({ state: "hidden" });
    await page
      .getByRole("navigation", { name: "AI workspace mode" })
      .getByRole("link", { name: "Architect", exact: true })
      .click();
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
