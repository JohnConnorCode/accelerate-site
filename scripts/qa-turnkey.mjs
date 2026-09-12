import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3018";
const neutral = process.argv.includes("--neutral");
const output = neutral ? "/tmp/accelerate-neutral-qa" : "/tmp/accelerate-turnkey-qa";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [label, viewport, motion] of [
    ["desktop", { width: 1440, height: 1000 }, "no-preference"],
    ["mobile", { width: 390, height: 844 }, "reduce"],
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: motion });
    const page = await context.newPage();
    if (neutral) {
      const escaped = [], errors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      await page.route("**/*", route => {
        const url = new URL(route.request().url());
        if (url.origin !== new URL(base).origin) { escaped.push(url.origin + url.pathname); return route.abort(); }
        return route.continue();
      });
      try {
        assert.equal((await page.goto(base)).status(), 200);
        await page.getByRole("heading", { name: "Harbor Operations", exact: true }).waitFor();
        assert.equal(await page.title(), "Harbor Operations");
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://harbor.example");
        await page.screenshot({ path: `${output}/${label}-entry.png`, fullPage: true });
        await page.getByRole("link", { name: "Open your workspace", exact: true }).focus();
        await page.keyboard.press("Enter");
        await page.getByRole("heading", { name: "Connect your Supabase project" }).waitFor();
        await page.screenshot({ path: `${output}/${label}-setup.png`, fullPage: true });
        const demo = base + "/demo/command-center/northline-roofing";
        await page.goto(demo + "/pipeline");
        await page.getByPlaceholder("Search company, person, or email").waitFor();
        await page.waitForFunction(() => Boolean(window.__accelerateAdminDemoRuntime));
        assert.ok(await page.locator(".kanban-card").count() > 0, "Fictional populated pipeline");
        await page.screenshot({ path: `${output}/${label}-populated.png`, fullPage: true });
        await page.getByPlaceholder("Search company, person, or email").fill("no-matching-neutral-fixture-81725");
        await page.getByText("No matching opportunities", { exact: true }).waitFor();
        await page.screenshot({ path: `${output}/${label}-empty.png`, fullPage: true });
        await page.goto(demo + "/branding");
        await page.getByLabel("Display name", { exact: true }).fill("Harbor Demo Team");
        await page.getByRole("button", { name: "Save branding", exact: true }).focus();
        await page.keyboard.press("Enter");
        await page.getByRole("button", { name: "Save branding", exact: true }).and(page.locator(":disabled")).waitFor();
        await page.reload();
        await page.getByLabel("Display name", { exact: true }).waitFor();
        assert.equal(await page.getByLabel("Display name", { exact: true }).inputValue(), "Harbor Demo Team");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true);
        await page.screenshot({ path: `${output}/${label}-branding.png`, fullPage: true });
        assert.deepEqual(escaped, [], "No escaped external requests, including original installation domains");
        assert.deepEqual(errors, [], "No browser console or runtime errors");
        writeFileSync(`${output}/${label}.json`, JSON.stringify({ passed: true, viewport, motion, escaped, errors, evidence: ["configured entry metadata", "setup boundary", "fictional populated pipeline", "filtered empty state", "saved demo branding survives reload"] }, null, 2));
      } catch (error) {
        await page.screenshot({ path: `${output}/${label}-failure.png`, fullPage: true });
        writeFileSync(`${output}/${label}.json`, JSON.stringify({ passed: false, message: error.message, escaped, errors }, null, 2));
        throw error;
      } finally { await context.close(); }
      continue;
    }
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    assert.equal((await page.goto(base + "/roadmap")).status(), 200);
    await page.getByText("No workspace data is connected.", { exact: false }).waitFor();
    const demo = page.getByRole("link", { name: "Explore the fictional Command Center" });
    await demo.focus();
    assert.equal(await demo.evaluate((el) => el === document.activeElement), true);
    assert.equal(await page.getByRole("heading", { name: "Got an idea?" }).count(), 0);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
      true,
    );
    await demo.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${output}/${label}.png`, fullPage: true });
    await demo.press("Enter");
    await page.waitForURL("**/demo/command-center/northline-roofing**");
    await page
      .getByText("Northline Roofing", { exact: false })
      .filter({ visible: true })
      .first()
      .waitFor();
    assert.equal(errors.length, 0, errors.join("\n"));
    assert.equal((await page.goto(base + "/docs/self-hosting/overview")).status(), 200);
    await page.goto(base + "/admin");
    await page.getByRole("heading", { name: "Connect your Supabase project" }).waitFor();
    assert.equal(errors.length, 0, errors.join("\n"));
    await context.close();
  }
  console.log(
    "PASS: credential-free roadmap, demo navigation, setup docs, admin setup boundary, desktop/mobile, keyboard, reduced motion, console, overflow.",
  );
} finally {
  await browser.close();
}
