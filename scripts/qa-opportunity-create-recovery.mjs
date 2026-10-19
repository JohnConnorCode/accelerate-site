import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3047";
const output = process.env.OPPORTUNITY_QA_OUTPUT || "output/playwright/opportunity-create-recovery";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const [width, motion] of [
    [1440, "no-preference"],
    [390, "reduce"],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: motion,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(`${base}/demo/command-center/superdebate/pipeline`);
    await page.getByRole("button", { name: "New opportunity", exact: true }).waitFor();
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("button")).some(
        (button) => button.textContent?.includes("New opportunity") && !button.disabled,
      ),
    );
    await page.evaluate(() => {
      const original = window.fetch.bind(window);
      window.__opportunityRecovery = { captures: [], rows: {} };
      window.fetch = async (input, options) => {
        const path = typeof input === "string" ? input.split("?")[0] : String(input);
        if (path !== "/api/admin/revenue-os/pipeline") return original(input, options);
        const state = window.__opportunityRecovery;
        if (!options?.method || options.method === "GET") {
          const data = await (await original(input, options)).json();
          return Response.json({
            ...data,
            opportunities: [...data.opportunities, ...Object.values(state.rows)],
          });
        }
        if (options.method !== "POST") return original(input, options);
        const body = JSON.parse(options.body);
        state.captures.push(body);
        state.rows[body.requestId] ??= {
          id: body.requestId,
          name: body.companyName,
          email: body.email,
          stage: "new",
          canonical_stage: "new",
          sort_order: 1000,
          estimated_value: Number(body.estimatedValue) || 0,
          won_value: 0,
          probability: 10,
          next_action: body.nextAction || null,
          next_action_at: body.nextActionAt || null,
          source: "manual",
          owner_email: "demo@example.test",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          contact: { full_name: body.name, primary_email: body.email },
          company: { name: body.companyName },
        };
        if (state.captures.length === 1) throw new TypeError("Controlled lost response after save");
        return Response.json({ opportunity: state.rows[body.requestId] }, { status: 201 });
      };
    });
    const open = async () => {
      const b = page.getByRole("button", { name: "New opportunity", exact: true });
      await b.focus();
      await page.keyboard.press("Enter");
    };
    await open();
    const dialog = page.getByRole("dialog", { name: "New opportunity", exact: true });
    const fill = async () => {
      await dialog.getByLabel("Contact name", { exact: true }).fill("Fictional Recovery Customer");
      await dialog.getByLabel("Email", { exact: true }).fill("recovery@example.test");
      await dialog.getByLabel("Company", { exact: true }).fill("Fictional Recovery Company");
    };
    await fill();
    await dialog.getByRole("button", { name: "Create opportunity", exact: true }).focus();
    await page.keyboard.press("Enter");
    await dialog.getByRole("alert").waitFor();
    assert.match(
      await dialog.getByRole("alert").innerText(),
      /The save could not be confirmed\. Retry save to recover it without creating another opportunity\./,
    );
    await dialog.getByRole("button", { name: "Retry save", exact: true }).waitFor();
    assert.equal(await dialog.getByLabel("Contact name", { exact: true }).isDisabled(), true);
    await page.screenshot({ path: `${output}/uncertain-${width}.png`, fullPage: true });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).focus();
    await page.keyboard.press("Enter");
    await dialog.waitFor({ state: "hidden" });
    await open();
    assert.equal(
      await dialog.getByLabel("Email", { exact: true }).inputValue(),
      "recovery@example.test",
    );
    await dialog.getByRole("button", { name: "Retry save", exact: true }).focus();
    await page.keyboard.press("Enter");
    await dialog.waitFor({ state: "hidden" });
    const recovered = await page.evaluate(() => window.__opportunityRecovery);
    assert.equal(recovered.captures.length, 2);
    assert.deepEqual(recovered.captures[0], recovered.captures[1]);
    assert.equal(Object.keys(recovered.rows).length, 1);
    await open();
    assert.equal(await dialog.getByLabel("Email", { exact: true }).isDisabled(), false);
    await fill();
    await dialog.getByRole("button", { name: "Create opportunity", exact: true }).focus();
    await page.keyboard.press("Enter");
    await dialog.waitFor({ state: "hidden" });
    const second = await page.evaluate(() => window.__opportunityRecovery);
    assert.equal(Object.keys(second.rows).length, 2);
    assert.notEqual(second.captures[0].requestId, second.captures[2].requestId);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
    );
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `${output}/recovered-${width}.png`, fullPage: true });
    results.push({
      width,
      motion,
      status: "passed",
      checks: [
        "keyboard submit",
        "uncertain input retained and locked",
        "close/reopen recovery",
        "same key and payload retry",
        "deliberate second intent",
        "no console errors or page overflow",
      ],
      boundary:
        "Real shared Pipeline UI; controlled in-browser API results; no connected database or hosted Auth proof.",
    });
    await context.close();
  }
  await writeFile(
    `${output}/receipt.json`,
    JSON.stringify({ status: "passed", results }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ status: "passed", output, results }, null, 2));
} finally {
  await browser.close();
}
