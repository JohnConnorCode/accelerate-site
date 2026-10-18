import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3047";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const output = process.env.QA_AI_COST_OUTPUT ?? "/tmp/accelerate-ai-cost-controls";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const checks = [];
let active;
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
      reducedMotion: width === 1440 ? "no-preference" : "reduce",
    });
    const page = await context.newPage();
    active = page;
    const errors = [],
      escaped = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/api/admin/") || /openrouter|stripe|resend/.test(url.hostname))
        escaped.push(url.pathname);
    });
    await page.goto(`${base}/demo/command-center/northline-roofing/ai?view=costs`);
    await page.getByRole("heading", { name: "Control AI spending", exact: true }).waitFor();
    const enabled = page.getByRole("switch", { name: "Allow model requests", exact: true });
    const recurring = page.getByRole("switch", {
      name: "Run recurring AI and coworker work",
      exact: true,
    });
    assert.equal(await enabled.getAttribute("aria-checked"), "false");
    assert.equal(await recurring.getAttribute("aria-checked"), "false");
    for (const [label, value] of [
      ["Daily budget (USD)", "0.50"],
      ["Monthly budget (USD)", "5"],
      ["Maximum per request (USD)", "0.05"],
      ["Maximum requests per day", "10"],
    ])
      await page.getByLabel(label, { exact: true }).fill(value);
    await enabled.focus();
    await page.keyboard.press("Space");
    await recurring.click();
    await page.getByLabel("Maximum requests per day", { exact: true }).press("Enter");
    await page.getByRole("status").filter({ hasText: "AI controls saved" }).waitFor();
    const read = () =>
      page.evaluate(async () => await (await fetch("/api/admin/ai-cost-controls")).json());
    let saved = await read();
    assert.equal(saved.policy.enabled, true);
    assert.equal(saved.policy.recurringEnabled, true);
    assert.equal(saved.policy.dailyUsd, 0.5);
    await page.reload();
    await enabled.waitFor();
    assert.equal(await enabled.getAttribute("aria-checked"), "true");
    assert.equal(await recurring.getAttribute("aria-checked"), "true");
    await recurring.click();
    await page.getByRole("button", { name: "Save AI controls", exact: true }).click();
    await page
      .locator(
        '[role="switch"][aria-label="Run recurring AI and coworker work"][aria-checked="false"]',
      )
      .waitFor();
    assert.equal((await read()).policy.recurringEnabled, false);
    await page.getByRole("button", { name: "Pause Business Pulse", exact: true }).click();
    await page.getByRole("button", { name: "Resume Business Pulse", exact: true }).waitFor();
    assert.equal(
      (await read()).coworkers.find((row) => row.id === "business-pulse").status,
      "paused",
    );
    // A refreshed server revision must not silently rebase an unsaved budget edit.
    await page.getByLabel("Daily budget (USD)", { exact: true }).fill("0.70");
    await page.evaluate(async () => {
      const current = await (await fetch("/api/admin/ai-cost-controls")).json();
      const result = await fetch("/api/admin/ai-cost-controls", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: current.revision,
          policy: { ...current.policy, monthlyUsd: 7 },
        }),
      });
      if (!result.ok) throw new Error("Controlled competing save failed");
    });
    await page.getByRole("button", { name: "Refresh usage", exact: true }).click();
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("button")).some(
        (button) => button.textContent.trim() === "Refresh usage" && !button.disabled,
      ),
    );
    await page.getByRole("button", { name: "Save AI controls", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "AI controls changed" }).waitFor();
    saved = await read();
    assert.equal(saved.policy.monthlyUsd, 7);
    assert.equal(saved.policy.dailyUsd, 0.5);
    await page.getByRole("button", { name: "Pause all AI now", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("status").filter({ hasText: "AI controls saved" }).waitFor();
    saved = await read();
    assert.equal(saved.policy.enabled, false);
    assert.equal(saved.policy.recurringEnabled, false);
    await page
      .locator('[role="switch"][aria-label="Allow model requests"][aria-checked="false"]')
      .waitFor();
    assert.equal(await page.getByLabel("Daily budget (USD)", { exact: true }).inputValue(), "0.5");
    assert.deepEqual(
      (await page.getByRole("alert").allTextContents()).map((text) => text.trim()).filter(Boolean),
      [],
    );
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every(
          (animation) =>
            animation.playState !== "running" ||
            animation.effect?.getTiming().iterations === Infinity,
        ),
    );
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const axe = await new AxeBuilder({ page })
      .include('form[aria-label="AI spending controls"]')
      .analyze();
    assert.deepEqual(
      axe.violations.map((row) => ({ id: row.id, targets: row.nodes.map((node) => node.target) })),
      [],
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(escaped, []);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${output}/controls-${width}.png`, fullPage: true });
    await page
      .getByRole("heading", { name: "Current usage", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/usage-${width}.png` });
    checks.push({
      width,
      defaultOff: true,
      recurringToggleAndReload: true,
      keyboardSave: true,
      reload: true,
      individualPause: true,
      staleRefusal: true,
      pauseAll: true,
      noOverflow: true,
      protectedOrProviderRequests: 0,
    });
    await context.close();
  }
  await writeFile(`${output}/receipt.json`, JSON.stringify({ result: "passed", checks }, null, 2));
  console.log(JSON.stringify({ result: "passed", checks }, null, 2));
} catch (error) {
  await active?.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  await writeFile(
    `${output}/receipt.json`,
    JSON.stringify({ result: "failed", checks, error: String(error) }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
