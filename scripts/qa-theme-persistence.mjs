import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3047";
const output = "/tmp/accelerate-theme-persistence";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: width === 390 ? "reduce" : "no-preference",
    });
    const publicPage = await context.newPage();
    await publicPage.setViewportSize({ width: 1440, height: 1000 });
    const errors = [];
    publicPage.on("pageerror", (e) => errors.push(e.message));
    publicPage.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await publicPage.goto(`${base}/demo/command-center`, { waitUntil: "networkidle" });
    const demo = await context.newPage();
    demo.on("pageerror", (e) => errors.push(e.message));
    demo.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/admin"))
        errors.push("Demo requested a protected API");
    });
    demo.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await demo.goto(`${base}/demo/command-center/northline-roofing/conversations`, {
      waitUntil: "networkidle",
    });
    await demo.getByRole("heading", { name: "Conversations", exact: true }).waitFor();
    await publicPage.bringToFront();
    // Public and live admin use the same shared provider and existing "theme" preference.
    await publicPage
      .getByRole("button", { name: "Switch to dark mode", exact: true })
      .first()
      .click();
    await publicPage.waitForTimeout(1200);
    const current = await publicPage.locator("html").getAttribute("data-theme");
    if (process.argv.includes("--reproduce")) {
      assert.notEqual(current, "dark", "Expected the old demo tab to overwrite the selection");
      writeFileSync(
        `${output}/before.json`,
        JSON.stringify({ selected: "dark", revertedTo: current, width }),
      );
      console.log(
        `REPRODUCED: shared theme selected dark, reverted to ${current} with demo tab open.`,
      );
      await context.close();
      break;
    }
    assert.equal(current, "dark", "An open demo tab must not revert the shared preference");
    await demo.bringToFront();
    assert.equal(await demo.locator("html").getAttribute("data-theme"), "studio");
    const choose = async (label) => {
      const trigger = demo
        .getByRole("button", { name: /^Appearance:/ })
        .filter({ visible: true })
        .first();
      if (!(await trigger.count()))
        await demo.getByRole("button", { name: "Open More", exact: true }).click();
      await trigger.click();
      const option = demo.getByRole("radio", { name: new RegExp(label) });
      await option.focus();
      await demo.keyboard.press("Enter");
      await demo.waitForTimeout(500);
      if (width === 390) await demo.keyboard.press("Escape");
    };
    await demo.evaluate(() => {
      window.themeRuntimeFetch = window.fetch;
    });
    await choose("Night");
    assert.equal(
      await demo.evaluate(() => window.themeRuntimeFetch === window.fetch),
      true,
      "Appearance changes must not reinstall the demo runtime",
    );
    assert.equal(await demo.locator("html").getAttribute("data-theme"), "dark");
    await demo
      .getByRole("link", { name: "Pipeline", exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await demo.getByRole("heading", { name: "Pipeline", exact: true }).waitFor();
    assert.equal(await demo.locator("html").getAttribute("data-theme"), "dark");
    await demo.reload({ waitUntil: "networkidle" });
    assert.equal(await demo.locator("html").getAttribute("data-theme"), "dark");
    await choose("Paper");
    assert.equal(
      await publicPage.locator("html").getAttribute("data-theme"),
      "dark",
      "Demo choice must not overwrite the live/public preference",
    );
    await choose("Material 2026");
    assert.equal(
      await demo.locator("html").getAttribute("data-theme"),
      "material",
      "Material 2026 must apply through the shared appearance registry",
    );
    await choose("macOS");
    assert.equal(
      await demo.locator("html").getAttribute("data-theme"),
      "mac",
      "macOS must apply through the shared appearance registry",
    );
    const switchBusiness = async (id) => {
      if (width === 390) await demo.getByRole("button", { name: "Open More", exact: true }).click();
      await demo
        .getByRole("button", { name: "Open demo controls", exact: true })
        .filter({ visible: true })
        .click();
      await demo.getByRole("combobox", { name: "Demo business", exact: true }).selectOption(id);
      await demo.waitForURL(`**/demo/command-center/${id}/pipeline`);
      await demo.waitForFunction((id) => window.__accelerateAdminDemoRuntime === id, id);
      const response = await demo.evaluate(async () => {
        const r = await fetch("/api/admin/revenue-os/pipeline");
        return { status: r.status, body: await r.json() };
      });
      assert.equal(response.status, 200);
      assert.ok(response.body.opportunities.length > 0);
    };
    await switchBusiness("alder-ridge-law");
    assert.equal(await demo.locator("html").getAttribute("data-theme"), "dark");
    await switchBusiness("northline-roofing");
    assert.equal(
      await demo.locator("html").getAttribute("data-theme"),
      "mac",
      "Each demo business must retain its selected appearance",
    );
    await demo
      .getByRole("link", { name: "Conversations", exact: true })
      .filter({ visible: true })
      .first()
      .click();
    await demo.getByRole("heading", { name: "Conversations", exact: true }).waitFor();
    await demo.screenshot({ path: `${output}/conversations-${width}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    results.push({ width, result: "passed", crossTab: true, navigation: true, reload: true });
    await context.close();
  }
  if (!process.argv.includes("--reproduce")) {
    writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
    console.log(
      "PASS: shared appearance stays selected with demo tab open; demo isolation, keyboard switching, navigation, reload and scenario persistence.",
    );
  }
} finally {
  await browser.close();
}
