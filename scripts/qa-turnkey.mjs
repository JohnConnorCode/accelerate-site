import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const base = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3018";
const output = "/tmp/accelerate-turnkey-qa";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [label, viewport, motion] of [
    ["desktop", { width: 1440, height: 1000 }, "no-preference"],
    ["mobile", { width: 390, height: 844 }, "reduce"],
  ]) {
    const context = await browser.newContext({ viewport, reducedMotion: motion });
    const page = await context.newPage();
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
